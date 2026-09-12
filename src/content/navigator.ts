import { HIGHLIGHT_COLOR_TOKENS } from "../shared/colors";
import {
	getNavigationHighlights,
	HIGHLIGHTS_CHANGED_EVENT,
	type NavigationHighlight,
	scrollToRenderedHighlight,
} from "./renderer";

const NAVIGATOR_ID = "highlights-navigator";
const MENU_ID = "highlights-navigator-menu";
const STYLE_ID = "highlights-navigator-style";
const MAXIMUM_HEIGHT = 520;
const VIEWPORT_GUTTER = 32;
const MINIMUM_HEIGHT = 10;
const VERTICAL_PADDING = 4;
const NATURAL_PITCH = 10;
const NAVIGATOR_WIDTH = 36;
const DEFAULT_RIGHT_INSET = 16;
const NATIVE_RAIL_EDGE_LIMIT = 96;
const NATIVE_RAIL_MAXIMUM_WIDTH = 72;
const NATIVE_RAIL_MAXIMUM_MARKER_HEIGHT = 8;
const NATIVE_MARKER_ATTRIBUTE = "data-highlights-native-marker";
const NATIVE_MENU_ITEM_ATTRIBUTE = "data-highlights-native-menu-item";

interface NativePromptNavigator {
	root: HTMLElement;
	stack: HTMLElement;
	promptButtons: HTMLButtonElement[];
}

let navigatorElement: HTMLElement | null = null;
let rail: HTMLElement | null = null;
let menu: HTMLElement | null = null;
let menuList: HTMLElement | null = null;
let items: NavigationHighlight[] = [];
let positions: number[] = [];
let activeIndex = -1;
let renderFrame: number | null = null;
let activeFrame: number | null = null;
let integrationTimer: number | null = null;
let closeMenuTimer: number | null = null;
let documentObserver: MutationObserver | null = null;
let nativeObserver: MutationObserver | null = null;
let observedNativeRoot: HTMLElement | null = null;

export function initHighlightNavigator() {
	ensureStyles();
	ensureFallbackNavigator();
	document.addEventListener(HIGHLIGHTS_CHANGED_EVENT, scheduleRender);
	window.addEventListener("resize", scheduleRender);
	window.addEventListener("scroll", scheduleActiveUpdate, true);
	document.addEventListener("keydown", handleDocumentKeydown);
	document.addEventListener("pointerdown", handleDocumentPointerDown, true);
	observeDocument();
	renderNavigator();
}

export function refreshHighlightNavigator() {
	scheduleRender();
}

export function layoutMarkerStack(
	count: number,
	maximumHeight: number,
	padding = VERTICAL_PADDING,
) {
	if (count <= 0) return { height: 0, pitch: 0, positions: [] as number[] };
	const safeMaximum = Math.max(MINIMUM_HEIGHT, maximumHeight);
	const available = Math.max(0, safeMaximum - padding * 2 - 2);
	const pitch =
		count === 1 ? 0 : Math.min(NATURAL_PITCH, available / (count - 1));
	const contentHeight = pitch * Math.max(0, count - 1) + 2;
	const height = Math.max(
		MINIMUM_HEIGHT,
		Math.min(safeMaximum, contentHeight + padding * 2),
	);
	const start = (height - contentHeight) / 2 + 1;
	return {
		height,
		pitch,
		positions: Array.from(
			{ length: count },
			(_, index) => start + pitch * index,
		),
	};
}

export function insertionSlotForNode(node: Node, promptElements: Element[]) {
	let slot = 0;
	for (const prompt of promptElements) {
		const relation = prompt.compareDocumentPosition(node);
		if (prompt.contains(node) || relation & Node.DOCUMENT_POSITION_FOLLOWING) {
			slot++;
		}
	}
	return slot;
}

function ensureFallbackNavigator() {
	ensureStyles();
	if (
		navigatorElement?.isConnected &&
		navigatorElement.ownerDocument === document
	) {
		return;
	}

	navigatorElement = document.createElement("nav");
	navigatorElement.id = NAVIGATOR_ID;
	navigatorElement.dataset.highlightsUi = "true";
	navigatorElement.setAttribute(
		"aria-label",
		getLocalizedLabel("Highlight navigation", "高亮导航"),
	);

	rail = document.createElement("div");
	rail.className = "highlights-navigator-rail";
	rail.dataset.highlightsUi = "true";
	rail.setAttribute("role", "toolbar");
	rail.addEventListener("pointerenter", openFallbackMenu);
	rail.addEventListener("pointerleave", scheduleCloseFallbackMenu);
	rail.addEventListener("click", handleMarkerClick);
	navigatorElement.appendChild(rail);

	menu = document.createElement("div");
	menu.id = MENU_ID;
	menu.dataset.highlightsUi = "true";
	menu.hidden = true;
	menu.setAttribute("role", "menu");
	menu.addEventListener("pointerenter", cancelCloseFallbackMenu);
	menu.addEventListener("pointerleave", scheduleCloseFallbackMenu);

	menuList = document.createElement("ul");
	menuList.dataset.highlightsUi = "true";
	menu.appendChild(menuList);
	navigatorElement.appendChild(menu);
	document.body.appendChild(navigatorElement);
}

function observeDocument() {
	documentObserver?.disconnect();
	documentObserver = new MutationObserver((mutations) => {
		if (mutations.some(mutationContainsExternalNodes)) {
			scheduleNativeIntegration();
		}
	});
	documentObserver.observe(document.body, { childList: true, subtree: true });
}

function observeNativeRoot(root: HTMLElement) {
	if (observedNativeRoot === root && nativeObserver) return;
	nativeObserver?.disconnect();
	observedNativeRoot = root;
	nativeObserver = new MutationObserver((mutations) => {
		if (mutations.some(mutationContainsExternalNodes)) {
			scheduleNativeIntegration();
		}
	});
	nativeObserver.observe(root, {
		attributes: true,
		attributeFilter: ["class", "style", "aria-hidden"],
		childList: true,
		subtree: true,
	});
}

function mutationContainsExternalNodes(mutation: MutationRecord) {
	if (mutation.type === "attributes") {
		return !isHighlightsUiNode(mutation.target);
	}
	const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
	return changedNodes.some(
		(node) => node instanceof Element && !isHighlightsUiNode(node),
	);
}

function isHighlightsUiNode(node: Node) {
	if (!(node instanceof Element)) return false;
	return (
		node.matches("[data-highlights-ui='true']") ||
		Boolean(node.closest("[data-highlights-ui='true']"))
	);
}

function scheduleRender() {
	if (renderFrame !== null) return;
	renderFrame = window.requestAnimationFrame(() => {
		renderFrame = null;
		renderNavigator();
	});
}

function scheduleNativeIntegration() {
	if (integrationTimer !== null) return;
	integrationTimer = window.setTimeout(() => {
		integrationTimer = null;
		synchronizeNavigator();
	}, 24);
}

function renderNavigator() {
	ensureFallbackNavigator();
	items = getNavigationHighlights();
	activeIndex = findActiveIndex();
	synchronizeNavigator();
}

function synchronizeNavigator() {
	ensureFallbackNavigator();
	removeIntegratedNodes();

	if (items.length === 0) {
		if (navigatorElement) navigatorElement.hidden = true;
		closeFallbackMenu();
		return;
	}

	const nativeNavigator = findNativePromptNavigator();
	if (nativeNavigator) {
		if (navigatorElement) navigatorElement.hidden = true;
		closeFallbackMenu();
		observeNativeRoot(nativeNavigator.root);
		integrateWithNativeNavigator(nativeNavigator);
		return;
	}

	nativeObserver?.disconnect();
	nativeObserver = null;
	observedNativeRoot = null;
	renderFallbackNavigator();
}

function findNativePromptNavigator(): NativePromptNavigator | null {
	const groupedMarkers = new Map<
		HTMLElement,
		{ stack: HTMLElement; buttons: HTMLButtonElement[] }
	>();

	for (const button of document.querySelectorAll<HTMLButtonElement>("button")) {
		if (button.closest("[data-highlights-ui='true']")) continue;
		const markerRect = button.getBoundingClientRect();
		if (
			markerRect.width < 6 ||
			markerRect.width > 44 ||
			markerRect.height < 1 ||
			markerRect.height > NATIVE_RAIL_MAXIMUM_MARKER_HEIGHT ||
			markerRect.right < window.innerWidth - NATIVE_RAIL_EDGE_LIMIT
		) {
			continue;
		}

		const root = getFixedAncestor(button);
		const stack = button.parentElement;
		if (!root || !stack) continue;
		const group = groupedMarkers.get(root);
		if (group?.stack === stack) group.buttons.push(button);
		else groupedMarkers.set(root, { stack, buttons: [button] });
	}

	let best: {
		root: HTMLElement;
		stack: HTMLElement;
		buttons: HTMLButtonElement[];
		score: number;
	} | null = null;

	for (const [root, group] of groupedMarkers) {
		const rect = root.getBoundingClientRect();
		const className = String(root.className);
		const hasNativePositionSignature =
			className.includes("top-1/2") &&
			(className.includes("inset-e-") || className.includes("right-"));
		if (
			rect.width < 12 ||
			rect.width > NATIVE_RAIL_MAXIMUM_WIDTH ||
			rect.height <= 0 ||
			rect.height > Math.min(MAXIMUM_HEIGHT, window.innerHeight * 0.7) ||
			rect.left < window.innerWidth - NATIVE_RAIL_EDGE_LIMIT ||
			(group.buttons.length < 2 && !hasNativePositionSignature)
		) {
			continue;
		}

		const verticalOffset = Math.abs(
			(rect.top + rect.bottom) / 2 - window.innerHeight / 2,
		);
		if (verticalOffset > window.innerHeight * 0.2) continue;
		const semanticButtons = group.buttons.filter((button) =>
			/^Prompt \d+$/.test(button.getAttribute("aria-label") ?? ""),
		).length;
		const score =
			group.buttons.length * 10 +
			semanticButtons * 20 +
			(hasNativePositionSignature ? 100 : 0);
		if (!best || score > best.score) {
			best = { root, stack: group.stack, buttons: group.buttons, score };
		}
	}

	if (!best) return null;
	best.buttons.sort(
		(left, right) =>
			left.getBoundingClientRect().top - right.getBoundingClientRect().top,
	);
	return {
		root: best.root,
		stack: best.stack,
		promptButtons: best.buttons,
	};
}

function integrateWithNativeNavigator(nativeNavigator: NativePromptNavigator) {
	const promptElements = getPromptElements();
	const popupList = findNativePopupList(nativeNavigator.root);
	const nativeListItems = popupList
		? Array.from(popupList.children).filter(
				(child): child is HTMLElement =>
					child instanceof HTMLElement &&
					!child.matches(`[${NATIVE_MENU_ITEM_ATTRIBUTE}]`),
			)
		: [];
	const promptTexts = nativeListItems.map(
		(item) =>
			item.querySelector("button")?.textContent ?? item.textContent ?? "",
	);
	const insertionSlots = resolveInsertionSlots(
		items,
		promptElements,
		promptTexts,
		nativeNavigator.promptButtons.length,
	);

	for (const [index, item] of items.entries()) {
		const marker = createIntegratedMarker(item, index);
		const reference = nativeNavigator.promptButtons[insertionSlots[index] ?? 0];
		nativeNavigator.stack.insertBefore(marker, reference ?? null);
	}

	if (!popupList) return;
	const nativeMenuButton = nativeListItems
		.map((item) => item.querySelector<HTMLButtonElement>("button"))
		.find(Boolean);

	for (const [index, item] of items.entries()) {
		const menuItem = createIntegratedMenuItem(
			item,
			index,
			nativeMenuButton?.className,
		);
		const reference = nativeListItems[insertionSlots[index] ?? 0];
		popupList.insertBefore(menuItem, reference ?? null);
	}
}

function resolveInsertionSlots(
	navigationItems: NavigationHighlight[],
	promptElements: HTMLElement[],
	promptTexts: string[],
	nativePromptCount: number,
) {
	const promptSlots = matchPromptElementsToNativeRows(
		promptElements,
		promptTexts,
	);
	return navigationItems.map((item) => {
		const prompt = findPrecedingPrompt(
			item.range.startContainer,
			promptElements,
		);
		const matchedSlot = prompt ? promptSlots.get(prompt) : undefined;
		if (matchedSlot !== undefined) return matchedSlot;
		return clamp(
			insertionSlotForNode(item.range.startContainer, promptElements),
			0,
			nativePromptCount,
		);
	});
}

function matchPromptElementsToNativeRows(
	promptElements: HTMLElement[],
	promptTexts: string[],
) {
	const slots = new Map<HTMLElement, number>();
	if (promptTexts.length === 0) return slots;
	const normalizedRows = promptTexts.map(normalizeText);
	let searchStart = 0;

	for (const prompt of promptElements) {
		const normalizedPrompt = normalizeText(prompt.textContent ?? "");
		if (!normalizedPrompt) continue;
		let match = findMatchingPromptRow(
			normalizedPrompt,
			normalizedRows,
			searchStart,
		);
		if (match < 0 && searchStart > 0) {
			match = findMatchingPromptRow(normalizedPrompt, normalizedRows, 0);
		}
		if (match < 0) continue;
		slots.set(prompt, match + 1);
		searchStart = match + 1;
	}
	return slots;
}

function findMatchingPromptRow(
	prompt: string,
	rows: string[],
	startIndex: number,
) {
	for (let index = startIndex; index < rows.length; index++) {
		const row = rows[index] ?? "";
		if (!row) continue;
		if (row === prompt || row.includes(prompt) || prompt.includes(row)) {
			return index;
		}
	}
	return -1;
}

function findPrecedingPrompt(node: Node, promptElements: HTMLElement[]) {
	let preceding: HTMLElement | null = null;
	for (const prompt of promptElements) {
		const relation = prompt.compareDocumentPosition(node);
		if (prompt.contains(node) || relation & Node.DOCUMENT_POSITION_FOLLOWING) {
			preceding = prompt;
		}
	}
	return preceding;
}

function createIntegratedMarker(item: NavigationHighlight, index: number) {
	const marker = document.createElement("button");
	marker.type = "button";
	marker.dataset.highlightsUi = "true";
	marker.dataset.highlightId = item.id;
	marker.dataset.highlightIndex = String(index);
	marker.dataset.active = String(index === activeIndex);
	marker.setAttribute(NATIVE_MARKER_ATTRIBUTE, "true");
	marker.style.setProperty(
		"--highlights-marker-color",
		HIGHLIGHT_COLOR_TOKENS[item.color].marker,
	);
	marker.setAttribute(
		"aria-label",
		getLocalizedLabel(
			`Highlight ${index + 1} of ${items.length}: ${shorten(item.text, 90)}`,
			`第 ${index + 1} 处高亮，共 ${items.length} 处：${shorten(item.text, 90)}`,
		),
	);
	marker.addEventListener("click", handleMarkerClick);
	return marker;
}

function createIntegratedMenuItem(
	item: NavigationHighlight,
	index: number,
	nativeButtonClassName?: string,
) {
	const listItem = document.createElement("li");
	listItem.dataset.highlightsUi = "true";
	listItem.dataset.highlightId = item.id;
	listItem.dataset.highlightIndex = String(index);
	listItem.setAttribute(NATIVE_MENU_ITEM_ATTRIBUTE, "true");

	const button = document.createElement("button");
	button.type = "button";
	button.className = `${nativeButtonClassName ?? "group __menu-item hoverable w-full text-start"} highlights-native-menu-button`;
	button.dataset.highlightsUi = "true";
	button.dataset.highlightId = item.id;
	button.dataset.highlightIndex = String(index);
	button.dataset.active = String(index === activeIndex);
	button.setAttribute(
		"aria-label",
		getLocalizedLabel(
			`Highlight: ${shorten(item.text, 120)}`,
			`高亮：${shorten(item.text, 120)}`,
		),
	);
	button.addEventListener("click", handleMarkerClick);

	const row = document.createElement("div");
	row.className = "flex min-w-0 grow items-center gap-2.5";
	row.dataset.highlightsUi = "true";

	const color = document.createElement("span");
	color.className = "highlights-native-menu-color";
	color.dataset.highlightsUi = "true";
	color.style.setProperty(
		"--highlights-marker-color",
		HIGHLIGHT_COLOR_TOKENS[item.color].marker,
	);

	const copy = document.createElement("div");
	copy.className = "highlights-native-menu-copy";
	copy.dataset.highlightsUi = "true";
	copy.textContent = shorten(item.text, 180);

	row.append(color, copy);
	button.appendChild(row);
	listItem.appendChild(button);
	return listItem;
}

function findNativePopupList(root: HTMLElement) {
	let best: { list: HTMLElement; score: number } | null = null;
	for (const list of root.querySelectorAll<HTMLElement>("ul")) {
		if (list.closest("[data-highlights-ui='true']")) continue;
		const rect = list.getBoundingClientRect();
		if (
			rect.width < 180 ||
			rect.width > 360 ||
			rect.height < 24 ||
			rect.right < window.innerWidth - 380
		) {
			continue;
		}
		const menuButtons = Array.from(
			list.querySelectorAll<HTMLButtonElement>(":scope > li > button"),
		).filter((button) => button.getBoundingClientRect().height >= 28);
		if (menuButtons.length === 0) continue;
		const score = menuButtons.length * 10 + (rect.width === 320 ? 50 : 0);
		if (!best || score > best.score) best = { list, score };
	}
	return best?.list ?? null;
}

function removeIntegratedNodes() {
	for (const node of document.querySelectorAll(
		`[${NATIVE_MARKER_ATTRIBUTE}], [${NATIVE_MENU_ITEM_ATTRIBUTE}]`,
	)) {
		node.remove();
	}
}

function renderFallbackNavigator() {
	if (!navigatorElement || !rail || !menuList) return;
	navigatorElement.hidden = false;
	navigatorElement.setAttribute(
		"aria-label",
		getLocalizedLabel(
			`Highlight navigation, ${items.length} ${items.length === 1 ? "highlight" : "highlights"}`,
			`高亮导航，共 ${items.length} 处高亮`,
		),
	);

	const layout = layoutMarkerStack(items.length, getMaximumHeight());
	positions = layout.positions;
	navigatorElement.style.height = `${layout.height}px`;
	const markers = document.createDocumentFragment();
	const menuItems = document.createDocumentFragment();

	for (const [index, item] of items.entries()) {
		const marker = createIntegratedMarker(item, index);
		marker.classList.add("highlights-fallback-marker");
		marker.removeAttribute(NATIVE_MARKER_ATTRIBUTE);
		marker.style.top = `${positions[index] ?? VERTICAL_PADDING}px`;
		markers.appendChild(marker);

		const menuItem = createIntegratedMenuItem(item, index);
		menuItem.removeAttribute(NATIVE_MENU_ITEM_ATTRIBUTE);
		menuItems.appendChild(menuItem);
	}

	rail.replaceChildren(markers);
	menuList.replaceChildren(menuItems);
}

function getPromptElements() {
	return Array.from(
		document.querySelectorAll<HTMLElement>("[data-message-author-role='user']"),
	);
}

function getFixedAncestor(element: HTMLElement) {
	let current = element.parentElement;
	while (current && current !== document.body) {
		if (current.closest("[data-highlights-ui='true']")) return null;
		if (window.getComputedStyle(current).position === "fixed") return current;
		current = current.parentElement;
	}
	return null;
}

function handleMarkerClick(event: MouseEvent) {
	const target = event.currentTarget ?? event.target;
	if (!(target instanceof Element)) return;
	const marker = target.closest<HTMLElement>("[data-highlight-id]");
	const id = marker?.dataset.highlightId;
	if (!id) return;
	event.preventDefault();
	event.stopPropagation();
	scrollToRenderedHighlight(id);
	closeFallbackMenu();
}

function scheduleActiveUpdate() {
	if (activeFrame !== null) return;
	activeFrame = window.requestAnimationFrame(() => {
		activeFrame = null;
		const nextActiveIndex = findActiveIndex();
		if (nextActiveIndex === activeIndex) return;
		activeIndex = nextActiveIndex;
		for (const marker of document.querySelectorAll<HTMLElement>(
			"[data-highlight-index]",
		)) {
			marker.dataset.active = String(
				Number(marker.dataset.highlightIndex) === activeIndex,
			);
		}
	});
}

function findActiveIndex() {
	if (items.length === 0) return -1;
	const viewportCenter = window.innerHeight / 2;
	let nearestIndex = 0;
	let nearestDistance = Number.POSITIVE_INFINITY;
	for (const [index, item] of items.entries()) {
		const rect = getRangeRect(item.range);
		if (!rect) continue;
		const center = rect.top + rect.height / 2;
		const distance = Math.abs(center - viewportCenter);
		if (distance < nearestDistance) {
			nearestIndex = index;
			nearestDistance = distance;
		}
	}
	return nearestIndex;
}

function openFallbackMenu() {
	cancelCloseFallbackMenu();
	if (menu) menu.hidden = false;
}

function scheduleCloseFallbackMenu() {
	cancelCloseFallbackMenu();
	closeMenuTimer = window.setTimeout(closeFallbackMenu, 120);
}

function cancelCloseFallbackMenu() {
	if (closeMenuTimer === null) return;
	window.clearTimeout(closeMenuTimer);
	closeMenuTimer = null;
}

function closeFallbackMenu() {
	cancelCloseFallbackMenu();
	if (menu) menu.hidden = true;
}

function handleDocumentKeydown(event: KeyboardEvent) {
	if (event.key === "Escape") closeFallbackMenu();
}

function handleDocumentPointerDown(event: PointerEvent) {
	if (!navigatorElement?.contains(event.target as Node)) closeFallbackMenu();
}

function getRangeRect(range: Range) {
	const rects = Array.from(range.getClientRects()).filter(
		(rect) => rect.width > 0 && rect.height > 0,
	);
	const first = rects[0];
	const last = rects.at(-1);
	if (!first || !last) return null;
	return { top: first.top, height: last.bottom - first.top };
}

function getMaximumHeight() {
	return Math.min(
		MAXIMUM_HEIGHT,
		Math.max(MINIMUM_HEIGHT, window.innerHeight - VIEWPORT_GUTTER * 2),
	);
}

function shorten(value: string, maximumLength: number) {
	const compact = normalizeText(value);
	return compact.length > maximumLength
		? `${compact.slice(0, maximumLength - 1).trimEnd()}…`
		: compact;
}

function normalizeText(value: string) {
	return value.replace(/\s+/g, " ").trim();
}

function getLocalizedLabel(english: string, chinese: string) {
	return document.documentElement.lang.toLowerCase().startsWith("zh")
		? chinese
		: english;
}

function clamp(value: number, minimum: number, maximum: number) {
	return Math.min(maximum, Math.max(minimum, value));
}

function ensureStyles() {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.dataset.highlightsUi = "true";
	style.textContent = `
		#${NAVIGATOR_ID} {
			position: fixed;
			inset-inline-end: max(${DEFAULT_RIGHT_INSET}px, env(safe-area-inset-right));
			top: 50%;
			z-index: 50;
			width: ${NAVIGATOR_WIDTH}px;
			height: ${MINIMUM_HEIGHT}px;
			transform: translateY(-50%);
			font-family: inherit;
			transition: height 160ms cubic-bezier(.33, 1, .68, 1);
		}
		#${NAVIGATOR_ID}[hidden] { display: none; }
		.highlights-navigator-rail {
			position: absolute;
			inset: 0;
		}
		.highlights-fallback-marker {
			position: absolute;
			left: 9px;
			width: 18px;
			height: 2px;
			padding: 0;
			border: 0;
			border-radius: 999px;
			background: var(--highlights-marker-color);
			opacity: .72;
			cursor: pointer;
			transform: translateY(-50%);
			transition: opacity 120ms ease;
		}
		.highlights-fallback-marker:hover,
		.highlights-fallback-marker[data-active='true'] { opacity: 1; }
		[${NATIVE_MARKER_ATTRIBUTE}] {
			box-sizing: border-box !important;
			width: 18px !important;
			height: 2px !important;
			min-width: 18px !important;
			padding: 0 !important;
			border: 0 !important;
			border-radius: 999px !important;
			background: var(--highlights-marker-color) !important;
			opacity: .72;
			flex-shrink: 0;
			cursor: pointer;
			transition: opacity 120ms ease !important;
		}
		[${NATIVE_MARKER_ATTRIBUTE}]:hover,
		[${NATIVE_MARKER_ATTRIBUTE}][data-active='true'] { opacity: 1; }
		#${MENU_ID} {
			position: absolute;
			inset-inline-end: 0;
			top: 50%;
			box-sizing: border-box;
			width: 320px;
			max-width: calc(100vw - 32px);
			padding: 6px 0;
			border-radius: 16px;
			background: var(--main-surface-primary, #fff);
			box-shadow: 0 8px 12px rgba(0, 0, 0, .08), 0 0 1px rgba(0, 0, 0, .62);
			transform: translateY(-50%);
			animation: highlights-native-menu-in 160ms cubic-bezier(.33, 1, .68, 1);
		}
		#${MENU_ID}[hidden] { display: none; }
		#${MENU_ID} ul {
			display: flex;
			max-height: 50lvh;
			margin: 0;
			padding: 0;
			flex-direction: column;
			overflow-y: auto;
			list-style: none;
		}
		.highlights-native-menu-button {
			display: block;
			box-sizing: border-box;
			width: calc(100% - 12px) !important;
			height: 36px;
			margin: 0 6px;
			padding: 6px 10px !important;
			border: 0;
			border-radius: 10px !important;
			background: transparent;
			color: var(--text-primary, #0d0d0d);
			font: inherit;
			font-size: 14px;
			line-height: 20px;
			text-align: start;
			cursor: pointer;
		}
		.highlights-native-menu-button:hover,
		.highlights-native-menu-button:focus-visible {
			background: var(--surface-secondary, rgba(0, 0, 0, .05));
		}
		.highlights-native-menu-button > div {
			display: flex;
			min-width: 0;
			align-items: center;
			gap: 10px;
		}
		.highlights-native-menu-color {
			display: block;
			width: 8px;
			height: 2px;
			border-radius: 999px;
			background: var(--highlights-marker-color);
			flex: 0 0 auto;
		}
		.highlights-native-menu-copy {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		@keyframes highlights-native-menu-in {
			from { opacity: 0; translate: 4px 0; }
			to { opacity: 1; translate: 0 0; }
		}
		.dark #${MENU_ID}, [data-theme='dark'] #${MENU_ID} {
			background: #353535;
			box-shadow: 0 8px 16px rgba(0, 0, 0, .28), 0 0 1px rgba(255, 255, 255, .22);
		}
		@media (prefers-reduced-motion: reduce) {
			#${NAVIGATOR_ID}, .highlights-fallback-marker,
			[${NATIVE_MARKER_ATTRIBUTE}] { transition: none !important; }
			#${MENU_ID} { animation: none; }
		}
	`;
	(document.head ?? document.documentElement).appendChild(style);
}
