const CHATGPT_THREAD_PREFIX = "chatgpt:";

export function getConversationId(rawUrl: string): string | null {
	try {
		const url = new URL(rawUrl);
		if (url.hostname !== "chatgpt.com") return null;

		const segments = url.pathname.split("/").filter(Boolean);
		const markerIndex = segments.indexOf("c");
		const conversationId =
			markerIndex >= 0 ? segments[markerIndex + 1] : undefined;
		return conversationId || null;
	} catch {
		return null;
	}
}

export function getThreadId(rawUrl: string): string {
	if (rawUrl.startsWith(CHATGPT_THREAD_PREFIX)) return rawUrl;
	const conversationId = getConversationId(rawUrl);
	return conversationId
		? `${CHATGPT_THREAD_PREFIX}${conversationId}`
		: normalizeConversationUrl(rawUrl);
}

export function normalizeConversationUrl(rawUrl: string): string {
	try {
		const url = new URL(rawUrl);
		const conversationId = getConversationId(rawUrl);
		url.hash = "";
		url.search = "";
		if (conversationId) url.pathname = `/c/${conversationId}`;
		return url.toString();
	} catch {
		return rawUrl;
	}
}

export function urlForThreadId(threadId: string): string {
	if (threadId.startsWith(CHATGPT_THREAD_PREFIX)) {
		return `https://chatgpt.com/c/${threadId.slice(CHATGPT_THREAD_PREFIX.length)}`;
	}
	return normalizeConversationUrl(threadId);
}
