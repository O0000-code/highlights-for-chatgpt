import { afterEach, describe, expect, test } from "bun:test";
import { initHighlightLibrary } from "../../src/content/library";
import {
	applyNativeLibraryComponents,
	captureNativeLibraryComponents,
} from "../../src/content/library-native";
import {
	DATA_SCHEMA_VERSION,
	type HighlightRecord,
} from "../../src/shared/types";
import { installDom } from "./test-environment";

type NativeFixtureOptions = {
	listCheckbox?: boolean;
	gridCheckbox?: boolean;
};

let fixture: ReturnType<typeof installDom> | undefined;
let controller: ReturnType<typeof initHighlightLibrary> | undefined;

afterEach(async () => {
	controller?.observer.disconnect();
	await fixture?.window.happyDOM.abort();
	controller = undefined;
	fixture = undefined;
});

function installNativeFixture(
	prefix: string,
	{ listCheckbox = true, gridCheckbox = true }: NativeFixtureOptions = {},
) {
	fixture = installDom(
		`<style>
			.native-page .${prefix}_selectableRow { position: relative; min-height: 60px; --native-row-source: ${prefix}; }
			.native-page .${prefix}_rowItem { display: grid; align-items: center; --native-item-source: ${prefix}; }
			.native-page .${prefix}_rowSelectionGroupMergeWithNext::before { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
			.native-page .${prefix}_rowSelectionGroupMergeWithPrevious::before { border-top-left-radius: 0; border-top-right-radius: 0; }
			.native-page .${prefix}_compactListColumns { grid-template-columns: minmax(0, 1fr) auto; }
			.native-page .${prefix}_desktopListColumnsWithoutSize { grid-template-columns: minmax(0, 1fr) 120px; }
			.native-page .${prefix}_refreshedGridSection { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
			.native-page .${prefix}_folderGridMetadata { min-width: 0; --native-metadata-source: ${prefix}; }
			.native-page .native-list-shell-${prefix} { position: absolute; left: var(--page-table-checkbox-inset); width: 24px; height: 24px; }
			.native-page .native-list-input-${prefix} { width: 18px; height: 18px; border-radius: 4px; }
			.native-page .native-grid-shell-${prefix} { position: absolute; bottom: 18px; right: 18px; }
			.native-page .native-grid-input-${prefix} { width: 20px; height: 20px; border-radius: 999px; }
		</style>
		<main class="native-page" style="--page-table-checkbox-inset: -45px">
			<div class="group/page-table-scroll">
				<div class="sticky"><header><h1>Library</h1><input type="search" placeholder="Search library"><button>New</button><button aria-label="Grid view"></button><button aria-label="List view"></button></header>
					<div class="native-tabs"><button aria-selected="true">Suggested</button><button>Folders</button><button>Images</button><button>All</button></div>
				</div>
				<div class="fixture-native-body">
					<div data-page-table-row-group class="fixture-native-list">
						<div data-page-table-selectable-row class="${prefix}_selectableRow">
							<div data-page-table-row-item class="${prefix}_rowItem ${prefix}_desktopListColumnsWithoutSize">
								${listCheckbox ? nativeCheckbox(prefix, "list") : ""}
								<span>Private native file title must not be cloned</span>
							</div>
						</div>
					</div>
					<div class="fixture-native-grid ${prefix}_refreshedGridSection">
						<div class="native-grid-card"><div class="native-grid-tile">Private native thumbnail must not be cloned</div>
							${gridCheckbox ? nativeCheckbox(prefix, "grid") : ""}
							<div class="${prefix}_folderGridMetadata">Private native folder title</div>
						</div>
					</div>
				</div>
			</div>
		</main>`,
		"https://chatgpt.com/library?view=highlights",
	);
	return requireElement<HTMLElement>("main");
}

function nativeCheckbox(prefix: string, view: "list" | "grid") {
	return `<span class="fixture-native-${view}-checkbox native-${view}-shell-${prefix}" id="native-${view}-shell" aria-label="Native selection wrapper">
		<input type="checkbox" class="peer native-${view}-input-${prefix} ${view === "grid" ? "rounded-full" : "rounded-sm"}" id="native-${view}-input" aria-label="Native file checkbox" aria-labelledby="native-file-label" aria-hidden="true" readonly tabindex="-1">
		<svg id="native-${view}-check" aria-hidden="true"><use href="/native-${prefix}.svg#${view}-check"></use></svg>
		<span class="native-${view}-mixed-${prefix}" aria-hidden="true"></span>
	</span>`;
}

function requireElement<T extends HTMLElement>(selector: string): T {
	const element = document.querySelector<T>(selector);
	if (!element) throw new Error(`Missing fixture element: ${selector}`);
	return element;
}

function createHighlightRoot(anchor: HTMLElement, view: "list" | "grid") {
	const root = document.createElement("section");
	root.id = "highlights-library-root";
	root.dataset.highlightsUi = "true";
	root.innerHTML =
		view === "list"
			? `<div class="highlights-library-selection-summary"><label class="highlights-library-check"><input type="checkbox" data-select-all aria-label="Select all visible highlights"></label></div>
				<div class="highlights-library-groups"><section class="highlights-library-group"><header><label class="highlights-library-check"><input type="checkbox" data-select-thread="chatgpt:own-thread" aria-label="Select own conversation"></label><div class="highlights-library-group-title"><strong>Own conversation</strong></div><time>Sep 12</time></header>
				<div class="highlights-library-records"><div data-highlights-row-wrap><div class="highlights-library-record-row" data-selected="true"><label class="highlights-library-check"><input type="checkbox" data-select-highlight="own-record" aria-label="Select own highlight" checked></label><button data-highlight-record-id="own-record"><span class="highlights-library-color-dot"></span><span class="highlights-library-record-text">Own highlighted passage</span></button><time>Sep 12</time></div></div></div></section></div>`
			: `<div class="highlights-library-selection-summary"><label class="highlights-library-check"><input type="checkbox" data-select-all aria-label="Select all visible highlights"></label></div>
				<div class="highlights-library-grid"><section class="highlights-library-card" data-selected="true"><div class="highlights-library-card-tile"><label class="highlights-library-check"><input type="checkbox" data-select-thread="chatgpt:own-thread" aria-label="Select own conversation" checked></label><button data-highlight-record-id="own-record">Own highlighted passage</button></div><header><div><strong>Own conversation</strong></div><time>Sep 12</time></header></section></div>`;
	if (view === "list") {
		const group = root.querySelector<HTMLInputElement>("[data-select-thread]");
		if (group) group.indeterminate = true;
	}
	anchor.append(root);
	return root;
}

describe("Native Library component reuse", () => {
	for (const prefix of ["liveAlpha91", "liveBeta27"]) {
		test(`uses the runtime stylesheet classes from ${prefix}`, () => {
			const anchor = installNativeFixture(prefix);
			const nativeBody = requireElement(".fixture-native-body");
			const nativeInput = requireElement<HTMLInputElement>(
				`.native-list-input-${prefix}`,
			);
			const originalMarkup = nativeBody.outerHTML;
			const components = captureNativeLibraryComponents(anchor);
			const root = createHighlightRoot(anchor, "list");
			applyNativeLibraryComponents(root, "list", components);
			const row = root.querySelector<HTMLElement>(
				".highlights-library-record-row",
			);
			expect(row?.classList.contains(`${prefix}_selectableRow`)).toBe(true);
			expect(row?.hasAttribute("data-page-table-selectable-row")).toBe(true);
			expect(
				row?.closest(`.${prefix}_rowItem[data-page-table-row-item]`),
			).not.toBeNull();
			expect(
				root.querySelector(`.${prefix}_desktopListColumnsWithoutSize`),
			).not.toBeNull();
			expect(
				root
					.querySelector(".highlights-library-groups")
					?.hasAttribute("data-page-table-row-group"),
			).toBe(true);
			expect(
				root
					.querySelector(".highlights-library-selection-summary")
					?.hasAttribute("data-page-table-list-header"),
			).toBe(true);
			expect(nativeBody.outerHTML).toBe(originalMarkup);
			expect(requireElement(`.native-list-input-${prefix}`)).toBe(nativeInput);
			expect(root.textContent).not.toContain("Private native");
		});
	}

	test("clones the complete list checkbox while keeping extension state and labels", () => {
		const anchor = installNativeFixture("listProof");
		const components = captureNativeLibraryComponents(anchor);
		const root = createHighlightRoot(anchor, "list");
		applyNativeLibraryComponents(root, "list", components);
		const input = root.querySelector<HTMLInputElement>(
			"[data-select-highlight='own-record']",
		);
		if (!input) throw new Error("Missing cloned list checkbox");
		expect(input.classList.contains("native-list-input-listProof")).toBe(true);
		expect(
			input.parentElement?.classList.contains("native-list-shell-listProof"),
		).toBe(true);
		expect(input.checked).toBe(true);
		expect(input.readOnly).toBe(false);
		expect(input.getAttribute("aria-label")).toBe("Select own highlight");
		expect(input.hasAttribute("aria-labelledby")).toBe(false);
		expect(input.hasAttribute("aria-hidden")).toBe(false);
		expect(input.getAttribute("tabindex")).not.toBe("-1");
		expect(root.querySelector("[id^='native-']")).toBeNull();
		expect(
			input.parentElement?.querySelector("svg use")?.getAttribute("href"),
		).toBe("/native-listProof.svg#list-check");
		expect(
			root.querySelector<HTMLInputElement>("[data-select-thread]")
				?.indeterminate,
		).toBe(true);
		applyNativeLibraryComponents(root, "list", components);
		expect(
			root.querySelectorAll("[data-select-highlight='own-record']").length,
		).toBe(1);
	});

	test("keeps list and grid checkbox templates and layout classes separate", () => {
		const anchor = installNativeFixture("contexts");
		const components = captureNativeLibraryComponents(anchor);
		const root = createHighlightRoot(anchor, "grid");
		applyNativeLibraryComponents(root, "grid", components);
		const cardInput = root.querySelector<HTMLInputElement>(
			".highlights-library-card [data-select-thread]",
		);
		if (!cardInput) throw new Error("Missing grid checkbox");
		expect(cardInput.classList.contains("native-grid-input-contexts")).toBe(
			true,
		);
		expect(cardInput.classList.contains("native-list-input-contexts")).toBe(
			false,
		);
		expect(
			cardInput.parentElement?.querySelector("svg use")?.getAttribute("href"),
		).toBe("/native-contexts.svg#grid-check");
		expect(getComputedStyle(cardInput).width).toBe("20px");
		expect(getComputedStyle(cardInput).borderRadius).toBe("999px");
		expect(
			root
				.querySelector(".highlights-library-grid")
				?.classList.contains("contexts_refreshedGridSection"),
		).toBe(true);
		expect(root.querySelector(".contexts_folderGridMetadata")).not.toBeNull();
		expect(
			root
				.querySelector<HTMLInputElement>("[data-select-all]")
				?.classList.contains("native-list-input-contexts"),
		).toBe(true);
	});

	test("does not borrow a circular grid checkbox for a list without a native list source", () => {
		const anchor = installNativeFixture("gridOnly", { listCheckbox: false });
		const components = captureNativeLibraryComponents(anchor);
		const root = createHighlightRoot(anchor, "list");
		applyNativeLibraryComponents(root, "list", components);
		const input = root.querySelector<HTMLInputElement>(
			"[data-select-highlight]",
		);
		expect(input?.classList.contains("native-grid-input-gridOnly")).toBe(false);
		expect(input?.parentElement?.querySelector("svg")).not.toBeNull();
		expect(input?.checked).toBe(true);
	});

	test("captures the current native grid dock without moving or changing its controls", () => {
		const anchor = installNativeFixture("dockContexts");
		const nativeShell = requireElement(".fixture-native-grid-checkbox");
		const nativeDock = document.createElement("div");
		nativeShell.before(nativeDock);
		nativeDock.append(nativeShell);
		for (const dockClass of [
			"absolute end-4.5 bottom-4.5 z-10 native-folder-dock",
			"absolute end-3 top-3 z-20 native-image-dock",
		]) {
			nativeDock.className = dockClass;
			const originalMarkup = nativeDock.outerHTML;
			const components = captureNativeLibraryComponents(anchor);
			const root = createHighlightRoot(anchor, "grid");
			applyNativeLibraryComponents(root, "grid", components);
			const ownDock = root.querySelector(
				".highlights-library-card .highlights-library-check",
			);
			for (const name of dockClass.split(" "))
				expect(ownDock?.classList.contains(name)).toBe(true);
			expect(nativeDock.outerHTML).toBe(originalMarkup);
			expect(nativeShell.parentElement).toBe(nativeDock);
			root.remove();
		}
	});

	test("does not merge a conversation header with a record from another conversation", () => {
		const anchor = installNativeFixture("adjacentProof");
		const components = captureNativeLibraryComponents(anchor);
		const root = createHighlightRoot(anchor, "list");
		const groups = root.querySelector(".highlights-library-groups");
		const firstGroup = root.querySelector<HTMLElement>(
			".highlights-library-group",
		);
		const firstRow = firstGroup?.querySelector<HTMLElement>(
			".highlights-library-record-row",
		);
		const header = firstGroup?.querySelector("header");
		if (!firstGroup || !firstRow || !groups || !header)
			throw new Error("Missing conversation fixture");
		const secondGroup = firstGroup.cloneNode(true) as HTMLElement;
		groups.append(secondGroup);
		const selectedTail = firstRow.parentElement?.cloneNode(true);
		if (selectedTail) firstRow.parentElement?.after(selectedTail);
		firstRow.dataset.selected = "false";
		header.dataset.selected = "true";
		applyNativeLibraryComponents(root, "list", components);
		// The group's first record is unselected. A selected record in the next
		// conversation is not adjacent to this header and must not flatten it.
		expect(
			header.classList.contains("adjacentProof_rowSelectionGroupMergeWithNext"),
		).toBe(false);
	});

	test("resynchronizes responsive native container classes without replacing content or selection", async () => {
		installNativeFixture("responsiveProof");
		const nativeBody = requireElement(".fixture-native-body");
		const wideClasses = "fixture-native-body ps-12! md:ps-12! pe-4";
		nativeBody.className = wideClasses;
		const record: HighlightRecord = {
			id: "responsive-first",
			schemaVersion: DATA_SCHEMA_VERSION,
			threadId: "chatgpt:responsive",
			url: "https://chatgpt.com/c/responsive",
			conversationTitle: "Responsive conversation",
			text: "A passage kept while resizing",
			prefix: "",
			suffix: "",
			color: "yellow",
			createdAt: 100,
			updatedAt: 100,
		};
		let loads = 0;
		controller = initHighlightLibrary({
			loadRecords: async () => {
				loads++;
				return [record, { ...record, id: "responsive-second" }];
			},
			poll: false,
		});
		controller.observer.disconnect();
		await Promise.resolve();
		await Promise.resolve();
		const root = requireElement("#highlights-library-root");
		const host = requireElement("[data-highlights-library-content-host]");
		expect(host.className).toBe(wideClasses);
		requireElement<HTMLInputElement>(
			"[data-select-highlight='responsive-first']",
		).click();
		const selectedInput = requireElement<HTMLInputElement>(
			"[data-select-highlight='responsive-first']",
		);
		const selectedRow = selectedInput.closest(".highlights-library-record-row");
		for (const classes of ["fixture-native-body px-4", wideClasses]) {
			nativeBody.className = classes;
			const nativeMarkup = nativeBody.outerHTML;
			controller.reconcile();
			expect(host.className).toBe(classes);
			expect(document.querySelector("#highlights-library-root") === root).toBe(
				true,
			);
			expect(root.parentElement === host).toBe(true);
			expect(
				root.querySelector("[data-select-highlight='responsive-first']") ===
					selectedInput,
			).toBe(true);
			expect(selectedRow?.getAttribute("data-selected")).toBe("true");
			expect(selectedInput.checked).toBe(true);
			expect(
				root.querySelector<HTMLInputElement>("[data-select-thread]")
					?.indeterminate,
			).toBe(true);
			expect(
				root.querySelectorAll(".highlights-library-record-row").length,
			).toBe(2);
			expect(root.textContent).toContain(record.text);
			expect(nativeBody.outerHTML).toBe(nativeMarkup);
			expect(loads).toBe(1);
		}
	});

	test("toggles each bridged list checkbox exactly once without altering native state or opening detail", async () => {
		installNativeFixture("bridgeProof");
		const nativeInput = requireElement<HTMLInputElement>(
			".native-list-input-bridgeProof",
		);
		nativeInput.checked = true;
		nativeInput.indeterminate = true;
		const nativeMarkup = nativeInput.outerHTML;
		let nativeChanges = 0;
		nativeInput.addEventListener("change", () => nativeChanges++);
		const record: HighlightRecord = {
			id: "bridge-first",
			schemaVersion: DATA_SCHEMA_VERSION,
			threadId: "chatgpt:bridge",
			url: "https://chatgpt.com/c/bridge",
			conversationTitle: "Bridge conversation",
			text: "First passage",
			prefix: "",
			suffix: "",
			color: "yellow",
			createdAt: 100,
			updatedAt: 100,
		};
		controller = initHighlightLibrary({
			loadRecords: async () => [
				record,
				{ ...record, id: "bridge-second", text: "Second passage" },
				{
					...record,
					id: "bridge-other",
					threadId: "chatgpt:other",
					url: "https://chatgpt.com/c/other",
				},
			],
			poll: false,
		});
		controller.observer.disconnect();
		await Promise.resolve();
		await Promise.resolve();
		const root = requireElement("#highlights-library-root");
		let changes = 0;
		root.addEventListener("change", () => changes++, true);
		const input = (selector: string) =>
			requireElement<HTMLInputElement>(`#highlights-library-root ${selector}`);
		const clickBridge = (selector: string) => {
			const bridge = input(selector)
				.closest("label")
				?.querySelector<HTMLElement>("[data-highlights-checkbox-bridge]");
			if (!bridge) throw new Error(`Missing checkbox bridge: ${selector}`);
			expect(bridge.tabIndex).toBe(-1);
			expect(bridge.getAttribute("aria-hidden")).toBe("true");
			bridge.click();
		};
		const groupSelector = "[data-select-thread='chatgpt:bridge']";
		expect(
			input(groupSelector).closest("label")?.control === input(groupSelector),
		).toBe(true);
		expect(input(groupSelector).checked).toBe(false);
		expect(input(groupSelector).indeterminate).toBe(false);
		clickBridge(groupSelector);
		expect(changes).toBe(1);
		expect(input(groupSelector).checked).toBe(true);
		expect(input("[data-select-highlight='bridge-first']").checked).toBe(true);
		expect(input("[data-select-highlight='bridge-second']").checked).toBe(true);
		expect(input("[data-select-highlight='bridge-other']").checked).toBe(false);
		expect(input("[data-select-all]").indeterminate).toBe(true);
		clickBridge(groupSelector);
		expect(changes).toBe(2);
		expect(input(groupSelector).checked).toBe(false);
		expect(input("[data-select-all]").indeterminate).toBe(false);
		input(groupSelector).focus();
		input(groupSelector).click();
		expect(changes).toBe(3);
		expect(document.activeElement).toBe(input(groupSelector));
		expect(input(groupSelector).checked).toBe(true);
		clickBridge("[data-select-all]");
		expect(changes).toBe(4);
		expect(input("[data-select-all]").checked).toBe(true);
		expect(input("[data-select-all]").indeterminate).toBe(false);
		clickBridge("[data-select-all]");
		expect(changes).toBe(5);
		expect(root.querySelectorAll("input:checked").length).toBe(0);
		expect(root.querySelector(".highlights-library-detail")).toBeNull();
		expect(nativeInput.outerHTML).toBe(nativeMarkup);
		expect(nativeInput.checked).toBe(true);
		expect(nativeInput.indeterminate).toBe(true);
		expect(nativeInput.readOnly).toBe(true);
		expect(nativeChanges).toBe(0);
	});

	test("renders check and mixed glyphs when native checkbox sources are absent", () => {
		const anchor = installNativeFixture("fallback", {
			listCheckbox: false,
			gridCheckbox: false,
		});
		const components = captureNativeLibraryComponents(anchor);
		const root = createHighlightRoot(anchor, "list");
		applyNativeLibraryComponents(root, "list", components);
		for (const selector of [
			"[data-select-highlight]",
			"[data-select-thread]",
		]) {
			const input = root.querySelector<HTMLInputElement>(selector);
			if (!input) throw new Error(`Missing fallback checkbox ${selector}`);
			const shell = input.parentElement;
			expect(input.className.length).toBeGreaterThan(0);
			expect(
				shell?.querySelector("svg use, svg path, svg polyline"),
			).not.toBeNull();
			expect(
				Array.from(shell?.children ?? []).some(
					(child) =>
						child.tagName === "SPAN" && child.hasAttribute("aria-hidden"),
				),
			).toBe(true);
		}
		expect(
			root.querySelector<HTMLInputElement>("[data-select-highlight]")?.checked,
		).toBe(true);
		expect(
			root.querySelector<HTMLInputElement>("[data-select-thread]")
				?.indeterminate,
		).toBe(true);
	});

	test("uses a truncating title box and preserves native list versus grid checkbox dimensions", async () => {
		installNativeFixture("rendered");
		const record: HighlightRecord = {
			id: "rendered-record",
			schemaVersion: DATA_SCHEMA_VERSION,
			threadId: "chatgpt:rendered",
			url: "https://chatgpt.com/c/rendered",
			conversationTitle: "A long conversation title that must truncate ".repeat(
				8,
			),
			text: "A useful passage.",
			prefix: "",
			suffix: "",
			color: "yellow",
			createdAt: 100,
			updatedAt: 100,
		};
		controller = initHighlightLibrary({
			loadRecords: async () => [record],
			poll: false,
		});
		controller.observer.disconnect();
		await Promise.resolve();
		await Promise.resolve();
		const title = requireElement(".highlights-library-group-title strong");
		expect(["block", "inline-block"]).toContain(
			getComputedStyle(title).display,
		);
		expect(getComputedStyle(title).overflow).toBe("hidden");
		expect(getComputedStyle(title).textOverflow).toBe("ellipsis");
		const listInput = requireElement<HTMLInputElement>(
			"#highlights-library-root [data-select-highlight]",
		);
		expect(getComputedStyle(listInput).width).toBe("18px");
		expect(getComputedStyle(listInput).borderRadius).toBe("4px");
		if (!fixture) throw new Error("Missing rendered viewport fixture");
		for (const width of [616, 823, 1071]) {
			fixture.window.happyDOM.setWindowSize({ width, height: 900 });
			const compactDates = document.querySelectorAll<HTMLElement>(
				"#highlights-library-root .highlights-library-compact-date",
			);
			expect(compactDates.length).toBe(2);
			for (const date of compactDates) {
				expect(getComputedStyle(date).display).toBe(
					width < 640 ? "block" : "none",
				);
				expect(
					date.previousElementSibling?.matches(
						"strong, .highlights-library-record-text",
					),
				).toBe(true);
			}
			for (const date of document.querySelectorAll<HTMLElement>(
				"#highlights-library-root .highlights-library-date",
			)) {
				expect(getComputedStyle(date).display === "none").toBe(width < 640);
			}
			const listDocks = document.querySelectorAll<HTMLElement>(
				"#highlights-library-root .highlights-library-check",
			);
			expect(listDocks.length).toBe(3);
			for (const dock of listDocks)
				expect(getComputedStyle(dock).display === "none").toBe(width < 1024);
		}
		requireElement<HTMLButtonElement>("[aria-label='Grid view']").click();
		const gridInput = requireElement<HTMLInputElement>(
			".highlights-library-card [data-select-thread]",
		);
		expect(getComputedStyle(gridInput).width).toBe("20px");
		expect(getComputedStyle(gridInput).borderRadius).toBe("999px");
		expect(gridInput.closest(".highlights-library-card-tile")).toBeNull();
		const selectionLayer = gridInput.closest(
			".highlights-library-card-selection-layer",
		);
		expect(
			selectionLayer?.parentElement?.classList.contains(
				"highlights-library-card",
			),
		).toBe(true);
		expect(
			selectionLayer?.previousElementSibling?.classList.contains(
				"highlights-library-card-tile",
			),
		).toBe(true);
		for (const width of [616, 823, 1071]) {
			fixture.window.happyDOM.setWindowSize({ width, height: 900 });
			const gridDock = gridInput.closest(".highlights-library-check");
			if (!gridDock) throw new Error("Missing grid checkbox dock");
			expect(getComputedStyle(gridDock).display).not.toBe("none");
			expect(getComputedStyle(gridInput).display).not.toBe("none");
			expect(getComputedStyle(gridInput).width).toBe("20px");
			const summaryDock = requireElement(
				".highlights-library-selection-summary > .highlights-library-check",
			);
			expect(getComputedStyle(summaryDock).display === "none").toBe(
				width < 1024,
			);
		}
	});
});
