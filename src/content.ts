import type { CapturedAnchor } from "./content/anchors";
import { revealDeepLinkedHighlight } from "./content/deep-link";
import { initHighlightLibrary } from "./content/library";
import {
	initHighlightNavigator,
	refreshHighlightNavigator,
} from "./content/navigator";
import { initHighlightPalette } from "./content/palette";
import { HighlightRecoveryScheduler } from "./content/recovery";
import {
	clearRenderedHighlights,
	reapplyMissingHighlights,
	removeRenderedHighlight,
	renderHighlight,
	updateRenderedHighlightColor,
} from "./content/renderer";
import { sendRuntimeRequest } from "./content/runtime";
import {
	dismissSelectionToolbar,
	initSelectionToolbar,
} from "./content/selection-toolbar";
import { getConversationId, getThreadId } from "./shared/chatgpt";
import { DEFAULT_HIGHLIGHT_COLOR, type HighlightColor } from "./shared/colors";
import type { HighlightRecord } from "./shared/types";

const ROUTE_CHECK_INTERVAL = 400;
const REAPPLY_DEBOUNCE = 500;

let activeRecords: HighlightRecord[] = [];
let currentThreadId = getThreadId(window.location.href);
let restoreGeneration = 0;

const recovery = new HighlightRecoveryScheduler(() => {
	if (activeRecords.length === 0) return;
	reapplyMissingHighlights(activeRecords);
	refreshHighlightNavigator();
});

initSelectionToolbar(saveCapturedHighlight);
initHighlightPalette({
	onColorChange: changeHighlightColor,
	onRemove: removeHighlight,
});
initHighlightNavigator();
initHighlightLibrary();
startReapplyObserver();
window.addEventListener("popstate", checkForRouteChange);
window.addEventListener("pageshow", checkForRouteChange);
window.addEventListener("load", recoverVisibleConversation);
window.addEventListener("focus", recoverVisibleConversation);
document.addEventListener("visibilitychange", recoverVisibleConversation);
window.setInterval(checkForRouteChange, ROUTE_CHECK_INTERVAL);

void sendRuntimeRequest<string>({ type: "PING" })
	.then(() => restoreCurrentConversation(true))
	.catch((error: unknown) => {
		console.error(
			"Highlights could not connect to its background service",
			error,
		);
	});

async function saveCapturedHighlight(capture: CapturedAnchor) {
	const record = await sendRuntimeRequest<HighlightRecord>({
		type: "CREATE_HIGHLIGHT",
		input: {
			id: crypto.randomUUID(),
			url: window.location.href,
			conversationTitle: getConversationTitleFromPage(),
			text: capture.text,
			prefix: capture.prefix,
			suffix: capture.suffix,
			occurrence: capture.occurrence,
			color: DEFAULT_HIGHLIGHT_COLOR,
			createdAt: Date.now(),
		},
	});
	activeRecords = replaceRecord(activeRecords, record);
	renderHighlight(record, capture.range);
	return true;
}

async function changeHighlightColor(
	record: HighlightRecord,
	color: HighlightColor,
) {
	if (record.color === color) return true;
	const previousColor = record.color;
	updateRenderedHighlightColor(record.id, color);
	activeRecords = activeRecords.map((item) =>
		item.id === record.id ? { ...item, color } : item,
	);

	try {
		const updated = await sendRuntimeRequest<HighlightRecord>({
			type: "UPDATE_HIGHLIGHT_COLOR",
			id: record.id,
			color,
		});
		activeRecords = replaceRecord(activeRecords, updated);
		return true;
	} catch (error) {
		updateRenderedHighlightColor(record.id, previousColor);
		activeRecords = activeRecords.map((item) =>
			item.id === record.id ? { ...item, color: previousColor } : item,
		);
		console.error("Could not change the highlight color", error);
		return false;
	}
}

async function removeHighlight(record: HighlightRecord) {
	const previousRecords = activeRecords;
	activeRecords = activeRecords.filter((item) => item.id !== record.id);
	removeRenderedHighlight(record.id);
	try {
		await sendRuntimeRequest<HighlightRecord>({
			type: "DELETE_HIGHLIGHT",
			id: record.id,
		});
		return true;
	} catch (error) {
		activeRecords = previousRecords;
		renderHighlight(record);
		console.error("Could not remove the highlight", error);
		return false;
	}
}

async function restoreCurrentConversation(clearExisting: boolean) {
	const requestedUrl = window.location.href;
	const requestedThreadId = getThreadId(requestedUrl);
	const generation = ++restoreGeneration;
	if (clearExisting) {
		recovery.stop();
		activeRecords = [];
		clearRenderedHighlights();
	}

	try {
		const records = await sendRuntimeRequest<HighlightRecord[]>({
			type: "GET_HIGHLIGHTS",
			url: requestedUrl,
		});
		if (
			generation !== restoreGeneration ||
			getThreadId(window.location.href) !== requestedThreadId
		) {
			return;
		}
		activeRecords = records;
		const conversationTitle = getConversationTitleFromPage();
		if (conversationTitle) {
			void sendRuntimeRequest<HighlightRecord[]>({
				type: "UPDATE_THREAD_TITLE",
				url: requestedUrl,
				title: conversationTitle,
			});
		}
		if (activeRecords.length > 0) recovery.start();
		else refreshHighlightNavigator();
		const deepLinkedId = new URL(requestedUrl).searchParams.get("highlight");
		if (
			deepLinkedId &&
			activeRecords.some((record) => record.id === deepLinkedId)
		) {
			void revealDeepLinkedHighlight(deepLinkedId, activeRecords);
		}
	} catch (error) {
		console.error("Could not restore highlights for this conversation", error);
	}
}

function getConversationTitleFromPage() {
	const conversationId = getConversationId(window.location.href);
	if (!conversationId) return undefined;
	const expectedPath = `/c/${conversationId}`;
	const links = Array.from(
		document.querySelectorAll<HTMLAnchorElement>("a[href*='/c/']"),
	);
	const matchingLink = links.find((link) => {
		try {
			return new URL(link.href).pathname === expectedPath;
		} catch {
			return false;
		}
	});
	const linkTitle = matchingLink?.textContent?.replace(/\s+/g, " ").trim();
	if (linkTitle) return linkTitle;
	const documentTitle = document.title
		.replace(/\s*[|·—-]\s*ChatGPT\s*$/i, "")
		.trim();
	return documentTitle && documentTitle.toLocaleLowerCase() !== "chatgpt"
		? documentTitle
		: undefined;
}

function checkForRouteChange() {
	const nextThreadId = getThreadId(window.location.href);
	if (nextThreadId === currentThreadId) return;
	currentThreadId = nextThreadId;
	dismissSelectionToolbar();
	void restoreCurrentConversation(true);
}

function recoverVisibleConversation() {
	if (document.visibilityState === "hidden" || activeRecords.length === 0)
		return;
	recovery.runNow();
}

function startReapplyObserver() {
	const observer = new MutationObserver((mutations) => {
		if (activeRecords.length === 0 || mutations.every(isOwnUiMutation)) return;
		recovery.request(REAPPLY_DEBOUNCE);
	});
	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
		characterData: true,
	});
}

function isOwnUiMutation(mutation: MutationRecord) {
	const target =
		mutation.target instanceof Element
			? mutation.target
			: mutation.target.parentElement;
	if (target?.closest("[data-highlights-ui='true']")) return true;
	if (mutation.type !== "childList") return false;
	const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
	return (
		changedNodes.length > 0 &&
		changedNodes.every(
			(node) =>
				node instanceof Element &&
				(node.matches("[data-highlights-ui='true']") ||
					Boolean(node.closest("[data-highlights-ui='true']"))),
		)
	);
}

function replaceRecord(
	records: HighlightRecord[],
	replacement: HighlightRecord,
) {
	return [
		...records.filter((record) => record.id !== replacement.id),
		replacement,
	].sort((left, right) => left.createdAt - right.createdAt);
}
