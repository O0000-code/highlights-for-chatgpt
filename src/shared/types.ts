import type { HighlightColor } from "./colors";

export const DATA_SCHEMA_VERSION = 1 as const;

export interface HighlightRecord {
	id: string;
	schemaVersion: typeof DATA_SCHEMA_VERSION;
	threadId: string;
	url: string;
	conversationTitle?: string;
	text: string;
	prefix: string;
	suffix: string;
	occurrence?: number;
	color: HighlightColor;
	createdAt: number;
	updatedAt: number;
}

export interface CreateHighlightInput {
	id?: string;
	url: string;
	conversationTitle?: string;
	text: string;
	prefix?: string;
	suffix?: string;
	occurrence?: number;
	color?: HighlightColor;
	createdAt?: number;
}

export interface HighlightsBackup {
	product: "Highlights";
	formatVersion: 1;
	exportedAt: string;
	highlights: HighlightRecord[];
}

export type RuntimeRequest =
	| { type: "PING" }
	| { type: "LIST_HIGHLIGHTS" }
	| { type: "GET_HIGHLIGHTS"; url: string }
	| { type: "CREATE_HIGHLIGHT"; input: CreateHighlightInput }
	| { type: "UPDATE_THREAD_TITLE"; url: string; title: string }
	| { type: "UPDATE_HIGHLIGHT_COLOR"; id: string; color: HighlightColor }
	| { type: "DELETE_HIGHLIGHT"; id: string };

export type RuntimeResponse<T = unknown> =
	| { ok: true; data: T }
	| { ok: false; error: string };
