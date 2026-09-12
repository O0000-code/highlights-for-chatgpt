import { describe, expect, test } from "bun:test";
import {
	getConversationId,
	getThreadId,
	normalizeConversationUrl,
	urlForThreadId,
} from "../../src/shared/chatgpt";

describe("ChatGPT conversation identity", () => {
	test("uses a stable conversation ID across transient URL state", () => {
		expect(
			getThreadId("https://chatgpt.com/c/abc-123?temporary=true#answer"),
		).toBe("chatgpt:abc-123");
		expect(
			normalizeConversationUrl(
				"https://chatgpt.com/c/abc-123?temporary=true#answer",
			),
		).toBe("https://chatgpt.com/c/abc-123");
	});

	test("rejects lookalike domains", () => {
		expect(getConversationId("https://not-chatgpt.com/c/abc")).toBeNull();
	});

	test("converts legacy thread IDs to canonical URLs", () => {
		expect(urlForThreadId("chatgpt:abc-123")).toBe(
			"https://chatgpt.com/c/abc-123",
		);
	});
});
