import { describe, expect, test } from "bun:test";
import {
	highlightsToMarkdown,
	highlightsToPlainText,
} from "../../src/shared/export";
import {
	DATA_SCHEMA_VERSION,
	type HighlightRecord,
} from "../../src/shared/types";

const records: HighlightRecord[] = [
	{
		id: "older",
		schemaVersion: DATA_SCHEMA_VERSION,
		threadId: "chatgpt:one",
		url: "https://chatgpt.com/c/one",
		conversationTitle: "Planning *notes*",
		text: "First useful passage",
		prefix: "",
		suffix: "",
		color: "yellow",
		createdAt: 100,
		updatedAt: 100,
	},
	{
		id: "newer",
		schemaVersion: DATA_SCHEMA_VERSION,
		threadId: "chatgpt:two",
		url: "https://chatgpt.com/c/two",
		conversationTitle: "Research",
		text: "A multiline\npassage",
		prefix: "",
		suffix: "",
		color: "blue",
		createdAt: 200,
		updatedAt: 200,
	},
];

describe("readable highlight exports", () => {
	test("groups by conversation, newest first, with source links", () => {
		const markdown = highlightsToMarkdown(records);
		expect(markdown.indexOf("## Research")).toBeLessThan(
			markdown.indexOf("## Planning \\*notes\\*"),
		);
		expect(markdown).toContain(
			"[Open conversation](https://chatgpt.com/c/two)",
		);
		expect(markdown).toContain("> A multiline\n> passage");
	});

	test("plain text remains readable outside the extension", () => {
		const text = highlightsToPlainText(records);
		expect(text).toContain("ChatGPT Highlights");
		expect(text).toContain("Planning *notes*");
		expect(text).toContain("First useful passage");
	});
});
