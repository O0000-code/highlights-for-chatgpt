import { type CapturedAnchor, captureSelectionAnchor } from "./anchors";

const UI_ATTRIBUTE = "data-highlights-ui";
const STYLE_ID = "highlights-selection-toolbar-style";
const ACTION_ID = "highlights-native-action";
const FALLBACK_ID = "highlights-selection-fallback";
const NATIVE_ACTION_LABELS = [
	"ask chatgpt",
	"start writing",
	"询问 chatgpt",
	"开始写作",
];

interface NativeToolbarTarget {
	toolbar: HTMLElement;
	referenceButton: HTMLElement;
	referenceChild: HTMLElement;
}

interface SelectionRect extends DOMRect {
	centerY: number;
}

type CaptureHandler = (capture: CapturedAnchor) => Promise<boolean>;

let captureHandler: CaptureHandler | undefined;
let nativeAction: HTMLButtonElement | null = null;
let fallbackAction: HTMLButtonElement | null = null;
let toolbarObserver: MutationObserver | null = null;
let fallbackTimer: number | undefined;
let observerTimer: number | undefined;
let latestCapture: CapturedAnchor | null = null;
let selectionRect: SelectionRect | null = null;

export function initSelectionToolbar(handler: CaptureHandler) {
	captureHandler = handler;
	ensureStyles();
	document.addEventListener("mouseup", handleSelectionEvent);
	document.addEventListener("keyup", handleSelectionEvent);
	document.addEventListener("mousedown", handleOutsidePointerDown);
}

export function dismissSelectionToolbar() {
	nativeAction?.remove();
	fallbackAction?.remove();
	nativeAction = null;
	fallbackAction = null;
	latestCapture = null;
	selectionRect = null;
	stopToolbarObserver();
}

function handleSelectionEvent(event: Event) {
	const target = event.target;
	if (target instanceof Element && target.closest(`[${UI_ATTRIBUTE}='true']`)) {
		return;
	}
	if (isEditingText()) return;

	const selection = window.getSelection();
	if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
		dismissSelectionToolbar();
		return;
	}

	const range = selection.getRangeAt(0);
	const containingElement =
		range.commonAncestorContainer instanceof Element
			? range.commonAncestorContainer
			: range.commonAncestorContainer.parentElement;
	if (!containingElement?.closest("article, [data-message-author-role]")) {
		dismissSelectionToolbar();
		return;
	}

	const capture = captureSelectionAnchor(selection);
	if (!capture) {
		dismissSelectionToolbar();
		return;
	}

	latestCapture = capture;
	selectionRect = getRangeRect(range);
	nativeAction?.remove();
	fallbackAction?.remove();
	nativeAction = null;
	fallbackAction = null;

	if (!attachToNativeToolbar()) watchForNativeToolbar();
}

function handleOutsidePointerDown(event: MouseEvent) {
	const target = event.target;
	if (
		target instanceof Node &&
		(nativeAction?.contains(target) || fallbackAction?.contains(target))
	) {
		return;
	}
	fallbackAction?.remove();
	fallbackAction = null;
}

function watchForNativeToolbar() {
	stopToolbarObserver();
	toolbarObserver = new MutationObserver(() => {
		if (!latestCapture) return;
		if (attachToNativeToolbar()) clearFallbackTimer();
	});
	toolbarObserver.observe(document.body, { childList: true, subtree: true });
	fallbackTimer = window.setTimeout(() => {
		if (!nativeAction?.isConnected) showFallbackAction();
	}, 450);
	observerTimer = window.setTimeout(stopToolbarObserver, 3500);
}

function attachToNativeToolbar() {
	if (!latestCapture) return false;
	if (nativeAction?.isConnected) return true;
	const target = findNativeToolbarTarget();
	if (!target) return false;

	const button = document.createElement("button");
	button.id = ACTION_ID;
	button.type = "button";
	button.dataset.highlightsUi = "true";
	button.title = getLocalizedLabel("Highlight", "高亮");
	button.setAttribute("aria-label", button.title);
	if (target.referenceButton.className) {
		button.className = target.referenceButton.className;
	}
	Object.assign(button.style, {
		alignSelf: "stretch",
		alignItems: "center",
		borderInlineStart: findNativeSeparator(
			target.toolbar,
			target.referenceChild,
		),
		display: "inline-flex",
		justifyContent: "center",
		whiteSpace: "nowrap",
	});
	const label = document.createElement("span");
	label.dataset.highlightsUi = "true";
	label.textContent = button.title;
	button.appendChild(label);
	bindCaptureAction(button);

	target.referenceChild.insertAdjacentElement("afterend", button);
	nativeAction = button;
	return true;
}

function findNativeToolbarTarget(): NativeToolbarTarget | null {
	const buttons = Array.from(
		document.querySelectorAll<HTMLElement>("button, [role='button']"),
	).filter((element) => {
		if (element.closest(`[${UI_ATTRIBUTE}='true']`)) return false;
		if (!isElementUsable(element)) return false;
		const label = normalizeLabel(element.textContent ?? "");
		return NATIVE_ACTION_LABELS.some((candidate) => label.includes(candidate));
	});
	if (buttons.length === 0) return null;

	const activeSelectionRect = selectionRect;
	const nearbyButtons = activeSelectionRect
		? buttons.filter((button) => {
				const rect = button.getBoundingClientRect();
				return (
					Math.abs(rect.top + rect.height / 2 - activeSelectionRect.centerY) <
					180
				);
			})
		: buttons;
	const candidates = nearbyButtons.length > 0 ? nearbyButtons : buttons;
	const referenceButton = [...candidates]
		.sort(
			(left, right) =>
				left.getBoundingClientRect().left - right.getBoundingClientRect().left,
		)
		.at(-1);
	if (!referenceButton) return null;

	const toolbar =
		findToolbarContainer(candidates) ?? referenceButton.parentElement;
	if (!toolbar || toolbar === document.body) return null;
	return {
		toolbar,
		referenceButton,
		referenceChild: directChildOf(toolbar, referenceButton) ?? referenceButton,
	};
}

function findToolbarContainer(buttons: HTMLElement[]) {
	let candidate = commonAncestor(buttons) ?? buttons[0]?.parentElement ?? null;
	while (candidate && candidate !== document.body) {
		const rect = candidate.getBoundingClientRect();
		const controls = candidate.querySelectorAll(
			"button, [role='button']",
		).length;
		const text = normalizeLabel(candidate.textContent ?? "");
		if (
			rect.height < 140 &&
			controls <= 8 &&
			NATIVE_ACTION_LABELS.some((label) => text.includes(label))
		) {
			return candidate;
		}
		candidate = candidate.parentElement;
	}
	return null;
}

function commonAncestor(elements: HTMLElement[]) {
	const [first, ...rest] = elements;
	if (!first) return null;
	let candidate: HTMLElement | null = first;
	while (candidate) {
		if (rest.every((element) => candidate?.contains(element))) return candidate;
		candidate = candidate.parentElement;
	}
	return null;
}

function directChildOf(parent: HTMLElement, descendant: HTMLElement) {
	let child: HTMLElement | null = descendant;
	while (child?.parentElement && child.parentElement !== parent) {
		child = child.parentElement;
	}
	return child?.parentElement === parent ? child : null;
}

function findNativeSeparator(
	toolbar: HTMLElement,
	referenceChild: HTMLElement,
) {
	const referenceStyle = window.getComputedStyle(referenceChild);
	const borderWidth = Number.parseFloat(referenceStyle.borderInlineStartWidth);
	if (
		borderWidth > 0 &&
		borderWidth <= 1.5 &&
		referenceStyle.borderInlineStartStyle === "solid"
	) {
		return `${referenceStyle.borderInlineStartWidth} solid ${referenceStyle.borderInlineStartColor}`;
	}

	const referenceIndex = Array.from(toolbar.children).indexOf(referenceChild);
	for (let index = referenceIndex - 1; index >= 0; index--) {
		const candidate = toolbar.children[index];
		if (!(candidate instanceof HTMLElement)) continue;
		const rect = candidate.getBoundingClientRect();
		if (rect.width > 3 || rect.height < 12) continue;
		const style = window.getComputedStyle(candidate);
		const color =
			style.backgroundColor !== "rgba(0, 0, 0, 0)"
				? style.backgroundColor
				: style.borderInlineStartColor;
		if (color) return `1px solid ${color}`;
	}

	return "1px solid color-mix(in srgb, currentColor 14%, transparent)";
}

function showFallbackAction() {
	if (!latestCapture || !selectionRect) return;
	fallbackAction?.remove();
	const button = document.createElement("button");
	button.id = FALLBACK_ID;
	button.type = "button";
	button.dataset.highlightsUi = "true";
	button.textContent = getLocalizedLabel("Highlight", "高亮");
	button.title = button.textContent;
	button.setAttribute("aria-label", button.title);
	bindCaptureAction(button);
	document.body.appendChild(button);
	fallbackAction = button;

	const rect = button.getBoundingClientRect();
	const padding = 8;
	const gap = 10;
	const left = Math.min(
		Math.max(
			padding,
			selectionRect.left + selectionRect.width / 2 - rect.width / 2,
		),
		window.innerWidth - rect.width - padding,
	);
	let top = selectionRect.top - rect.height - gap;
	if (top < padding) top = selectionRect.bottom + gap;
	button.style.left = `${left}px`;
	button.style.top = `${Math.min(top, window.innerHeight - rect.height - padding)}px`;
}

function bindCaptureAction(button: HTMLButtonElement) {
	button.addEventListener("mousedown", (event) => {
		event.preventDefault();
		event.stopPropagation();
	});
	button.addEventListener("click", async (event) => {
		event.preventDefault();
		event.stopPropagation();
		const capture = latestCapture;
		if (!capture || !captureHandler || button.disabled) return;
		button.disabled = true;
		const saved = await captureHandler(capture).catch((error: unknown) => {
			console.error("Could not save the highlight", error);
			return false;
		});
		if (saved) {
			window.getSelection()?.removeAllRanges();
			dismissSelectionToolbar();
		} else {
			button.disabled = false;
		}
	});
}

function getRangeRect(range: Range) {
	const rect = range.getBoundingClientRect();
	return {
		...rect.toJSON?.(),
		bottom: rect.bottom,
		centerY: rect.top + rect.height / 2,
		height: rect.height,
		left: rect.left,
		right: rect.right,
		top: rect.top,
		width: rect.width,
	} as SelectionRect;
}

function isElementUsable(element: HTMLElement) {
	const style = window.getComputedStyle(element);
	return (
		element.isConnected &&
		style.display !== "none" &&
		style.visibility !== "hidden" &&
		style.pointerEvents !== "none"
	);
}

function isEditingText() {
	const active = document.activeElement;
	return (
		active instanceof HTMLInputElement ||
		active instanceof HTMLTextAreaElement ||
		active?.getAttribute("contenteditable") === "true"
	);
}

function normalizeLabel(value: string) {
	return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function getLocalizedLabel(english: string, chinese: string) {
	return document.documentElement.lang.toLowerCase().startsWith("zh")
		? chinese
		: english;
}

function clearFallbackTimer() {
	if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
	fallbackTimer = undefined;
}

function stopToolbarObserver() {
	clearFallbackTimer();
	if (observerTimer !== undefined) window.clearTimeout(observerTimer);
	observerTimer = undefined;
	toolbarObserver?.disconnect();
	toolbarObserver = null;
}

function ensureStyles() {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.dataset.highlightsUi = "true";
	style.textContent = `
		#${ACTION_ID}:disabled { cursor: wait; opacity: .62; }
		#${FALLBACK_ID} {
			position: fixed;
			z-index: 2147483646;
			box-sizing: border-box;
			padding: 8px 13px;
			border: 1px solid var(--border-light, rgba(0, 0, 0, .11));
			border-radius: 10px;
			background: var(--main-surface-primary, #fff);
			box-shadow: 0 2px 8px rgba(0, 0, 0, .08), 0 1px 2px rgba(0, 0, 0, .04);
			color: var(--text-primary, #0d0d0d);
			font: inherit;
			font-size: 14px;
			line-height: 20px;
			cursor: pointer;
		}
		.dark #${FALLBACK_ID}, [data-theme='dark'] #${FALLBACK_ID} {
			border-color: var(--border-light, rgba(255, 255, 255, .12));
			background: var(--main-surface-primary, #212121);
			color: var(--text-primary, #f2f2f2);
			box-shadow: 0 4px 14px rgba(0, 0, 0, .3), 0 1px 2px rgba(0, 0, 0, .2);
		}
		#${FALLBACK_ID}:hover { background: var(--surface-hover, rgba(0, 0, 0, .05)); }
		#${FALLBACK_ID}:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
	`;
	(document.head ?? document.documentElement).appendChild(style);
}
