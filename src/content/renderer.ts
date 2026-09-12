import {
	HIGHLIGHT_COLOR_TOKENS,
	HIGHLIGHT_COLORS,
	type HighlightColor,
} from "../shared/colors";
import type { HighlightRecord } from "../shared/types";
import { findBestRange, normalizeRangeText } from "./anchors";

export const HIGHLIGHTS_CHANGED_EVENT = "highlights:changed";

const STYLE_ID = "highlights-native-paint-style";
const ACTIVE_NAME = "highlights-active";
const NAMES: Record<HighlightColor, string> = {
	yellow: "highlights-yellow",
	green: "highlights-green",
	blue: "highlights-blue",
	pink: "highlights-pink",
};

interface NativeHighlight extends Iterable<Range> {}

interface HighlightRegistry {
	delete(name: string): boolean;
	get(name: string): NativeHighlight | undefined;
	set(name: string, highlight: NativeHighlight): void;
}

interface HighlightApi {
	Highlight: new (...ranges: Range[]) => NativeHighlight;
	registry: HighlightRegistry;
}

interface RenderedHighlight {
	record: HighlightRecord;
	range: Range;
}

export interface NavigationHighlight extends HighlightRecord {
	range: Range;
}

const rendered = new Map<string, RenderedHighlight>();
let activeTimer: ReturnType<typeof setTimeout> | undefined;
let unsupportedWarningShown = false;

export function supportsNativeHighlights() {
	return getHighlightApi() !== null;
}

export function renderHighlight(
	record: HighlightRecord,
	preferredRange?: Range,
) {
	const api = getHighlightApi();
	if (!api) {
		if (!unsupportedWarningShown) {
			console.warn(
				"Highlights requires support for the CSS Custom Highlight API.",
			);
			unsupportedWarningShown = true;
		}
		return false;
	}

	const range =
		preferredRange?.cloneRange() ??
		findBestRange(document.body, record.text, record);
	if (!range || !rangeMatchesRecord(range, record)) return false;

	rendered.set(record.id, { record, range });
	renderAll();
	return true;
}

export function reapplyMissingHighlights(records: HighlightRecord[]) {
	let restored = 0;
	for (const record of records) {
		const existing = rendered.get(record.id);
		if (existing && isRenderedHighlightValid(existing)) continue;
		rendered.delete(record.id);
		if (renderHighlight(record)) restored++;
	}
	return restored;
}

export function clearRenderedHighlights() {
	rendered.clear();
	if (activeTimer) clearTimeout(activeTimer);
	const api = getHighlightApi();
	for (const name of Object.values(NAMES)) api?.registry.delete(name);
	api?.registry.delete(ACTIVE_NAME);
	notifyChange();
}

export function removeRenderedHighlight(id: string) {
	const removed = rendered.delete(id);
	if (removed) renderAll();
	return removed;
}

export function updateRenderedHighlightColor(
	id: string,
	color: HighlightColor,
) {
	const current = rendered.get(id);
	if (!current) return false;
	current.record = { ...current.record, color, updatedAt: Date.now() };
	renderAll();
	return true;
}

export function findHighlightAtPoint(clientX: number, clientY: number) {
	return (
		Array.from(rendered.values())
			.filter(
				(item) =>
					isRenderedHighlightValid(item) &&
					Array.from(item.range.getClientRects()).some(
						(rect) =>
							rect.width > 0 &&
							rect.height > 0 &&
							clientX >= rect.left &&
							clientX <= rect.right &&
							clientY >= rect.top &&
							clientY <= rect.bottom,
					),
			)
			.sort(
				(left, right) => left.record.text.length - right.record.text.length,
			)[0]?.record ?? null
	);
}

export function getNavigationHighlights(): NavigationHighlight[] {
	return Array.from(rendered.values())
		.filter(isRenderedHighlightValid)
		.map(({ record, range }) => ({ ...record, range }))
		.sort((left, right) =>
			left.range.compareBoundaryPoints(Range.START_TO_START, right.range),
		);
}

export function scrollToRenderedHighlight(id: string) {
	const item = rendered.get(id);
	if (!item || !isRenderedHighlightValid(item)) return false;
	const rect = firstLayoutRect(item.range);
	if (!rect) return false;
	const target =
		item.range.startContainer instanceof Element
			? item.range.startContainer
			: item.range.startContainer.parentElement;
	const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		? "auto"
		: "smooth";
	const scroller = findScrollableAncestor(target);
	if (scroller) {
		const scrollerRect = scroller.getBoundingClientRect();
		scroller.scrollTo({
			top:
				scroller.scrollTop +
				(rect.top + rect.height / 2) -
				(scrollerRect.top + scroller.clientHeight / 2),
			behavior,
		});
	} else {
		window.scrollBy({
			top: rect.top + rect.height / 2 - window.innerHeight / 2,
			behavior,
		});
	}
	flashRange(item.range);
	return true;
}

export function reanchorHighlightForNavigation(record: HighlightRecord) {
	const range = findBestRange(
		document.body,
		record.text,
		record,
		hasLayoutRect,
	);
	if (!range) return false;
	rendered.delete(record.id);
	return renderHighlight(record, range);
}

export function getRenderedHighlightRect(id: string) {
	const item = rendered.get(id);
	return item && isRenderedHighlightValid(item)
		? firstLayoutRect(item.range)
		: null;
}

function renderAll() {
	const api = getHighlightApi();
	if (!api) return;
	ensureStyles();
	const ranges = new Map<HighlightColor, Range[]>(
		HIGHLIGHT_COLORS.map((color) => [color, []]),
	);
	for (const [id, item] of rendered) {
		if (!isRenderedHighlightValid(item)) {
			rendered.delete(id);
			continue;
		}
		ranges.get(item.record.color)?.push(item.range);
	}

	for (const color of HIGHLIGHT_COLORS) {
		const colorRanges = ranges.get(color) ?? [];
		if (colorRanges.length === 0) api.registry.delete(NAMES[color]);
		else api.registry.set(NAMES[color], new api.Highlight(...colorRanges));
	}
	notifyChange();
}

function flashRange(range: Range) {
	const api = getHighlightApi();
	if (!api) return;
	ensureStyles();
	if (activeTimer) clearTimeout(activeTimer);
	api.registry.set(ACTIVE_NAME, new api.Highlight(range));
	activeTimer = setTimeout(() => {
		api.registry.delete(ACTIVE_NAME);
		activeTimer = undefined;
	}, 900);
}

function isRenderedHighlightValid(item: RenderedHighlight) {
	return (
		item.range.startContainer.isConnected &&
		item.range.endContainer.isConnected &&
		rangeMatchesRecord(item.range, item.record)
	);
}

function rangeMatchesRecord(range: Range, record: HighlightRecord) {
	return (
		normalizeRangeText(range.toString()) === normalizeRangeText(record.text)
	);
}

function hasLayoutRect(range: Range) {
	return firstLayoutRect(range) !== null;
}

function firstLayoutRect(range: Range) {
	return (
		Array.from(range.getClientRects()).find(
			(rect) => rect.width > 0 && rect.height > 0,
		) ?? null
	);
}

function findScrollableAncestor(start: Element | null) {
	let current = start?.parentElement ?? null;
	while (current && current !== document.body) {
		const style = getComputedStyle(current);
		if (
			/(auto|scroll)/.test(style.overflowY) &&
			current.scrollHeight > current.clientHeight + 2
		) {
			return current;
		}
		current = current.parentElement;
	}
	return null;
}

function getHighlightApi(): HighlightApi | null {
	const globals = globalThis as typeof globalThis & {
		CSS?: { highlights?: HighlightRegistry };
		Highlight?: new (...ranges: Range[]) => NativeHighlight;
	};
	return globals.CSS?.highlights && globals.Highlight
		? { registry: globals.CSS.highlights, Highlight: globals.Highlight }
		: null;
}

function ensureStyles() {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.dataset.highlightsUi = "true";
	style.textContent = `
		::highlight(${NAMES.yellow}) { background-color: ${HIGHLIGHT_COLOR_TOKENS.yellow.fill}; }
		::highlight(${NAMES.green}) { background-color: ${HIGHLIGHT_COLOR_TOKENS.green.fill}; }
		::highlight(${NAMES.blue}) { background-color: ${HIGHLIGHT_COLOR_TOKENS.blue.fill}; }
		::highlight(${NAMES.pink}) { background-color: ${HIGHLIGHT_COLOR_TOKENS.pink.fill}; }
		::highlight(${ACTIVE_NAME}) { background-color: rgba(127, 127, 127, 0.18); }
	`;
	(document.head ?? document.documentElement).appendChild(style);
}

function notifyChange() {
	document.dispatchEvent(new Event(HIGHLIGHTS_CHANGED_EVENT));
}
