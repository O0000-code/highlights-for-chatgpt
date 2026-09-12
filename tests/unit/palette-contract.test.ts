import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

describe("highlight palette visual contract", () => {
	test("does not add a persistent visual style for the current color", async () => {
		const source = await readFile("src/content/palette.ts", "utf8");
		expect(source).not.toContain("[aria-pressed='true']");
		expect(source).not.toContain('[aria-pressed="true"]');
		expect(source).toContain('setAttribute("aria-pressed"');
	});

	test("keeps remove as the rightmost palette action", async () => {
		const source = await readFile("src/content/palette.ts", "utf8");
		expect(
			source.indexOf("for (const color of HIGHLIGHT_COLORS)"),
		).toBeLessThan(
			source.indexOf('remove.className = "highlights-palette-button remove"'),
		);
	});
});
