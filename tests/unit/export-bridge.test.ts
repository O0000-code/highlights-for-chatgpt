import { describe, expect, test } from "bun:test";
import {
	CHATGPT_EXPORTER_EXTENSION_ID,
	createExportSnapshot,
	EXPORT_BRIDGE_PORT_NAME,
	isTrustedExporter,
	parseExportRequest,
} from "../../src/background/export-bridge";
import {
	DATA_SCHEMA_VERSION,
	type HighlightRecord,
} from "../../src/shared/types";

const record: HighlightRecord = {
	id: "highlight-one",
	schemaVersion: DATA_SCHEMA_VERSION,
	threadId: "chatgpt:conversation-one",
	url: "https://chatgpt.com/c/conversation-one",
	conversationTitle: "Private title that is not required for inline export",
	text: "Useful passage",
	prefix: "Before ",
	suffix: " after",
	occurrence: 1,
	color: "blue",
	createdAt: 100,
	updatedAt: 200,
};

describe("ChatGPT Exporter bridge", () => {
	test("declares only the compatible exporter as externally connectable", async () => {
		const manifest = (await Bun.file("src/manifest.json").json()) as {
			externally_connectable?: { ids?: string[] };
		};
		expect(manifest.externally_connectable?.ids).toEqual([
			CHATGPT_EXPORTER_EXTENSION_ID,
		]);
	});

	test("shares only the current conversation and only annotation fields", () => {
		const snapshot = createExportSnapshot(record.url, [
			record,
			{ ...record, id: "other", threadId: "chatgpt:other" },
		]);

		expect(snapshot.threadId).toBe("chatgpt:conversation-one");
		expect(snapshot.records).toEqual([
			{
				id: "highlight-one",
				threadId: "chatgpt:conversation-one",
				text: "Useful passage",
				prefix: "Before ",
				suffix: " after",
				occurrence: 1,
				color: "blue",
				createdAt: 100,
				updatedAt: 200,
			},
		]);
		expect(snapshot.records[0]).not.toHaveProperty("url");
		expect(snapshot.records[0]).not.toHaveProperty("conversationTitle");
	});

	test("accepts only the allow-listed exporter and named port", () => {
		expect(
			isTrustedExporter({
				name: EXPORT_BRIDGE_PORT_NAME,
				sender: { id: CHATGPT_EXPORTER_EXTENSION_ID },
			}),
		).toBe(true);
		expect(
			isTrustedExporter({
				name: EXPORT_BRIDGE_PORT_NAME,
				sender: { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
			}),
		).toBe(false);
	});

	test("rejects non-conversation and cross-conversation requests", () => {
		expect(
			parseExportRequest(
				{
					type: "GET_HIGHLIGHTS",
					protocolVersion: 1,
					url: record.url,
				},
				record.url,
			),
		).not.toBeNull();
		expect(
			parseExportRequest(
				{
					type: "GET_HIGHLIGHTS",
					protocolVersion: 1,
					url: "https://chatgpt.com/c/other",
				},
				record.url,
			),
		).toBeNull();
		expect(
			parseExportRequest({
				type: "GET_HIGHLIGHTS",
				protocolVersion: 1,
				url: "https://chatgpt.com/",
			}),
		).toBeNull();
	});
});
