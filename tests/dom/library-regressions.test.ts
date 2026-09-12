import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { initHighlightLibrary } from "../../src/content/library";
import {
	DATA_SCHEMA_VERSION,
	type HighlightRecord,
} from "../../src/shared/types";
import { installDom } from "./test-environment";

const records: [HighlightRecord, HighlightRecord] = [
	{
		id: "alpha-record",
		schemaVersion: DATA_SCHEMA_VERSION,
		threadId: "chatgpt:alpha-conversation",
		url: "https://chatgpt.com/c/alpha-conversation",
		conversationTitle: "First conversation",
		text: "Alpha passage retained in the export.",
		prefix: "",
		suffix: "",
		color: "yellow",
		createdAt: 100,
		updatedAt: 100,
	},
	{
		id: "beta-record",
		schemaVersion: DATA_SCHEMA_VERSION,
		threadId: "chatgpt:beta-conversation",
		url: "https://chatgpt.com/c/beta-conversation",
		conversationTitle: "Second conversation",
		text: "Beta passage excluded from the export.",
		prefix: "",
		suffix: "",
		color: "blue",
		createdAt: 90,
		updatedAt: 90,
	},
];

function nativeHeader() {
	return `<header class="native-header"><h1>Library</h1>
		<div class="native-controls">
			<button class="native-filter" aria-label="Open filters" aria-expanded="false" data-state="closed"></button>
			<button class="native-grid" aria-label="Grid view" aria-pressed="false"></button>
			<button class="native-list" aria-label="List view" aria-pressed="true"></button>
			<input class="native-search" type="search" placeholder="Search library">
			<button class="native-new">New</button>
		</div></header>`;
}

function libraryMarkup() {
	return `<main><div class="surface group/page-table-scroll">
		<div class="sticky">${nativeHeader()}<div class="native-tabs">
			<button class="native-tab bg-token-bg-tertiary!" aria-selected="true">Suggested</button>
			<button class="native-tab bg-transparent!">Folders</button>
			<button class="native-tab bg-transparent!">Images</button>
			<button class="native-tab bg-transparent!">All</button>
		</div></div>
		<div class="native-body"><div role="grid">Native file</div></div>
	</div></main>`;
}

let fixture: ReturnType<typeof installDom> | undefined;
let library: ReturnType<typeof initHighlightLibrary> | undefined;

afterEach(async () => {
	library?.observer.disconnect();
	await fixture?.window.happyDOM.abort();
	library = undefined;
	fixture = undefined;
});

async function mountLibrary(
	active = true,
	loadRecords: () => Promise<HighlightRecord[]> = async () => records,
) {
	fixture = installDom(
		libraryMarkup(),
		`https://chatgpt.com/library${active ? "?view=highlights" : ""}`,
	);
	library = initHighlightLibrary({
		loadRecords,
		poll: false,
	});
	// Reconciliation is explicit in these tests so pending observer callbacks from
	// a replaced window cannot interfere with another fixture.
	library.observer.disconnect();
	await settleRecords();
	return library;
}

async function settleRecords() {
	await Promise.resolve();
	await Promise.resolve();
}

function requireElement<T extends HTMLElement>(selector: string): T {
	const element = document.querySelector<T>(selector);
	if (!element) throw new Error(`Missing fixture element: ${selector}`);
	return element;
}

function setSearch(value: string) {
	const input = requireElement<HTMLInputElement>(".native-search");
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

function openExportMenu() {
	const button = requireElement<HTMLButtonElement>(
		"[data-highlights-library-export]",
	);
	const menu = document.querySelector<HTMLElement>(
		"[data-highlights-library-export-menu]",
	);
	if (!menu || menu.hidden) button.click();
	return requireElement<HTMLElement>("[data-highlights-library-export-menu]");
}

async function downloadCurrentMarkdown() {
	let downloaded: Blob | undefined;
	const createObjectURL = spyOn(URL, "createObjectURL").mockImplementation(
		(value) => {
			downloaded = value as Blob;
			return "blob:library-regression";
		},
	);
	const revokeObjectURL = spyOn(URL, "revokeObjectURL").mockImplementation(
		() => {},
	);
	if (!fixture) throw new Error("Missing DOM fixture");
	const anchorClick = spyOn(
		fixture.window.HTMLAnchorElement.prototype,
		"click",
	).mockImplementation(() => {});
	try {
		openExportMenu()
			.querySelector<HTMLButtonElement>("[data-export-format='markdown']")
			?.click();
		if (!downloaded) throw new Error("No Markdown download was produced");
		return await downloaded.text();
	} finally {
		createObjectURL.mockRestore();
		revokeObjectURL.mockRestore();
		anchorClick.mockRestore();
	}
}

describe("Highlights Library interaction regressions", () => {
	for (const kind of ["export", "filter"] as const) {
		for (const dismissal of ["outside pointerdown", "Escape"] as const) {
			test(`dismisses the ${kind} menu with ${dismissal}`, async () => {
				await mountLibrary();
				const trigger = requireElement<HTMLButtonElement>(
					kind === "export"
						? "[data-highlights-library-export]"
						: ".native-filter",
				);
				trigger.click();
				const menu = requireElement<HTMLElement>(
					`[data-highlights-library-${kind}-menu]`,
				);
				expect(menu.hidden).toBe(false);
				if (dismissal === "Escape") {
					window.dispatchEvent(
						new window.KeyboardEvent("keydown", {
							key: "Escape",
							bubbles: true,
						}),
					);
				} else {
					document.body.dispatchEvent(
						new Event("pointerdown", { bubbles: true }),
					);
				}
				expect(menu.hidden || !menu.isConnected).toBe(true);
				expect(trigger.getAttribute("aria-expanded")).toBe("false");
			});
		}
	}

	test("exports the current search after an already-open export menu", async () => {
		await mountLibrary();
		openExportMenu();
		setSearch("Alpha");
		expect(document.querySelectorAll("[data-highlight-record-id]").length).toBe(
			1,
		);
		const markdown = await downloadCurrentMarkdown();
		expect(markdown).toContain(records[0].text);
		expect(markdown).not.toContain(records[1].text);
	});

	test("exports the current selection after an already-open export menu", async () => {
		await mountLibrary();
		openExportMenu();
		const checkbox = requireElement<HTMLInputElement>(
			"[data-select-highlight='alpha-record']",
		);
		checkbox.checked = true;
		checkbox.dispatchEvent(new Event("change", { bubbles: true }));
		const markdown = await downloadCurrentMarkdown();
		expect(markdown).toContain(records[0].text);
		expect(markdown).not.toContain(records[1].text);
	});

	test("captures the latest native search each time Highlights is entered", async () => {
		await mountLibrary(false);
		const input = requireElement<HTMLInputElement>(".native-search");
		const nativeTab = requireElement<HTMLButtonElement>(
			".native-tabs button:nth-child(2)",
		);
		const highlights = requireElement<HTMLButtonElement>(
			"[data-highlights-library-tab]",
		);
		for (const nativeQuery of ["First native search", "Second native search"]) {
			input.value = nativeQuery;
			highlights.click();
			await settleRecords();
			setSearch("Alpha");
			nativeTab.click();
			expect(input.value).toBe(nativeQuery);
		}
	});

	test("preserves the active highlight query across native search replacement", async () => {
		const controller = await mountLibrary();
		setSearch("Alpha");
		const input = requireElement<HTMLInputElement>(".native-search");
		const replacement = document.createElement("input");
		replacement.className = "native-search";
		replacement.type = "search";
		input.replaceWith(replacement);
		controller.reconcile();
		expect(replacement.value).toBe("Alpha");
		expect(document.querySelectorAll("[data-highlight-record-id]").length).toBe(
			1,
		);
	});

	test("cleans up the export portal across native header replacement and exit", async () => {
		const controller = await mountLibrary();
		openExportMenu();
		const template = document.createElement("template");
		template.innerHTML = nativeHeader();
		const newHeader = template.content.firstElementChild;
		if (!newHeader) throw new Error("Missing replacement header");
		requireElement(".native-header").replaceWith(newHeader);
		controller.reconcile();
		expect(
			document.querySelectorAll("[data-highlights-library-export-menu]").length,
		).toBe(1);
		openExportMenu();
		requireElement<HTMLButtonElement>(
			".native-tabs button:nth-child(2)",
		).click();
		expect(window.location.search).not.toContain("view=highlights");
		expect(
			document.querySelectorAll("[data-highlights-library-export-menu]").length,
		).toBe(0);
	});

	for (const eventType of ["focus", "pageshow"] as const) {
		test(`refreshes saved highlights on ${eventType} while keeping search and selection`, async () => {
			let currentRecords: HighlightRecord[] = records;
			let loads = 0;
			await mountLibrary(true, async () => {
				loads++;
				return currentRecords;
			});
			setSearch("Alpha");
			const checkbox = requireElement<HTMLInputElement>(
				"[data-select-highlight='alpha-record']",
			);
			checkbox.checked = true;
			checkbox.dispatchEvent(new Event("change", { bubbles: true }));
			currentRecords = [
				...records,
				{
					...records[0],
					id: "new-alpha-record",
					text: "Alpha passage saved from another ChatGPT tab.",
					createdAt: 200,
					updatedAt: 200,
				},
			];
			window.dispatchEvent(new Event(eventType));
			await settleRecords();
			expect(loads).toBeGreaterThan(1);
			expect(requireElement<HTMLInputElement>(".native-search").value).toBe(
				"Alpha",
			);
			expect(
				document.querySelectorAll("[data-highlight-record-id]").length,
			).toBe(2);
			expect(
				document.querySelector("[data-highlight-record-id='new-alpha-record']"),
			).not.toBeNull();
			expect(
				document.querySelector("[data-highlight-record-id='beta-record']"),
			).toBeNull();
			expect(
				requireElement<HTMLInputElement>(
					"[data-select-highlight='alpha-record']",
				).checked,
			).toBe(true);
			expect(
				requireElement<HTMLInputElement>(
					"[data-select-highlight='new-alpha-record']",
				).checked,
			).toBe(false);
			expect(
				requireElement("[data-highlights-library-export]").textContent,
			).toBe("Export 1");
		});
	}
});
