import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import {
	getThreadId,
	normalizeConversationUrl,
	urlForThreadId,
} from "../shared/chatgpt";
import { DEFAULT_HIGHLIGHT_COLOR, isHighlightColor } from "../shared/colors";
import {
	type CreateHighlightInput,
	DATA_SCHEMA_VERSION,
	type HighlightRecord,
} from "../shared/types";

interface HighlightsDatabase extends DBSchema {
	highlights: {
		key: string;
		value: HighlightRecord;
		indexes: { "by-threadId": string; "by-createdAt": number };
	};
}

const DATABASE_NAME = "highlights-db";
const DATABASE_VERSION = 1;

let databasePromise: Promise<IDBPDatabase<HighlightsDatabase>> | undefined;

export function openHighlightsDatabase() {
	if (!databasePromise) {
		databasePromise = openDB<HighlightsDatabase>(
			DATABASE_NAME,
			DATABASE_VERSION,
			{
				upgrade(database) {
					if (database.objectStoreNames.contains("highlights")) return;
					const store = database.createObjectStore("highlights", {
						keyPath: "id",
					});
					store.createIndex("by-threadId", "threadId");
					store.createIndex("by-createdAt", "createdAt");
				},
			},
		);
	}
	return databasePromise;
}

export async function createHighlight(input: CreateHighlightInput) {
	const database = await openHighlightsDatabase();
	const record = normalizeHighlightInput(input);
	await database.put("highlights", record);
	return record;
}

export async function getHighlightsForUrl(rawUrl: string) {
	const database = await openHighlightsDatabase();
	const records = await database.getAllFromIndex(
		"highlights",
		"by-threadId",
		getThreadId(rawUrl),
	);
	return records.sort((left, right) => left.createdAt - right.createdAt);
}

export async function listHighlights() {
	const database = await openHighlightsDatabase();
	const records = await database.getAllFromIndex("highlights", "by-createdAt");
	return records.sort((left, right) => left.createdAt - right.createdAt);
}

export async function updateThreadTitle(rawUrl: string, rawTitle: string) {
	const title = normalizeConversationTitle(rawTitle);
	if (!title) return [];
	const database = await openHighlightsDatabase();
	const threadId = getThreadId(rawUrl);
	const records = await database.getAllFromIndex(
		"highlights",
		"by-threadId",
		threadId,
	);
	const changed = records.filter(
		(record) => record.conversationTitle !== title,
	);
	if (changed.length === 0) return records;
	const transaction = database.transaction("highlights", "readwrite");
	for (const record of changed) {
		await transaction.store.put({
			...record,
			conversationTitle: title,
		});
	}
	await transaction.done;
	return records.map((record) => ({
		...record,
		conversationTitle: title,
	}));
}

export async function updateHighlightColor(
	id: string,
	color: HighlightRecord["color"],
) {
	const database = await openHighlightsDatabase();
	const record = await database.get("highlights", id);
	if (!record) return null;

	const updated = { ...record, color, updatedAt: Date.now() };
	await database.put("highlights", updated);
	return updated;
}

export async function deleteHighlight(id: string) {
	const database = await openHighlightsDatabase();
	const record = await database.get("highlights", id);
	if (!record) return null;
	await database.delete("highlights", id);
	return record;
}

export async function importHighlights(records: HighlightRecord[]) {
	const database = await openHighlightsDatabase();
	const transaction = database.transaction("highlights", "readwrite");
	for (const record of records) {
		await transaction.store.put(record);
	}
	await transaction.done;
	return records.length;
}

export async function deleteAllHighlights() {
	const database = await openHighlightsDatabase();
	await database.clear("highlights");
}

export function normalizeHighlightInput(
	input: CreateHighlightInput,
): HighlightRecord {
	const text = input.text.trim();
	if (!text) throw new Error("Highlight text is empty");
	if (!input.url) throw new Error("Conversation URL is missing");
	if (input.occurrence !== undefined && !Number.isInteger(input.occurrence)) {
		throw new Error("Highlight occurrence must be an integer");
	}

	const now = Date.now();
	return {
		id: input.id || crypto.randomUUID(),
		schemaVersion: DATA_SCHEMA_VERSION,
		threadId: getThreadId(input.url),
		url: normalizeConversationUrl(input.url),
		conversationTitle: normalizeConversationTitle(input.conversationTitle),
		text,
		prefix: input.prefix?.slice(-160) ?? "",
		suffix: input.suffix?.slice(0, 160) ?? "",
		occurrence:
			input.occurrence !== undefined && input.occurrence >= 0
				? input.occurrence
				: undefined,
		color: isHighlightColor(input.color)
			? input.color
			: DEFAULT_HIGHLIGHT_COLOR,
		createdAt: input.createdAt ?? now,
		updatedAt: now,
	};
}

export function normalizeImportedRecord(
	value: unknown,
): HighlightRecord | null {
	if (!value || typeof value !== "object") return null;
	const candidate = value as Record<string, unknown>;
	const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
	const idValue = candidate.id ?? candidate.bookmarkId;
	const id =
		typeof idValue === "string" && idValue ? idValue : crypto.randomUUID();
	const threadValue = candidate.threadId;
	const urlValue = candidate.url;
	const rawLocation =
		typeof urlValue === "string" && urlValue
			? urlValue
			: typeof threadValue === "string" && threadValue
				? urlForThreadId(threadValue)
				: "";
	if (!text || !rawLocation) return null;

	const createdAtValue = candidate.createdAt ?? candidate.timestamp;
	const createdAt =
		typeof createdAtValue === "number" && Number.isFinite(createdAtValue)
			? createdAtValue
			: Date.now();
	const occurrence =
		typeof candidate.occurrence === "number" &&
		Number.isInteger(candidate.occurrence) &&
		candidate.occurrence >= 0
			? candidate.occurrence
			: undefined;

	return {
		id,
		schemaVersion: DATA_SCHEMA_VERSION,
		threadId: getThreadId(rawLocation),
		url: normalizeConversationUrl(rawLocation),
		conversationTitle: normalizeConversationTitle(candidate.conversationTitle),
		text,
		prefix:
			typeof candidate.prefix === "string" ? candidate.prefix.slice(-160) : "",
		suffix:
			typeof candidate.suffix === "string"
				? candidate.suffix.slice(0, 160)
				: "",
		occurrence,
		color: isHighlightColor(candidate.color)
			? candidate.color
			: DEFAULT_HIGHLIGHT_COLOR,
		createdAt,
		updatedAt:
			typeof candidate.updatedAt === "number" &&
			Number.isFinite(candidate.updatedAt)
				? candidate.updatedAt
				: createdAt,
	};
}

function normalizeConversationTitle(value: unknown) {
	if (typeof value !== "string") return undefined;
	const title = value.replace(/\s+/g, " ").trim().slice(0, 240);
	return title || undefined;
}
