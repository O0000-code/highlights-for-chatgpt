import { beforeEach, describe, expect, test } from "bun:test";
import {
	clearRenderedHighlights,
	getNavigationHighlights,
	removeRenderedHighlight,
	renderHighlight,
	updateRenderedHighlightColor,
} from "../../src/content/renderer";
import {
	DATA_SCHEMA_VERSION,
	type HighlightRecord,
} from "../../src/shared/types";
import { installDom, type MockHighlight } from "./test-environment";

let nativeHighlights: Map<string, MockHighlight>;

function makeRecord(overrides: Partial<HighlightRecord> = {}): HighlightRecord {
	return {
		id: "highlight-1",
		schemaVersion: DATA_SCHEMA_VERSION,
		threadId: "chatgpt:test-conversation",
		url: "https://chatgpt.com/c/test-conversation",
		text: "A multi-node answer remains intact.",
		prefix: "",
		suffix: "",
		color: "yellow",
		createdAt: 1,
		updatedAt: 1,
		...overrides,
	};
}

describe("non-destructive renderer", () => {
	beforeEach(() => {
		({ nativeHighlights } = installDom(`
			<article data-message-author-role="assistant">
				<p id="message">A <strong>multi-node</strong> answer remains intact.</p>
			</article>
		`));
		clearRenderedHighlights();
	});

	test("paints with the Custom Highlight API and never wraps ChatGPT text", () => {
		const before = document.body.innerHTML;
		expect(renderHighlight(makeRecord())).toBe(true);
		expect(document.body.innerHTML).toBe(before);
		expect(document.querySelector("mark, .highlight")).toBeNull();
		const ranges = Array.from(nativeHighlights.get("highlights-yellow") ?? []);
		expect(ranges.map((range) => range.toString()).join(" ")).toBe(
			"A multi-node answer remains intact.",
		);
	});

	test("recolors and removes without changing document hierarchy", () => {
		const before = document.body.innerHTML;
		renderHighlight(makeRecord());
		expect(updateRenderedHighlightColor("highlight-1", "green")).toBe(true);
		expect(nativeHighlights.get("highlights-yellow")).toBeUndefined();
		expect(nativeHighlights.get("highlights-green")?.size).toBe(1);
		expect(removeRenderedHighlight("highlight-1")).toBe(true);
		expect(nativeHighlights.get("highlights-green")).toBeUndefined();
		expect(document.body.innerHTML).toBe(before);
	});

	test("sorts navigation markers by document order", () => {
		document.body.innerHTML = `
			<article><p>First passage.</p><p>Second passage.</p></article>
		`;
		renderHighlight(makeRecord({ id: "second", text: "Second passage." }));
		renderHighlight(makeRecord({ id: "first", text: "First passage." }));
		expect(getNavigationHighlights().map((record) => record.id)).toEqual([
			"first",
			"second",
		]);
	});
});
