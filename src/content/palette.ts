import {
	HIGHLIGHT_COLOR_TOKENS,
	HIGHLIGHT_COLORS,
	type HighlightColor,
} from "../shared/colors";
import type { HighlightRecord } from "../shared/types";
import { findHighlightAtPoint } from "./renderer";

const PALETTE_ID = "highlights-color-palette";
const STYLE_ID = "highlights-color-palette-style";

interface PaletteHandlers {
	onColorChange(
		record: HighlightRecord,
		color: HighlightColor,
	): Promise<boolean>;
	onRemove(record: HighlightRecord): Promise<boolean>;
}

let handlers: PaletteHandlers | undefined;
let palette: HTMLElement | null = null;

export function initHighlightPalette(nextHandlers: PaletteHandlers) {
	handlers = nextHandlers;
	document.addEventListener("click", handleDocumentClick, true);
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") closeHighlightPalette();
	});
	window.addEventListener("resize", closeHighlightPalette);
	window.addEventListener("scroll", closeHighlightPalette, true);
}

export function closeHighlightPalette() {
	palette?.remove();
	palette = null;
}

function handleDocumentClick(event: MouseEvent) {
	if (
		event.button !== 0 ||
		event.altKey ||
		event.ctrlKey ||
		event.metaKey ||
		event.shiftKey
	) {
		return;
	}

	const target = event.target;
	if (
		!(target instanceof Element) ||
		target.closest("[data-highlights-ui='true']")
	) {
		return;
	}
	const selection = window.getSelection();
	if (selection && !selection.isCollapsed && selection.toString().trim())
		return;

	const record = findHighlightAtPoint(event.clientX, event.clientY);
	if (!record) {
		closeHighlightPalette();
		return;
	}

	event.preventDefault();
	event.stopImmediatePropagation();
	showPalette(record, event.clientX, event.clientY);
}

function showPalette(
	record: HighlightRecord,
	clientX: number,
	clientY: number,
) {
	closeHighlightPalette();
	ensureStyles();
	const element = document.createElement("div");
	element.id = PALETTE_ID;
	element.dataset.highlightsUi = "true";
	element.dataset.theme = isPageDark() ? "dark" : "light";
	element.setAttribute("role", "toolbar");
	element.setAttribute(
		"aria-label",
		getLocalizedLabel("Highlight color", "高亮颜色"),
	);
	element.addEventListener("mousedown", (event) => {
		event.preventDefault();
		event.stopPropagation();
	});

	for (const color of HIGHLIGHT_COLORS) {
		element.appendChild(createColorButton(record, color));
	}

	const divider = document.createElement("span");
	divider.className = "highlights-palette-divider";
	divider.dataset.highlightsUi = "true";
	divider.setAttribute("aria-hidden", "true");
	element.appendChild(divider);

	const remove = document.createElement("button");
	remove.type = "button";
	remove.className = "highlights-palette-button remove";
	remove.dataset.highlightsUi = "true";
	remove.textContent = getLocalizedLabel("Remove", "取消");
	remove.title = getLocalizedLabel("Remove highlight", "取消高亮");
	remove.setAttribute("aria-label", remove.title);
	remove.addEventListener("click", async (event) => {
		event.preventDefault();
		event.stopPropagation();
		remove.disabled = true;
		const removed = await handlers?.onRemove(record);
		if (removed) closeHighlightPalette();
		else remove.disabled = false;
	});
	element.appendChild(remove);

	document.body.appendChild(element);
	palette = element;
	positionPalette(element, clientX, clientY);
}

function createColorButton(record: HighlightRecord, color: HighlightColor) {
	const labels: Record<HighlightColor, [string, string]> = {
		yellow: ["Yellow", "黄色"],
		green: ["Green", "绿色"],
		blue: ["Blue", "蓝色"],
		pink: ["Pink", "粉色"],
	};
	const button = document.createElement("button");
	button.type = "button";
	button.className = "highlights-palette-button color";
	button.dataset.highlightsUi = "true";
	button.dataset.highlightColor = color;
	button.title = getLocalizedLabel(...labels[color]);
	button.setAttribute("aria-label", button.title);
	button.setAttribute("aria-pressed", String(record.color === color));

	const swatch = document.createElement("span");
	swatch.className = "highlights-color-swatch";
	swatch.dataset.highlightsUi = "true";
	swatch.dataset.color = color;
	button.appendChild(swatch);
	button.addEventListener("click", async (event) => {
		event.preventDefault();
		event.stopPropagation();
		button.disabled = true;
		const updated = await handlers?.onColorChange(record, color);
		if (updated) closeHighlightPalette();
		else button.disabled = false;
	});
	return button;
}

function positionPalette(
	element: HTMLElement,
	clientX: number,
	clientY: number,
) {
	const viewportPadding = 8;
	const gap = 10;
	const rect = element.getBoundingClientRect();
	const left = Math.min(
		Math.max(viewportPadding, clientX - rect.width / 2),
		window.innerWidth - rect.width - viewportPadding,
	);
	let top = clientY - rect.height - gap;
	if (top < viewportPadding) top = clientY + gap;
	element.style.left = `${left}px`;
	element.style.top = `${Math.min(top, window.innerHeight - rect.height - viewportPadding)}px`;
}

function isPageDark() {
	if (document.documentElement.classList.contains("dark")) return true;
	if (document.documentElement.dataset.theme === "dark") return true;
	const channels = window
		.getComputedStyle(document.body)
		.color.match(/\d+(?:\.\d+)?/g)
		?.slice(0, 3)
		.map(Number);
	if (!channels || channels.length < 3) return false;
	const [red = 0, green = 0, blue = 0] = channels;
	return red * 0.299 + green * 0.587 + blue * 0.114 > 170;
}

function getLocalizedLabel(english: string, chinese: string) {
	return document.documentElement.lang.toLowerCase().startsWith("zh")
		? chinese
		: english;
}

function ensureStyles() {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.dataset.highlightsUi = "true";
	style.textContent = `
		#${PALETTE_ID} {
			--palette-surface: var(--main-surface-primary, #fff);
			--palette-text: var(--text-primary, #0d0d0d);
			--palette-muted: var(--text-secondary, #5d5d5d);
			--palette-hover: var(--surface-hover, rgba(0, 0, 0, .05));
			--palette-border: var(--border-light, rgba(0, 0, 0, .11));
			--palette-swatch-border: rgba(0, 0, 0, .16);
			position: fixed;
			z-index: 2147483647;
			display: flex;
			align-items: center;
			gap: 1px;
			box-sizing: border-box;
			padding: 3px;
			border: 1px solid var(--palette-border);
			border-radius: 11px;
			background: var(--palette-surface);
			box-shadow: 0 2px 8px rgba(0, 0, 0, .08), 0 1px 2px rgba(0, 0, 0, .04);
			color: var(--palette-text);
			font: inherit;
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			animation: highlights-palette-in 100ms cubic-bezier(.2, .8, .2, 1);
		}
		#${PALETTE_ID}[data-theme='dark'] {
			--palette-surface: var(--main-surface-primary, #212121);
			--palette-text: var(--text-primary, #f2f2f2);
			--palette-muted: var(--text-secondary, #b4b4b4);
			--palette-hover: var(--surface-hover, rgba(255, 255, 255, .08));
			--palette-border: var(--border-light, rgba(255, 255, 255, .12));
			--palette-swatch-border: rgba(255, 255, 255, .18);
			box-shadow: 0 4px 14px rgba(0, 0, 0, .30), 0 1px 2px rgba(0, 0, 0, .20);
		}
		.highlights-palette-button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			box-sizing: border-box;
			width: 30px;
			height: 30px;
			padding: 0;
			border: 0;
			border-radius: 8px;
			background: transparent;
			color: var(--palette-muted);
			font: inherit;
			cursor: pointer;
			transition: background-color 100ms ease, color 100ms ease;
		}
		.highlights-palette-button:hover,
		.highlights-palette-button:active { background: var(--palette-hover); }
		.highlights-palette-button:focus-visible {
			outline: 2px solid var(--palette-text);
			outline-offset: 1px;
		}
		.highlights-palette-button:disabled { cursor: wait; opacity: .62; }
		.highlights-color-swatch {
			box-sizing: border-box;
			width: 16px;
			height: 16px;
			border: 1px solid var(--palette-swatch-border);
			border-radius: 50%;
			box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .16);
		}
		.highlights-color-swatch[data-color='yellow'] { background: ${HIGHLIGHT_COLOR_TOKENS.yellow.swatch}; }
		.highlights-color-swatch[data-color='green'] { background: ${HIGHLIGHT_COLOR_TOKENS.green.swatch}; }
		.highlights-color-swatch[data-color='blue'] { background: ${HIGHLIGHT_COLOR_TOKENS.blue.swatch}; }
		.highlights-color-swatch[data-color='pink'] { background: ${HIGHLIGHT_COLOR_TOKENS.pink.swatch}; }
		.highlights-palette-divider {
			width: 1px;
			height: 22px;
			margin: 0 5px;
			background: var(--palette-border);
		}
		.highlights-palette-button.remove {
			width: auto;
			min-width: 30px;
			padding: 0 10px;
			white-space: nowrap;
		}
		.highlights-palette-button.remove:hover {
			background: rgba(196, 61, 54, .08);
			color: var(--danger-color, #c43d36);
		}
		@keyframes highlights-palette-in {
			from { opacity: 0; transform: translateY(2px) scale(.99); }
			to { opacity: 1; transform: translateY(0) scale(1); }
		}
		@media (prefers-reduced-motion: reduce) {
			#${PALETTE_ID} { animation: none; }
			.highlights-palette-button { transition: none; }
		}
	`;
	(document.head ?? document.documentElement).appendChild(style);
}
