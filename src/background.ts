import {
	createHighlight,
	deleteHighlight,
	getHighlightsForUrl,
	listHighlights,
	openHighlightsDatabase,
	updateHighlightColor,
	updateThreadTitle,
} from "./background/database";
import { createChatGptExporterBridge } from "./background/export-bridge";
import { isHighlightColor } from "./shared/colors";
import type { RuntimeRequest, RuntimeResponse } from "./shared/types";

void openHighlightsDatabase();

const exporterBridge = createChatGptExporterBridge(getHighlightsForUrl);
chrome.runtime.onConnectExternal.addListener(exporterBridge.connect);

chrome.runtime.onMessage.addListener(
	(
		message: unknown,
		_sender,
		sendResponse: (response: RuntimeResponse) => void,
	) => {
		void handleRequest(message)
			.then(sendResponse)
			.catch((error: unknown) => {
				sendResponse({
					ok: false,
					error: error instanceof Error ? error.message : "Unexpected error",
				});
			});
		return true;
	},
);

async function handleRequest(message: unknown): Promise<RuntimeResponse> {
	if (!message || typeof message !== "object" || !("type" in message)) {
		return { ok: false, error: "Invalid request" };
	}

	const request = message as RuntimeRequest;
	switch (request.type) {
		case "PING":
			return { ok: true, data: "PONG" };
		case "LIST_HIGHLIGHTS":
			return { ok: true, data: await listHighlights() };
		case "GET_HIGHLIGHTS": {
			if (typeof request.url !== "string") {
				return { ok: false, error: "Conversation URL is missing" };
			}
			return { ok: true, data: await getHighlightsForUrl(request.url) };
		}
		case "CREATE_HIGHLIGHT": {
			const created = await createHighlight(request.input);
			exporterBridge.refresh(created.threadId);
			return { ok: true, data: created };
		}
		case "UPDATE_THREAD_TITLE": {
			if (
				typeof request.url !== "string" ||
				typeof request.title !== "string"
			) {
				return { ok: false, error: "Conversation title is missing" };
			}
			return {
				ok: true,
				data: await updateThreadTitle(request.url, request.title),
			};
		}
		case "UPDATE_HIGHLIGHT_COLOR": {
			if (typeof request.id !== "string" || !isHighlightColor(request.color)) {
				return { ok: false, error: "Invalid color update" };
			}
			const updated = await updateHighlightColor(request.id, request.color);
			if (updated) exporterBridge.refresh(updated.threadId);
			return updated
				? { ok: true, data: updated }
				: { ok: false, error: "Highlight not found" };
		}
		case "DELETE_HIGHLIGHT": {
			if (typeof request.id !== "string") {
				return { ok: false, error: "Highlight ID is missing" };
			}
			const removed = await deleteHighlight(request.id);
			if (removed) exporterBridge.refresh(removed.threadId);
			return removed
				? { ok: true, data: removed }
				: { ok: false, error: "Highlight not found" };
		}
		default:
			return { ok: false, error: "Unsupported request" };
	}
}
