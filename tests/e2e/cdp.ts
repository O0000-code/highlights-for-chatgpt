export interface CdpMessage {
	id?: number;
	method?: string;
	params?: Record<string, unknown>;
	result?: unknown;
	error?: { message: string };
}

interface PendingCommand {
	resolve(value: unknown): void;
	reject(error: Error): void;
}

export class CdpSession {
	private id = 0;
	private readonly pending = new Map<number, PendingCommand>();
	private readonly listeners = new Map<
		string,
		Set<(params: Record<string, unknown>) => void>
	>();
	private readonly socket: WebSocket;
	readonly ready: Promise<void>;

	constructor(url: string) {
		this.socket = new WebSocket(url);
		this.ready = new Promise((resolve, reject) => {
			this.socket.addEventListener("open", () => resolve(), { once: true });
			this.socket.addEventListener(
				"error",
				() => reject(new Error(`Could not connect to ${url}`)),
				{ once: true },
			);
		});
		this.socket.addEventListener("message", (event) => {
			const message = JSON.parse(String(event.data)) as CdpMessage;
			if (message.id !== undefined) {
				const command = this.pending.get(message.id);
				if (!command) return;
				this.pending.delete(message.id);
				if (message.error) command.reject(new Error(message.error.message));
				else command.resolve(message.result);
				return;
			}
			if (!message.method) return;
			for (const listener of this.listeners.get(message.method) ?? []) {
				listener(message.params ?? {});
			}
		});
	}

	async send<T>(method: string, params: Record<string, unknown> = {}) {
		await this.ready;
		const id = ++this.id;
		return new Promise<T>((resolve, reject) => {
			this.pending.set(id, {
				resolve: (value) => resolve(value as T),
				reject,
			});
			this.socket.send(JSON.stringify({ id, method, params }));
		});
	}

	on(method: string, listener: (params: Record<string, unknown>) => void) {
		const listeners = this.listeners.get(method) ?? new Set();
		listeners.add(listener);
		this.listeners.set(method, listeners);
	}

	close() {
		this.socket.close();
	}
}

export async function createPageTarget(cdpBaseUrl: string) {
	const response = await fetch(
		`${cdpBaseUrl}/json/new?${encodeURIComponent("about:blank")}`,
		{ method: "PUT" },
	);
	if (!response.ok) {
		throw new Error(`Could not create Dia target: ${response.status}`);
	}
	return (await response.json()) as { webSocketDebuggerUrl: string };
}

export async function evaluate<T>(session: CdpSession, expression: string) {
	const response = await session.send<{
		result: { value?: T; description?: string };
		exceptionDetails?: { text: string };
	}>("Runtime.evaluate", {
		expression,
		returnByValue: true,
		awaitPromise: true,
	});
	if (response.exceptionDetails) {
		throw new Error(response.exceptionDetails.text);
	}
	return response.result.value as T;
}

export async function waitFor(
	session: CdpSession,
	expression: string,
	description: string,
	timeoutMs = 12_000,
) {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		if (await evaluate<boolean>(session, expression)) return;
		await Bun.sleep(100);
	}
	throw new Error(`Timed out waiting for ${description}`);
}

export function interceptHtml(
	session: CdpSession,
	urlPrefix: string,
	html: string,
) {
	session.on("Fetch.requestPaused", (params) => {
		const requestId = params.requestId;
		const request = params.request as { url?: string } | undefined;
		if (typeof requestId !== "string") return;
		if (request?.url?.startsWith(urlPrefix)) {
			void session.send("Fetch.fulfillRequest", {
				requestId,
				responseCode: 200,
				responseHeaders: [
					{ name: "Content-Type", value: "text/html; charset=utf-8" },
					{ name: "Cache-Control", value: "no-store" },
				],
				body: Buffer.from(html).toString("base64"),
			});
			return;
		}
		void session.send("Fetch.continueRequest", { requestId });
	});
}
