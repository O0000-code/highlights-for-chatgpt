export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const;

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = "yellow";

export const HIGHLIGHT_COLOR_TOKENS: Record<
	HighlightColor,
	{ fill: string; marker: string; swatch: string }
> = {
	yellow: {
		fill: "rgba(186, 157, 74, 0.29)",
		marker: "rgba(186, 157, 74, 0.88)",
		swatch: "#ba9d4a",
	},
	green: {
		fill: "rgba(120, 146, 126, 0.26)",
		marker: "rgba(120, 146, 126, 0.86)",
		swatch: "#78927e",
	},
	blue: {
		fill: "rgba(118, 138, 165, 0.26)",
		marker: "rgba(118, 138, 165, 0.86)",
		swatch: "#768aa5",
	},
	pink: {
		fill: "rgba(156, 123, 133, 0.25)",
		marker: "rgba(156, 123, 133, 0.86)",
		swatch: "#9c7b85",
	},
};

export function isHighlightColor(value: unknown): value is HighlightColor {
	return HIGHLIGHT_COLORS.includes(value as HighlightColor);
}
