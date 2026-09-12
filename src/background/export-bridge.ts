import { getConversationId, getThreadId } from "../shared/chatgpt";
import type { HighlightRecord } from "../shared/types";

export const CHATGPT_EXPORTER_EXTENSION_ID = "iplpjgojefnkkpkgaceiknlkfiaekgil";
export const EXPORT_BRIDGE_PORT_NAME = "chatgpt-highlights-export";
export const EXPORT_BRIDGE_PROTOCOL_VERSION = 1 as const;

export interface ExportHighlightRecord {
	id: string;
	threadId: string;
	text: string;
	prefix: string;
	suffix: string;
	occurrence?: number;
	color: HighlightRecord["color"];
	createdAt: number;
	updatedAt: number;
}

export interface ExportHighlightsSnapshot {
	type: "HIGHLIGHTS_SNAPSHOT";
	protocolVersion: typeof EXPORT_BRIDGE_PROTOCOL_VERSION;
	threadId: string;
	records: ExportHighlightRecord[];
}

interface ExportHighlightsRequest {
	type: "GET_HIGHLIGHTS";
	protocolVersion: typeof EXPORT_BRIDGE_PROTOCOL_VERSION;
	url: string;
}

interface ConnectedExporter {
	port: chrome.runtime.Port;
	url?: string;
}

type LoadHighlights = (url: string) => Promise<HighlightRecord[]>;

export function createChatGptExporterBridge(loadHighlights: LoadHighlights) {
	const connections = new Set<ConnectedExporter>();

	return {
		connect(port: chrome.runtime.Port) {
			if (!isTrustedExporter(port)) {
				port.disconnect();
				return;
			}

			const connection: ConnectedExporter = { port };
			connections.add(connection);
			port.onDisconnect.addListener(() => connections.delete(connection));
			port.onMessage.addListener((message: unknown) => {
				const request = parseExportRequest(message, port.sender?.tab?.url);
				if (!request) return;
				connection.url = request.url;
				void postSnapshot(connection, request.url, loadHighlights);
			});
		},

		refresh(threadId?: string) {
			for (const connection of connections) {
				if (!connection.url) continue;
				if (threadId && getThreadId(connection.url) !== threadId) continue;
				void postSnapshot(connection, connection.url, loadHighlights);
			}
		},
	};
}

export function createExportSnapshot(
	url: string,
	records: readonly HighlightRecord[],
): ExportHighlightsSnapshot {
	const threadId = getThreadId(url);
	return {
		type: "HIGHLIGHTS_SNAPSHOT",
		protocolVersion: EXPORT_BRIDGE_PROTOCOL_VERSION,
		threadId,
		records: records
			.filter((record) => record.threadId === threadId)
			.map((record) => ({
				id: record.id,
				threadId: record.threadId,
				text: record.text,
				prefix: record.prefix,
				suffix: record.suffix,
				occurrence: record.occurrence,
				color: record.color,
				createdAt: record.createdAt,
				updatedAt: record.updatedAt,
			})),
	};
}

export function isTrustedExporter(
	port: Pick<chrome.runtime.Port, "name" | "sender">,
) {
	return (
		port.name === EXPORT_BRIDGE_PORT_NAME &&
		port.sender?.id === CHATGPT_EXPORTER_EXTENSION_ID
	);
}

export function parseExportRequest(
	value: unknown,
	senderUrl?: string,
): ExportHighlightsRequest | null {
	if (!value || typeof value !== "object") return null;
	const candidate = value as Record<string, unknown>;
	if (
		candidate.type !== "GET_HIGHLIGHTS" ||
		candidate.protocolVersion !== EXPORT_BRIDGE_PROTOCOL_VERSION ||
		typeof candidate.url !== "string" ||
		!getConversationId(candidate.url)
	) {
		return null;
	}

	if (
		senderUrl &&
		getConversationId(senderUrl) &&
		getThreadId(senderUrl) !== getThreadId(candidate.url)
	) {
		return null;
	}

	return {
		type: "GET_HIGHLIGHTS",
		protocolVersion: EXPORT_BRIDGE_PROTOCOL_VERSION,
		url: candidate.url,
	};
}

async function postSnapshot(
	connection: ConnectedExporter,
	url: string,
	loadHighlights: LoadHighlights,
) {
	let records: HighlightRecord[];
	try {
		records = await loadHighlights(url);
	} catch (error) {
		console.error(
			"Could not share highlights with the export extension",
			error,
		);
		return;
	}

	try {
		connection.port.postMessage(createExportSnapshot(url, records));
	} catch {
		// The tab or exporter may have closed while IndexedDB was being read.
	}
}
