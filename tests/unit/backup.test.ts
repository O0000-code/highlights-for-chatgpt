import { describe, expect, test } from "bun:test";
import { createBackup, parseBackup } from "../../src/background/backup";
import {
	DATA_SCHEMA_VERSION,
	type HighlightRecord,
} from "../../src/shared/types";

const record: HighlightRecord = {
	id: "new-id",
	schemaVersion: DATA_SCHEMA_VERSION,
	threadId: "chatgpt:new-thread",
	url: "https://chatgpt.com/c/new-thread",
	conversationTitle: "A useful conversation",
	text: "A useful passage",
	prefix: "Before ",
	suffix: " after",
	color: "yellow",
	createdAt: 100,
	updatedAt: 100,
};

describe("backup compatibility", () => {
	test("round-trips the current format", () => {
		const backup = createBackup([record]);
		expect(parseBackup(backup)).toEqual([record]);
	});

	test("imports Threadmark bookmark exports", () => {
		const imported = parseBackup({
			source: "Threadmark",
			bookmarks: [
				{
					bookmarkId: "legacy-id",
					threadId: "chatgpt:legacy-thread",
					text: "Legacy passage",
					prefix: "Legacy prefix ",
					suffix: " legacy suffix",
					color: "green",
					createdAt: 42,
				},
			],
		});
		expect(imported).toHaveLength(1);
		expect(imported[0]).toMatchObject({
			id: "legacy-id",
			threadId: "chatgpt:legacy-thread",
			url: "https://chatgpt.com/c/legacy-thread",
			text: "Legacy passage",
			color: "green",
		});
	});

	test("rejects unrelated JSON instead of silently doing nothing", () => {
		expect(() => parseBackup({ notes: [] })).toThrow(
			"supported highlight backup",
		);
	});
});
