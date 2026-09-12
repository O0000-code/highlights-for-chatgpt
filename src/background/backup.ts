import type { HighlightRecord, HighlightsBackup } from "../shared/types";
import { normalizeImportedRecord } from "./database";

export function createBackup(records: HighlightRecord[]): HighlightsBackup {
	return {
		product: "Highlights",
		formatVersion: 1,
		exportedAt: new Date().toISOString(),
		highlights: records,
	};
}

export function parseBackup(value: unknown): HighlightRecord[] {
	const source = findRecordArray(value);
	if (!source)
		throw new Error("This file does not contain a supported highlight backup");

	const normalized = source
		.map(normalizeImportedRecord)
		.filter((record): record is HighlightRecord => record !== null);
	if (source.length > 0 && normalized.length === 0) {
		throw new Error("No valid highlights were found in this file");
	}

	return Array.from(
		new Map(normalized.map((record) => [record.id, record])).values(),
	);
}

function findRecordArray(value: unknown): unknown[] | null {
	if (Array.isArray(value)) return value;
	if (!value || typeof value !== "object") return null;
	const object = value as Record<string, unknown>;
	if (Array.isArray(object.highlights)) return object.highlights;
	if (Array.isArray(object.bookmarks)) return object.bookmarks;
	if (
		object.data &&
		typeof object.data === "object" &&
		Array.isArray((object.data as Record<string, unknown>).bookmarks)
	) {
		return (object.data as Record<string, unknown>).bookmarks as unknown[];
	}
	return null;
}
