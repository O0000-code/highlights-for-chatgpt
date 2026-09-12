import type { HighlightRecord } from "../shared/types";
import {
	getRenderedHighlightRect,
	reanchorHighlightForNavigation,
	reapplyMissingHighlights,
	scrollToRenderedHighlight,
} from "./renderer";

export interface ScrollState {
	top: number;
	height: number;
	viewport: number;
}

interface LoadEarlierOptions {
	tryReveal: () => boolean;
	readScrollState: () => ScrollState;
	scrollUp: (top: number) => void;
	waitForRender: () => Promise<void>;
	maxAttempts?: number;
}

/** Load progressively older virtualized content until the target can render. */
export async function loadEarlierUntilVisible({
	tryReveal,
	readScrollState,
	scrollUp,
	waitForRender,
	maxAttempts = 32,
}: LoadEarlierOptions) {
	if (tryReveal()) return true;
	let stableAtTop = 0;
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const before = readScrollState();
		const nextTop = Math.max(
			0,
			before.top - Math.max(600, before.viewport * 0.82),
		);
		scrollUp(nextTop);
		await waitForRender();
		if (tryReveal()) return true;
		const after = readScrollState();
		if (after.top <= 2 && after.height <= before.height + 2) stableAtTop++;
		else stableAtTop = 0;
		if (stableAtTop >= 20) break;
	}
	return false;
}

export async function revealDeepLinkedHighlight(
	id: string,
	records: HighlightRecord[],
) {
	const target = records.find((record) => record.id === id);
	if (!target) return false;
	reapplyMissingHighlights(records);
	reanchorHighlightForNavigation(target);
	if (scrollToRenderedHighlight(id)) return true;

	const status = showLoadingStatus();
	await waitForConversationReady();
	reapplyMissingHighlights(records);
	reanchorHighlightForNavigation(target);
	if (scrollToRenderedHighlight(id)) {
		status.remove();
		return true;
	}
	const scroller = findConversationScroller();
	if (!scroller) {
		showFailureStatus(status);
		return false;
	}
	const revealed = await loadEarlierUntilVisible({
		tryReveal: () => revealInScroller(target, records, scroller),
		readScrollState: () => scroller.read(),
		scrollUp: (top) => scroller.scrollTo(top),
		waitForRender: waitForConversationRender,
		maxAttempts: 80,
	});
	if (revealed) {
		for (const delay of [240, 900]) {
			await wait(delay);
			revealInScroller(target, records, scroller);
		}
		status.remove();
	} else showFailureStatus(status);
	return revealed;
}

interface ConversationScroller {
	align: (rect: DOMRect) => void;
	read: () => ScrollState;
	scrollTo: (top: number) => void;
}

function findConversationScroller(): ConversationScroller | null {
	const message = document.querySelector("[data-message-author-role]");
	if (!message) return null;
	const candidates = Array.from(document.querySelectorAll<HTMLElement>("*"))
		.filter((element) => {
			if (element.dataset.highlightsUi === "true") return false;
			const style = getComputedStyle(element);
			return (
				element.contains(message) &&
				/(auto|scroll)/.test(style.overflowY) &&
				element.scrollHeight > element.clientHeight + 80 &&
				element.clientHeight > 240
			);
		})
		.sort(
			(left, right) =>
				scoreScroller(right, message) - scoreScroller(left, message),
		);
	const element = candidates[0];
	if (element) {
		return {
			align: (rect) => {
				const viewport = element.getBoundingClientRect();
				element.scrollTo({
					top:
						element.scrollTop +
						(rect.top + rect.height / 2) -
						(viewport.top + viewport.height / 2),
					behavior: "auto",
				});
			},
			read: () => ({
				top: element.scrollTop,
				height: element.scrollHeight,
				viewport: element.clientHeight,
			}),
			scrollTo: (top) => {
				if (top <= 2 && element.scrollTop <= 2) {
					element.scrollTo({ top: 32, behavior: "auto" });
					element.dispatchEvent(
						new WheelEvent("wheel", { bubbles: true, deltaY: -640 }),
					);
					window.requestAnimationFrame(() =>
						element.scrollTo({ top: 0, behavior: "auto" }),
					);
					return;
				}
				element.scrollTo({ top, behavior: "auto" });
			},
		};
	}

	const scrollingElement = document.scrollingElement;
	if (!(scrollingElement instanceof HTMLElement)) return null;
	return {
		align: (rect) =>
			window.scrollBy({
				top: rect.top + rect.height / 2 - window.innerHeight / 2,
				behavior: "auto",
			}),
		read: () => ({
			top: scrollingElement.scrollTop,
			height: scrollingElement.scrollHeight,
			viewport: window.innerHeight,
		}),
		scrollTo: (top) => {
			if (top <= 2 && window.scrollY <= 2) {
				window.scrollTo({ top: 32, behavior: "auto" });
				window.dispatchEvent(
					new WheelEvent("wheel", { bubbles: true, deltaY: -640 }),
				);
				window.requestAnimationFrame(() =>
					window.scrollTo({ top: 0, behavior: "auto" }),
				);
				return;
			}
			window.scrollTo({ top, behavior: "auto" });
		},
	};
}

function revealInScroller(
	target: HighlightRecord,
	records: HighlightRecord[],
	scroller: ConversationScroller,
) {
	reapplyMissingHighlights(records);
	reanchorHighlightForNavigation(target);
	const rect = getRenderedHighlightRect(target.id);
	if (!rect) return false;
	scroller.align(rect);
	return true;
}

function waitForConversationReady(timeoutMs = 15_000) {
	if (document.querySelector("[data-message-author-role]")) {
		return Promise.resolve(true);
	}
	return new Promise<boolean>((resolve) => {
		let settled = false;
		const finish = (ready: boolean) => {
			if (settled) return;
			settled = true;
			observer.disconnect();
			window.clearTimeout(timeout);
			resolve(ready);
		};
		const observer = new MutationObserver(() => {
			if (document.querySelector("[data-message-author-role]")) finish(true);
		});
		observer.observe(document.body, { childList: true, subtree: true });
		const timeout = window.setTimeout(() => finish(false), timeoutMs);
	});
}

function scoreScroller(element: HTMLElement, message: Element | null) {
	return (
		element.clientHeight * element.clientWidth +
		(message && element.contains(message) ? 10_000_000 : 0)
	);
}

function waitForConversationRender() {
	return new Promise<void>((resolve) => window.setTimeout(resolve, 350));
}

function showLoadingStatus() {
	const existing = document.getElementById("highlights-deep-link-status");
	if (existing instanceof HTMLElement) return existing;
	const status = document.createElement("div");
	status.id = "highlights-deep-link-status";
	status.dataset.highlightsUi = "true";
	status.setAttribute("role", "status");
	status.textContent = "Loading earlier messages…";
	Object.assign(status.style, {
		position: "fixed",
		top: "18px",
		left: "50%",
		zIndex: "2147483600",
		transform: "translateX(-50%)",
		border: "1px solid var(--border-light, rgba(0, 0, 0, .08))",
		borderRadius: "999px",
		padding: "8px 13px",
		color: "var(--text-primary, #0d0d0d)",
		background: "var(--main-surface-primary, #fff)",
		boxShadow: "0 5px 18px rgba(0, 0, 0, .1)",
		fontFamily: "inherit",
		fontSize: "13px",
		fontWeight: "500",
		lineHeight: "1.2",
	});
	document.body.appendChild(status);
	return status;
}

function showFailureStatus(status: HTMLElement) {
	status.textContent = "This highlight could not be loaded";
	window.setTimeout(() => status.remove(), 5000);
}

function wait(delay: number) {
	return new Promise<void>((resolve) => window.setTimeout(resolve, delay));
}
