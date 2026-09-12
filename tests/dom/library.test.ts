import { describe, expect, test } from "bun:test";
import { initHighlightLibrary } from "../../src/content/library";
import {
	DATA_SCHEMA_VERSION,
	type HighlightRecord,
} from "../../src/shared/types";
import { installDom } from "./test-environment";

const record: HighlightRecord = {
	id: "library-record",
	schemaVersion: DATA_SCHEMA_VERSION,
	threadId: "chatgpt:library-thread",
	url: "https://chatgpt.com/c/library-thread",
	conversationTitle: "A native Library test",
	text: "The useful passage is available without loading the conversation DOM.",
	prefix: "Before ",
	suffix: " after.",
	color: "blue",
	createdAt: 100,
	updatedAt: 100,
};

const sameConversation: HighlightRecord = {
	...record,
	id: "same-conversation-record",
	text: "A second useful passage from the same conversation.",
	color: "yellow",
	createdAt: 90,
	updatedAt: 90,
};

const anotherConversation: HighlightRecord = {
	...record,
	id: "another-conversation-record",
	threadId: "chatgpt:another-thread",
	url: "https://chatgpt.com/c/another-thread",
	conversationTitle: "Another conversation",
	text: "A passage from another conversation.",
	color: "green",
	createdAt: 80,
	updatedAt: 80,
};

function libraryMarkup() {
	return `<main><div class="surface">
		<div class="header"><h1 class="native-heading">Library</h1><input type="text" placeholder="Search" class="native-search"><button class="native-new native-primary" aria-haspopup="menu" aria-expanded="false" data-state="closed"><div class="native-button-content">New<svg class="native-button-icon"><use href="/native-sprite.svg#chevron"></use></svg></div></button></div>
		<div class="group/page-table-scroll"><div class="sticky"><div class="toolbar"><div class="tabs"><button class="native-tab native-tab-inactive"><div class="native-tab-content">All</div></button><button class="native-tab native-tab-inactive"><div class="native-tab-content">Images</div></button><button class="native-tab native-tab-active" aria-selected="true"><div class="native-tab-content">Documents</div></button></div><div class="native-controls"><button class="native-filter" aria-label="Open filters" aria-haspopup="menu" aria-expanded="false" data-state="closed"><svg><use href="/native-sprite.svg#filter"></use></svg></button><div class="native-divider"></div><div class="native-mobile-controls"></div><div class="native-view-controls"><button class="native-grid" aria-label="Grid view" aria-pressed="false" data-state="closed"><svg><use href="/native-sprite.svg#grid"></use></svg></button><button class="native-list" aria-label="List view" aria-pressed="true" data-state="closed"><svg><use href="/native-sprite.svg#list"></use></svg></button></div></div></div></div>
		<div class="native-body"><table><thead><tr><th><div class="native-checkbox-shell"><input type="checkbox" class="native-checkbox" aria-label="Select all"><svg aria-hidden="true"><use href="/native-check.svg#check"></use></svg><span aria-hidden="true"></span></div></th></tr></thead><tbody><tr><td>Native document</td></tr></tbody></table></div></div>
	</div></main>`;
}

// September 2026 Library: controls beside the title; no Documents category.
function currentLibraryMarkup(
	body = "<table><tbody><tr><td>Native file</td></tr></tbody></table>",
) {
	return `<main><div class="surface">
		<header><h1>Library</h1><div class="native-controls"><button aria-label="Open filters"></button><button aria-label="Grid view" aria-pressed="false"></button><button aria-label="List view" aria-pressed="true"></button><input placeholder="Search library"><button class="native-primary">New</button></div></header>
		<div class="new-library-scroll"><div class="sticky"><div class="tabs"><button class="native-tab bg-token-main-surface-secondary">Suggested</button><button class="native-tab">Folders</button><button class="native-tab">Images</button><button class="native-tab">All</button></div></div><div class="native-body">${body}</div></div>
	</div></main>`;
}

describe("Highlights Library", () => {
	for (const selected of ["Suggested", "Folders", "Images", "All"]) {
		test(`keeps exactly one selected tab with native important utilities: ${selected}`, async () => {
			installDom(
				currentLibraryMarkup(),
				"https://chatgpt.com/library?view=highlights",
			);
			const tabs = Array.from(
				document.querySelectorAll<HTMLElement>(".tabs button"),
			);
			const activeClass =
				"btn btn-primary-inverse bg-token-bg-tertiary! text-token-text-primary!";
			const inactiveClass =
				"btn btn-ghost bg-transparent! text-token-text-secondary!";
			const activeTab = tabs.find((tab) => tab.textContent === selected);
			if (!activeTab) throw new Error("Missing active tab");
			for (const tab of tabs)
				tab.className = tab === activeTab ? activeClass : inactiveClass;
			const library = initHighlightLibrary({
				loadRecords: async () => [record],
				poll: false,
			});
			await Promise.resolve();
			const highlights = document.querySelector<HTMLElement>(
				"[data-highlights-library-tab]",
			);
			expect(highlights?.className).toBe(activeClass);
			expect(tabs.every((tab) => tab.className === inactiveClass)).toBe(true);
			activeTab.click();
			library.reconcile();
			expect(highlights?.className).toBe(inactiveClass);
			expect(activeTab.className).toBe(activeClass);
			expect(tabs.filter((tab) => tab.className === activeClass).length).toBe(
				1,
			);
			highlights?.click();
			library.reconcile();
			expect(highlights?.className).toBe(activeClass);
			expect(tabs.every((tab) => tab.className === inactiveClass)).toBe(true);
			library.observer.disconnect();
		});
	}

	test("does not hijack Grid or Settings when the native Folders tab has no filter", async () => {
		installDom(
			currentLibraryMarkup(),
			"https://chatgpt.com/library?tab=folders&view=highlights",
		);
		document.querySelector('[aria-label="Open filters"]')?.remove();
		const settings = document.createElement("button");
		settings.setAttribute("aria-label", "Settings");
		document.querySelector(".native-controls")?.append(settings);
		let settingsClicks = 0;
		settings.addEventListener("click", () => settingsClicks++);
		const library = initHighlightLibrary({
			loadRecords: async () => [record],
			poll: false,
		});
		await Promise.resolve();
		document.querySelector<HTMLElement>('[aria-label="Grid view"]')?.click();
		expect(document.querySelector(".highlights-library-grid")).not.toBeNull();
		expect(
			document.querySelector("[data-highlights-library-filter-menu]"),
		).toBeNull();
		settings.click();
		expect(settingsClicks).toBe(1);
		expect(settings.hasAttribute("aria-pressed")).toBe(false);
		library.observer.disconnect();
	});

	test("preserves router history and ignores stale exit cleanup after fast re-entry", async () => {
		installDom(currentLibraryMarkup(), "https://chatgpt.com/library");
		const routerState = { __NA: true, tree: ["library"], userState: "keep" };
		window.history.replaceState(routerState, "");
		const library = initHighlightLibrary({
			loadRecords: async () => [record],
			poll: false,
		});
		const tab = document.querySelector<HTMLElement>(
			"[data-highlights-library-tab]",
		);
		tab?.click();
		const entries = window.history.length;
		tab?.click();
		expect(window.history.length).toBe(entries);
		expect(window.history.state).toEqual(routerState);
		document.querySelector<HTMLElement>(".tabs button")?.click();
		tab?.click();
		await new Promise((resolve) => setTimeout(resolve, 220));
		expect(window.location.search).toContain("view=highlights");
		expect(window.history.state).toEqual(routerState);
		library.observer.disconnect();
	});

	test("mounts outside the refreshed sticky shell and skips tab overflow decorations", async () => {
		installDom(
			currentLibraryMarkup(),
			"https://chatgpt.com/library?view=highlights",
		);
		const surface = document.querySelector<HTMLElement>(".surface");
		const header = document.querySelector("header");
		const sticky = document.querySelector<HTMLElement>(".sticky");
		const tabs = document.querySelector<HTMLElement>(".tabs");
		const body = document.querySelector<HTMLElement>(".native-body");
		if (!surface || !header || !sticky || !tabs || !body)
			throw new Error("Missing fixture shell");
		sticky.prepend(header);
		const overflow = document.createElement("div");
		tabs.before(overflow);
		overflow.append(tabs);
		const decoration = document.createElement("div");
		decoration.style.cssText =
			"position: absolute; pointer-events: none; display: none";
		overflow.after(decoration);
		surface.classList.add("group/page-table-scroll");
		body.innerHTML =
			'<div><button>Name</button><button>Last activity</button></div><div role="grid"><div role="row">Native file</div></div>';
		const library = initHighlightLibrary({
			loadRecords: async () => [record],
			poll: false,
		});
		await Promise.resolve();
		await Promise.resolve();
		const root = document.getElementById("highlights-library-root");
		expect(root?.closest(".sticky")).toBeNull();
		expect(root?.parentElement?.parentElement).toBe(body.parentElement);
		expect(root?.querySelectorAll("[data-highlight-record-id]").length).toBe(1);
		expect(body.hidden).toBe(true);
		expect(decoration.children.length).toBe(0);
		expect(
			decoration.hasAttribute("data-highlights-library-native-hidden"),
		).toBe(false);
		const replacement = document.createElement("div");
		replacement.innerHTML =
			'<div>Name · Last activity</div><div role="grid"><div role="row">Replacement file</div></div>';
		body.replaceWith(replacement);
		library.reconcile();
		expect(replacement.hidden).toBe(true);
		expect(
			document.querySelectorAll("[data-highlights-library-content-host]")
				.length,
		).toBe(1);
		expect(document.getElementById("highlights-library-root")).toBe(root);
		library.observer.disconnect();
	});

	test("keeps native controls visible while an empty body hydrates", async () => {
		installDom(libraryMarkup(), "https://chatgpt.com/library?view=highlights");
		const body = document.querySelector<HTMLElement>(".native-body");
		if (!body) throw new Error("Missing native body");
		body.replaceChildren();
		const library = initHighlightLibrary({
			loadRecords: async () => [record],
			poll: false,
		});
		await Promise.resolve();
		expect(
			document.querySelector<HTMLElement>(".native-controls")?.hidden,
		).toBe(false);
		expect(
			document.getElementById("highlights-library-root")?.closest(".sticky"),
		).toBeNull();
		body.innerHTML =
			"<table><tbody><tr><td>Loaded file</td></tr></tbody></table>";
		library.reconcile();
		expect(
			document.querySelector<HTMLElement>(".native-controls")?.hidden,
		).toBe(false);
		expect(body.hidden).toBe(true);
		library.observer.disconnect();
	});

	test("restores the entry and Export in the current Library without Documents", async () => {
		installDom(currentLibraryMarkup(), "https://chatgpt.com/library");
		const library = initHighlightLibrary({
			loadRecords: async () => [record],
			poll: false,
		});
		const tab = document.querySelector<HTMLElement>(
			"[data-highlights-library-tab]",
		);
		expect(tab?.textContent).toBe("Highlights");
		expect(tab?.className).toBe("native-tab");
		tab?.click();
		await Promise.resolve();
		await Promise.resolve();
		const root = document.getElementById("highlights-library-root");
		expect(root?.querySelectorAll("[data-highlight-record-id]").length).toBe(1);
		expect(root?.closest(".sticky, header")).toBeNull();
		expect(root?.closest(".new-library-scroll")).not.toBeNull();
		expect(tab?.className).toBe("native-tab bg-token-main-surface-secondary");
		expect(
			document.querySelector<HTMLElement>(
				".native-body:not([data-highlights-ui])",
			)?.hidden,
		).toBe(true);
		expect(
			document.querySelector("[data-highlights-library-export]"),
		).not.toBeNull();
		expect(
			document.querySelector<HTMLElement>(".native-controls")?.hidden,
		).toBe(false);
		for (let count = 0; count < 3; count++) library.reconcile();
		expect(
			document.querySelectorAll("[data-highlights-library-tab]").length,
		).toBe(1);
		expect(document.querySelectorAll("#highlights-library-root").length).toBe(
			1,
		);
		library.observer.disconnect();
	});

	for (const label of ["Suggested", "Folders", "Images", "All"]) {
		test(`exits Highlights through the native ${label} category`, async () => {
			installDom(
				currentLibraryMarkup(),
				"https://chatgpt.com/library?view=highlights",
			);
			const nativeTab = Array.from(
				document.querySelectorAll(".tabs button"),
			).find((button) => button.textContent === label) as HTMLElement;
			const originalClass = nativeTab.className;
			const library = initHighlightLibrary({
				loadRecords: async () => [record],
				poll: false,
			});
			await Promise.resolve();
			nativeTab.click();
			expect(window.location.search).not.toContain("view=highlights");
			expect(document.getElementById("highlights-library-root")).toBeNull();
			expect(
				document.querySelector("[data-highlights-library-export]"),
			).toBeNull();
			expect(
				document.querySelector("[data-highlights-library-content-host]"),
			).toBeNull();
			expect(
				document.querySelector<HTMLElement>(
					".native-body:not([data-highlights-ui])",
				)?.hidden,
			).toBe(false);
			expect(nativeTab.className).toBe(originalClass);
			expect(nativeTab.hasAttribute("aria-selected")).toBe(false);
			library.observer.disconnect();
		});
	}

	test("mounts after delayed native hydration and a subsequent native shell replacement", async () => {
		installDom(
			"<main><button>Documents</button></main>",
			"https://chatgpt.com/library?view=highlights",
		);
		let loads = 0;
		const library = initHighlightLibrary({
			loadRecords: async () => {
				loads++;
				return [record];
			},
			poll: false,
		});
		expect(document.querySelector("[data-highlights-library-tab]")).toBeNull();
		for (const body of [
			"<p>No files yet</p>",
			'<div><img alt="Saved image"></div>',
		]) {
			document.body.innerHTML = currentLibraryMarkup(body);
			library.reconcile();
			await Promise.resolve();
			await Promise.resolve();
			const root = document.getElementById("highlights-library-root");
			expect(root?.querySelectorAll("[data-highlight-record-id]").length).toBe(
				1,
			);
			expect(root?.closest(".sticky, header")).toBeNull();
			expect(
				document.querySelector<HTMLElement>(
					".native-body:not([data-highlights-ui])",
				)?.hidden,
			).toBe(true);
			expect(
				document.querySelectorAll("[data-highlights-library-tab]").length,
			).toBe(1);
		}
		expect(loads).toBe(2);
		library.observer.disconnect();
	});

	test("uses scoped semantic tabs when labels are localized and ignores hidden duplicates", async () => {
		const markup = currentLibraryMarkup()
			.replace("<h1>Library</h1>", "<h1>资料库</h1>")
			.replace('<div class="tabs">', '<div class="tabs" role="tablist">')
			.replaceAll("Suggested", "推荐")
			.replaceAll("Folders", "文件夹")
			.replaceAll("Images", "图片")
			.replaceAll("All", "全部");
		installDom(
			`<aside><button>Documents</button></aside><div hidden>${libraryMarkup()}</div>${markup}`,
			"https://chatgpt.com/library?view=highlights",
		);
		const library = initHighlightLibrary({
			loadRecords: async () => [record],
			poll: false,
		});
		await Promise.resolve();
		const tab = document.querySelector("[data-highlights-library-tab]");
		expect(tab?.closest("[role='tablist']")).not.toBeNull();
		expect(tab?.closest("[hidden], aside")).toBeNull();
		expect(
			document.querySelectorAll("[data-highlights-library-tab]").length,
		).toBe(1);
		library.observer.disconnect();
	});

	test("uses the native Library shell and groups local records by conversation", async () => {
		installDom(
			libraryMarkup(),
			"https://chatgpt.com/library?view=highlights&tab=files",
		);
		const controls = document.querySelector<HTMLElement>(".native-controls");
		const divider = document.querySelector<HTMLElement>(".native-divider");
		const filter = document.querySelector<HTMLButtonElement>(".native-filter");
		const grid = document.querySelector<HTMLButtonElement>(".native-grid");
		const list = document.querySelector<HTMLButtonElement>(".native-list");
		const newButton = document.querySelector<HTMLButtonElement>(".native-new");
		const allTab = Array.from(document.querySelectorAll("button")).find(
			(button) => button.textContent === "All",
		);
		const documentsTab = Array.from(document.querySelectorAll("button")).find(
			(button) => button.textContent === "Documents",
		);
		if (
			!controls ||
			!divider ||
			!filter ||
			!grid ||
			!list ||
			!newButton ||
			!allTab ||
			!documentsTab
		) {
			throw new Error("Missing native Library controls");
		}
		const inactiveTabClass = allTab.className;
		const activeTabClass = documentsTab.className;
		const nativePrimaryClass = newButton.className;
		const nativePrimaryContentClass = newButton.firstElementChild?.className;
		const nativePrimaryIcon = newButton.querySelector("svg")?.outerHTML;
		const nativeControlHtml = [filter, grid, list].map(
			(button) => button.innerHTML,
		);
		const nativeControlClasses = [filter, grid, list].map(
			(button) => button.className,
		);
		initHighlightLibrary({
			loadRecords: async () => [record, sameConversation, anotherConversation],
			poll: false,
		});
		await Promise.resolve();
		await Promise.resolve();

		const nativeTab = document.querySelector("[data-highlights-library-tab]");
		expect(nativeTab?.textContent).toBe("Highlights");
		expect(nativeTab?.getAttribute("aria-selected")).toBe("true");
		expect(nativeTab?.getAttribute("data-highlights-library-active")).toBe(
			"true",
		);
		const documents = Array.from(document.querySelectorAll("button")).find(
			(button) => button.textContent === "Documents",
		);
		expect(nativeTab?.firstElementChild?.tagName).toBe(
			documents?.firstElementChild?.tagName,
		);
		expect(nativeTab?.firstElementChild?.className).toBe(
			documents?.firstElementChild?.className,
		);
		expect(nativeTab?.textContent).toBe("Highlights");
		expect(nativeTab?.hasAttribute("style")).toBe(false);
		expect(documents?.className).toBe(inactiveTabClass);
		expect(nativeTab?.className).toBe(activeTabClass);
		const root = document.getElementById("highlights-library-root");
		expect(root).not.toBeNull();
		expect(
			root?.parentElement?.hasAttribute("data-highlights-library-content-host"),
		).toBe(true);
		expect(root?.closest(".sticky")).toBeNull();
		expect(root?.querySelector("h1")).toBeNull();
		expect(document.querySelector("table")?.hidden).toBe(true);
		expect(root?.querySelectorAll("[data-conversation-group]").length).toBe(2);
		expect(
			root?.querySelector("[data-conversation-group='chatgpt:library-thread']")
				?.textContent,
		).not.toContain("2 highlights");
		expect(
			root?.querySelector(".highlights-library-group-title strong")
				?.textContent,
		).toBe("A native Library test");
		expect(
			root?.querySelectorAll(
				"[data-conversation-group='chatgpt:library-thread'] [data-highlight-record-id]",
			).length,
		).toBe(2);
		expect(root?.querySelector(".highlights-library-color-dot")).not.toBeNull();
		expect(
			root?.querySelector(".highlights-library-native-check svg"),
		).not.toBeNull();
		const libraryCheckbox =
			root?.querySelector<HTMLInputElement>("[data-select-all]");
		expect(libraryCheckbox?.type).toBe("checkbox");
		expect(libraryCheckbox?.getAttribute("aria-label")).toBe(
			"Select all visible highlights",
		);
		expect(libraryCheckbox).not.toBe(document.querySelector("table input"));
		expect(document.querySelector("table input")?.className).toBe(
			"native-checkbox",
		);
		expect(root?.querySelector(".highlights-library-detail-rule")).toBeNull();
		const exportButton = document.querySelector<HTMLButtonElement>(
			"[data-highlights-library-export]",
		);
		expect(exportButton?.hidden).toBe(false);
		expect(exportButton?.className).toBe(nativePrimaryClass);
		expect(exportButton?.firstElementChild?.className).toBe(
			nativePrimaryContentClass,
		);
		expect(exportButton?.querySelector("svg")?.outerHTML).toBe(
			nativePrimaryIcon,
		);
		expect(exportButton?.getAttribute("aria-haspopup")).toBe("menu");
		expect(
			document.querySelector("[data-highlights-library-actions]"),
		).toBeNull();
		expect(document.querySelector(".native-controls")).toBe(controls);
		expect(document.querySelector(".native-divider")).toBe(divider);
		expect(document.querySelector(".native-filter")).toBe(filter);
		expect(document.querySelector(".native-grid")).toBe(grid);
		expect(document.querySelector(".native-list")).toBe(list);
		expect(controls.hidden).toBe(false);
		expect(divider.hidden).toBe(false);
		expect([filter, grid, list].map((button) => button.innerHTML)).toEqual(
			nativeControlHtml,
		);
		expect([filter, grid, list].map((button) => button.className)).toEqual(
			nativeControlClasses,
		);
		expect(filter.getAttribute("aria-label")).toBe("Open filters");
		expect(grid.getAttribute("aria-pressed")).toBe("false");
		expect(list.getAttribute("aria-pressed")).toBe("true");
	});

	test("reuses native filter and view controls and restores their exact state", async () => {
		installDom(libraryMarkup(), "https://chatgpt.com/library?view=highlights");
		const filter = document.querySelector<HTMLButtonElement>(".native-filter");
		const grid = document.querySelector<HTMLButtonElement>(".native-grid");
		const list = document.querySelector<HTMLButtonElement>(".native-list");
		if (!filter || !grid || !list) throw new Error("Missing native controls");
		const original = [filter, grid, list].map((button) => ({
			className: button.className,
			innerHTML: button.innerHTML,
			label: button.getAttribute("aria-label"),
			pressed: button.getAttribute("aria-pressed"),
			expanded: button.getAttribute("aria-expanded"),
			state: button.getAttribute("data-state"),
		}));
		initHighlightLibrary({ loadRecords: async () => [record], poll: false });
		await Promise.resolve();
		await Promise.resolve();

		grid.click();
		expect(grid.getAttribute("aria-pressed")).toBe("true");
		expect(list.getAttribute("aria-pressed")).toBe("false");
		expect(document.querySelector(".highlights-library-grid")).not.toBeNull();
		expect(
			document.querySelector(".highlights-library-card > header > div > span"),
		).toBeNull();

		let nativePointerDowns = 0;
		let nativeClicks = 0;
		document.body.addEventListener("pointerdown", () => nativePointerDowns++);
		document.body.addEventListener("click", () => nativeClicks++);
		filter.dispatchEvent(new Event("pointerdown", { bubbles: true }));
		expect(nativePointerDowns).toBe(0);
		filter.click();
		expect(nativeClicks).toBe(0);
		const menu = document.querySelector<HTMLElement>(
			"[data-highlights-library-filter-menu]",
		);
		expect(menu?.hidden).toBe(false);
		expect(menu?.parentElement).toBe(document.body);
		expect(filter.getAttribute("aria-expanded")).toBe("true");
		expect(filter.getAttribute("data-state")).toBe("open");
		expect(filter.getAttribute("aria-label")).toBe("Open filters");
		menu?.querySelector<HTMLButtonElement>("[data-color='yellow']")?.click();
		expect(menu?.hidden).toBe(true);
		expect(filter.getAttribute("aria-expanded")).toBe("false");
		expect(filter.getAttribute("data-state")).toBe("open");
		expect(filter.getAttribute("aria-pressed")).toBe("true");

		const documents = Array.from(document.querySelectorAll("button")).find(
			(button) => button.textContent === "Documents",
		) as HTMLButtonElement;
		documents.click();
		expect(document.querySelector(".native-filter")).toBe(filter);
		expect(document.querySelector(".native-grid")).toBe(grid);
		expect(document.querySelector(".native-list")).toBe(list);
		expect(
			document.querySelector("[data-highlights-library-filter-menu]"),
		).toBeNull();
		expect(
			[filter, grid, list].map((button) => ({
				className: button.className,
				innerHTML: button.innerHTML,
				label: button.getAttribute("aria-label"),
				pressed: button.getAttribute("aria-pressed"),
				expanded: button.getAttribute("aria-expanded"),
				state: button.getAttribute("data-state"),
			})),
		).toEqual(original);
	});

	test("selects one conversation for export and still opens a detail", async () => {
		installDom(libraryMarkup(), "https://chatgpt.com/library?view=highlights");
		initHighlightLibrary({
			loadRecords: async () => [record, sameConversation, anotherConversation],
			poll: false,
		});
		await Promise.resolve();
		await Promise.resolve();
		const root = document.getElementById("highlights-library-root");
		const groupCheckbox = root?.querySelector<HTMLInputElement>(
			"[data-select-thread='chatgpt:library-thread']",
		);
		if (!groupCheckbox) throw new Error("Missing conversation selector");
		groupCheckbox.checked = true;
		groupCheckbox.dispatchEvent(new Event("change", { bubbles: true }));

		const exportButton = document.querySelector<HTMLButtonElement>(
			"[data-highlights-library-export]",
		);
		expect(exportButton?.textContent).toBe("Export 2");
		exportButton?.click();
		const exportMenu = document.querySelector<HTMLElement>(
			".highlights-library-export-menu",
		);
		expect(exportMenu?.hidden).toBe(false);
		expect(exportMenu?.parentElement).toBe(document.body);
		expect(exportMenu?.style.top).not.toBe("");
		expect(exportMenu?.textContent).toContain("Selected · 2 highlights");
		expect(exportMenu?.textContent).toContain("Markdown");
		expect(exportButton?.getAttribute("aria-expanded")).toBe("true");
		expect(exportButton?.getAttribute("data-state")).toBe("open");
		expect(exportButton?.querySelector("svg use")).not.toBeNull();

		(root?.querySelector("[data-highlight-record-id]") as HTMLElement)?.click();
		expect(root?.classList.contains("highlights-library-detail-active")).toBe(
			true,
		);
		expect(
			root?.querySelector<HTMLAnchorElement>("a[href*='highlight=']")?.href,
		).toContain("highlight=library-record");
		expect(root?.textContent).toContain("In context");
		expect(
			root?.querySelector(".highlights-library-detail-text mark"),
		).not.toBeNull();
		const backButton = root?.querySelector<HTMLButtonElement>(
			"[data-highlights-library-back]",
		);
		expect(backButton?.textContent).toBe("←Back");
		expect(backButton?.getAttribute("aria-label")).toBe("Back to highlights");
		backButton?.click();
		expect(root?.classList.contains("highlights-library-detail-active")).toBe(
			false,
		);
		expect(root?.querySelector("[data-highlight-record-id]")).not.toBeNull();

		(root?.querySelector("[data-highlight-record-id]") as HTMLElement)?.click();
		expect(root?.classList.contains("highlights-library-detail-active")).toBe(
			true,
		);
		window.dispatchEvent(
			new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
		);
		expect(root?.classList.contains("highlights-library-detail-active")).toBe(
			false,
		);
	});

	test("searches locally and native tabs cleanly restore Documents", async () => {
		installDom(
			libraryMarkup(),
			"https://chatgpt.com/library?view=highlights&tab=files",
		);
		window.addEventListener(
			"input",
			() => {
				const url = new URL(window.location.href);
				url.searchParams.set("search", "no match");
				window.history.replaceState(window.history.state, "", url);
			},
			{ capture: true },
		);
		const originalDocuments = Array.from(
			document.querySelectorAll("button"),
		).find((button) => button.textContent === "Documents") as HTMLButtonElement;
		const originalDocumentsClass = originalDocuments.className;
		initHighlightLibrary({ loadRecords: async () => [record], poll: false });
		await Promise.resolve();
		await Promise.resolve();
		const input = document.querySelector<HTMLInputElement>(".native-search");
		if (!input) throw new Error("Missing native Library search input");
		let nativeSearchEvents = 0;
		document.body.addEventListener("input", () => nativeSearchEvents++);
		input.value = "no match";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		await Promise.resolve();
		expect(nativeSearchEvents).toBe(0);
		expect(window.location.search).not.toContain("search=");
		expect(
			document.getElementById("highlights-library-root")?.textContent,
		).toContain("No highlights found");

		const documents = Array.from(document.querySelectorAll("button")).find(
			(button) => button.textContent === "Documents",
		) as HTMLButtonElement;
		documents.click();
		expect(window.location.search).not.toContain("view=highlights");
		expect(document.getElementById("highlights-library-root")).toBeNull();
		expect(document.querySelector("table")?.hidden).toBe(false);
		expect(input.value).toBe("");
		expect(
			document.querySelector("button[data-highlights-library-native-tab]"),
		).toBeNull();
		expect(documents.hasAttribute("style")).toBe(false);
		expect(documents.className).toBe(originalDocumentsClass);
		expect(
			document.querySelector("[data-highlights-library-export-wrap]"),
		).toBeNull();
		expect(
			Array.from(document.querySelectorAll("button")).some(
				(button) => button.textContent === "New" && !button.hidden,
			),
		).toBe(true);
	});

	test("keeps row selection separate from opening a highlight detail", async () => {
		installDom(libraryMarkup(), "https://chatgpt.com/library?view=highlights");
		const library = initHighlightLibrary({
			loadRecords: async () => [record, sameConversation],
			poll: false,
		});
		await Promise.resolve();
		await Promise.resolve();
		const checkbox = document.querySelector<HTMLInputElement>(
			"[data-select-highlight='library-record']",
		);
		if (!checkbox) throw new Error("Missing highlight checkbox");
		checkbox.click();
		const root = document.getElementById("highlights-library-root");
		expect(root?.querySelector(".highlights-library-detail")).toBeNull();
		expect(root?.querySelectorAll("[data-highlight-record-id]").length).toBe(2);
		expect(
			root?.querySelector<HTMLInputElement>(
				"[data-select-highlight='library-record']",
			)?.checked,
		).toBe(true);
		expect(
			root?.querySelector<HTMLInputElement>("[data-select-thread]")
				?.indeterminate,
		).toBe(true);
		expect(
			root?.querySelector<HTMLInputElement>("[data-select-all]")?.indeterminate,
		).toBe(true);
		expect(
			document.querySelector("[data-highlights-library-export]")?.textContent,
		).toBe("Export 1");
		library.observer.disconnect();
	});
});
