import type { HighlightRecord } from "./types";

const FALLBACK_CONVERSATION_TITLE = "ChatGPT conversation";

export function highlightsToMarkdown(records: readonly HighlightRecord[]) {
	const groups = groupHighlights(records);
	const lines = ["# ChatGPT Highlights", ""];
	for (const group of groups) {
		lines.push(`## ${escapeMarkdown(group.title)}`, "");
		lines.push(`[Open conversation](${group.url})`, "");
		for (const record of group.records) {
			for (const line of record.text.split("\n")) lines.push(`> ${line}`);
			lines.push(
				"",
				`Saved ${formatExportDate(record.createdAt)} · ${capitalize(record.color)}`,
				"",
			);
		}
	}
	return `${lines.join("\n").trimEnd()}\n`;
}

export function highlightsToPlainText(records: readonly HighlightRecord[]) {
	const groups = groupHighlights(records);
	const lines = ["ChatGPT Highlights", "==================", ""];
	for (const group of groups) {
		lines.push(group.title, group.url, "");
		for (const record of group.records) {
			lines.push(
				record.text,
				`Saved ${formatExportDate(record.createdAt)} · ${capitalize(record.color)}`,
				"",
			);
		}
	}
	return `${lines.join("\n").trimEnd()}\n`;
}

export function formatExportDate(timestamp: number) {
	return new Intl.DateTimeFormat("en", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(timestamp));
}

export function getConversationTitle(record: HighlightRecord) {
	return record.conversationTitle?.trim() || FALLBACK_CONVERSATION_TITLE;
}

function groupHighlights(records: readonly HighlightRecord[]) {
	const groups = new Map<
		string,
		{ title: string; url: string; records: HighlightRecord[] }
	>();
	for (const record of [...records].sort(
		(left, right) => right.createdAt - left.createdAt,
	)) {
		let group = groups.get(record.threadId);
		if (!group) {
			group = {
				title: getConversationTitle(record),
				url: record.url,
				records: [],
			};
			groups.set(record.threadId, group);
		}
		group.records.push(record);
	}
	return [...groups.values()];
}

function escapeMarkdown(value: string) {
	return value.replace(/([\\`*_[\]<>])/g, "\\$1");
}

function capitalize(value: string) {
	return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
