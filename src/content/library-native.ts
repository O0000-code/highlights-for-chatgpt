/**
 * Runtime reuse of ChatGPT's Library components. Hashed CSS-module names are
 * discovered, never pinned. Only extension-owned nodes are changed. The utility
 * templates are the native September 2026 markup for cold/empty Library routes;
 * a live, matching component always takes precedence.
 */
import {
	createSpaceCheckbox,
	LIBRARY_CHECKBOX_SELECTOR,
	type LibraryCheckbox,
	syncSpaceCheckbox,
} from "./library-checkbox";
export interface NativeLibraryComponents {
	classes: Record<string, string>;
	listCheckbox?: HTMLElement;
	gridCheckbox?: HTMLElement;
	gridDockClass?: string;
	checkIcon?: SVGElement;
	spaceRowClass?: string;
	spaceGroupClass?: string;
	spaceCheckboxClass?: string;
	spaceCheckboxShellClass?: string;
	spaceGridCheckboxClass?: string;
	spaceGridClass?: string;
	spaceGridTileClass?: string;
	spaceListCheckboxButton?: HTMLButtonElement;
	spaceGridCheckboxButton?: HTMLButtonElement;
	spaceMixedIcon?: SVGElement;
}

const snapshots = new WeakMap<Document, NativeLibraryComponents>();
const scannedSheets = new WeakSet<CSSStyleSheet>();
const parts = [
	"selectableRow",
	"rowItem",
	"rowSelectionGroupMergeWithNext",
	"rowSelectionGroupMergeWithPrevious",
	"compactListColumns",
	"desktopListColumnsWithoutSize",
	"refreshedGridSection",
	"folderGridMetadata",
] as const;

const LIST_INPUT =
	"peer border-token-icon-secondary/20 bg-token-bg-primary focus:ring-offset-token-bg-primary focus-visible:ring-offset-token-bg-primary size-full cursor-pointer appearance-none rounded-[4px] border transition-colors checked:border-black checked:bg-black indeterminate:border-black indeterminate:bg-black focus:border-black focus:ring-2 focus:ring-black focus:ring-offset-1 focus:outline-none focus-visible:border-black focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-1 focus-visible:outline-none dark:checked:border-white dark:checked:bg-white dark:indeterminate:border-white dark:indeterminate:bg-white dark:focus:border-white dark:focus:ring-white dark:focus-visible:border-white dark:focus-visible:ring-white";
const GRID_INPUT =
	"bg-token-bg-primary/80 dark:bg-token-bg-secondary/80 peer border-token-border-heavy absolute inset-0 m-0 size-5 cursor-pointer appearance-none rounded-full border transition-[opacity,background-color,border-color,box-shadow] duration-200 ease-out dark:border-white/20 focus-visible:ring-token-ring focus-visible:ring-offset-token-bg-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";
const LIST_SHELL =
	"relative flex size-[18px] items-center justify-center transition-opacity";
const GRID_SHELL = "relative flex h-5 w-5 items-center justify-center";
const LIST_ICON =
	"pointer-events-none absolute inset-0 m-auto hidden h-3 w-3 text-white peer-checked:block peer-indeterminate:hidden dark:h-3.5 dark:w-3.5 dark:text-black";
const GRID_ICON =
	"pointer-events-none absolute h-3.5 w-3.5 text-black opacity-0 transition-opacity peer-checked:opacity-100 dark:text-black";
const MIXED_ICON =
	"pointer-events-none absolute inset-0 m-auto hidden h-[2px] w-2 rounded-full bg-white peer-indeterminate:block dark:bg-black";
const DOCK =
	"absolute start-[var(--page-table-checkbox-inset,-3rem)] top-0 z-10 flex h-full w-6 items-center justify-center";
const GRID_TILE =
	"border-token-border-light bg-token-bg-primary dark:bg-token-bg-secondary relative aspect-square w-full overflow-hidden rounded-2xl border shadow-elevation-01 transition-[background-color,border-color,ring-color] duration-200 ease-out";
const SPACE_GRID =
	"relative grid grid-cols-[repeat(var(--masonry-columns),minmax(0,1fr))] items-start gap-3 [--masonry-columns:1] sm:gap-4 @sm:[--masonry-columns:2] @xl:[--masonry-columns:3] @3xl:[--masonry-columns:4] @5xl:[--masonry-columns:5] @7xl:[--masonry-columns:6]";
const SPACE_GRID_TILE =
	"relative aspect-square w-full overflow-hidden rounded-2xl border bg-surface-elevated border-subtle shadow-card";
const GRID_SELECTED =
	"border-black ring-2 ring-black dark:border-white dark:ring-white";
const GRID_INPUT_SELECTED =
	"border-black bg-white opacity-100 dark:border-white dark:bg-white";
const REVEAL =
	"pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100";

export function captureNativeLibraryComponents(
	anchor: HTMLElement,
): NativeLibraryComponents {
	const doc = anchor.ownerDocument;
	const components = snapshots.get(doc) ?? { classes: {} };
	snapshots.set(doc, components);
	const spaceRow = Array.from(
		anchor.querySelectorAll<HTMLElement>("[role='row'][aria-selected]"),
	).find(
		(row) =>
			!row.closest("[data-highlights-ui]") &&
			row.getAttribute("aria-selected") === "false",
	);
	if (spaceRow) {
		components.spaceRowClass = spaceRow.className;
		components.spaceGroupClass =
			spaceRow.closest<HTMLElement>("[role='grid']")?.className;
	}
	for (const button of anchor.querySelectorAll<HTMLElement>(
		"button[role='checkbox']",
	)) {
		if (button.closest("[data-highlights-ui]")) continue;
		if (button.classList.contains("rounded-full")) {
			components.spaceGridCheckboxButton = button.cloneNode(
				true,
			) as HTMLButtonElement;
			components.spaceGridCheckboxClass = button.className;
			components.gridDockClass = button.parentElement?.parentElement?.className;
			components.spaceGridTileClass =
				button.closest<HTMLElement>(".overflow-hidden")?.className;
		} else {
			components.spaceCheckboxClass = button.className;
			components.spaceListCheckboxButton = button.cloneNode(
				true,
			) as HTMLButtonElement;
		}
		components.spaceCheckboxShellClass = button.parentElement?.className;
		const icon = button.querySelector<SVGElement>("svg");
		if (icon) {
			if (button.getAttribute("data-state") === "indeterminate")
				components.spaceMixedIcon = icon.cloneNode(true) as SVGElement;
			else components.checkIcon = icon.cloneNode(true) as SVGElement;
		}
	}
	const masonryItem = Array.from(
		anchor.querySelectorAll<HTMLElement>("[data-masonry-item]"),
	).find((element) => !element.closest("[data-highlights-ui]"));
	if (masonryItem?.parentElement)
		components.spaceGridClass = masonryItem.parentElement.className;
	// CSS modules remain loaded even if the native list has been unmounted by a
	// grid/empty route. Scan each sheet once, and retry inaccessible sheets later.
	for (const sheet of Array.from(doc.styleSheets)) {
		if (
			scannedSheets.has(sheet) ||
			sheet.ownerNode?.parentElement?.closest("[data-highlights-ui]")
		)
			continue;
		try {
			visitRules(sheet.cssRules, (selector) => {
				for (const part of parts) {
					const match = selector.match(
						new RegExp(`\\.([\\w-]+_${part})(?![\\w-])`),
					);
					if (match?.[1]) components.classes[part] = match[1];
				}
			});
			scannedSheets.add(sheet);
		} catch {
			/* Cross-origin sheets are not read or fetched. */
		}
	}
	for (const input of anchor.querySelectorAll<HTMLInputElement>(
		"input[type='checkbox']",
	)) {
		if (input.closest("[data-highlights-ui]")) continue;
		const shell = input.parentElement;
		if (!shell) continue;
		const grid =
			input.classList.contains("rounded-full") ||
			Boolean(shell.closest("[data-library-grid-tile]"));
		if (grid) {
			components.gridCheckbox = shell.cloneNode(true) as HTMLElement;
			components.gridDockClass = shell.parentElement?.className;
		} else components.listCheckbox = shell.cloneNode(true) as HTMLElement;
		const icon = shell.querySelector<SVGElement>("svg");
		if (icon) components.checkIcon = icon.cloneNode(true) as SVGElement;
	}
	return components;
}

function visitRules(rules: CSSRuleList, visitor: (selector: string) => void) {
	for (const rule of Array.from(rules)) {
		if ("selectorText" in rule) visitor(String(rule.selectorText));
		if ("cssRules" in rule)
			visitRules((rule as CSSGroupingRule).cssRules, visitor);
	}
}

function addClasses(element: Element, names: string) {
	for (const name of names.split(/\s+/).filter(Boolean))
		element.classList.add(name);
}

export function applyNativeLibraryComponents(
	root: HTMLElement,
	view: "list" | "grid",
	components: NativeLibraryComponents,
) {
	const space = Boolean(
		root.ownerDocument.defaultView?.location.pathname.replace(/\/$/, "") ===
			"/space" ||
			components.spaceRowClass ||
			components.spaceCheckboxClass ||
			components.spaceGridCheckboxClass,
	);
	// A warm Space document may also retain classic Library stylesheets. Mixing
	// those row/column classes paints an extra surface into the selection gutter.
	const c = space ? {} : components.classes;
	root.dataset.highlightsSpaceLibrary = String(space);
	if (space) root.classList.add("@container");
	root.dataset.highlightsNativeRows = String(Boolean(c.selectableRow));
	root.dataset.highlightsNativeGrid = String(
		Boolean(c.refreshedGridSection || space),
	);
	const columns = [c.compactListColumns, c.desktopListColumnsWithoutSize]
		.filter(Boolean)
		.join(" ");
	const summary = root.querySelector<HTMLElement>(
		".highlights-library-selection-summary",
	);
	if (summary) {
		addClasses(
			summary,
			`text-token-text-secondary group relative grid h-[42px] items-center gap-4 overflow-visible py-3 ps-0 pe-2 text-[14px] leading-5 ${columns}`,
		);
		summary.setAttribute("data-page-table-list-header", "true");
	}
	for (const group of root.querySelectorAll<HTMLElement>(
		".highlights-library-groups",
	)) {
		group.setAttribute("data-page-table-row-group", "true");
		addClasses(group, "flex flex-col");
		if (components.spaceGroupClass)
			addClasses(group, components.spaceGroupClass);
	}
	for (const wrapper of root.querySelectorAll<HTMLElement>(
		"[data-highlights-row-wrap]",
	)) {
		wrapper.setAttribute("data-page-table-row-item", "true");
		if (c.rowItem) addClasses(wrapper, c.rowItem);
	}
	for (const row of root.querySelectorAll<HTMLElement>(
		".highlights-library-record-row, .highlights-library-group > header",
	)) {
		row.setAttribute("data-page-table-selectable-row", "true");
		addClasses(
			row,
			`group ${c.selectableRow ?? ""} artifacts-surface-library-selectable-row ${columns}`,
		);
		row.setAttribute("aria-selected", row.dataset.selected ?? "false");
		if (components.spaceRowClass) addClasses(row, components.spaceRowClass);
		const previous = row.parentElement?.previousElementSibling?.querySelector(
			".highlights-library-record-row",
		);
		const next = row.parentElement?.nextElementSibling?.querySelector(
			".highlights-library-record-row",
		);
		if (space) {
			const record = row.classList.contains("highlights-library-record-row");
			row.dataset.highlightsMergePrevious = String(
				record &&
					row.dataset.selected === "true" &&
					previous?.getAttribute("data-selected") === "true",
			);
			row.dataset.highlightsMergeNext = String(
				record &&
					row.dataset.selected === "true" &&
					next?.getAttribute("data-selected") === "true",
			);
			if (!record) row.setAttribute("aria-selected", "false");
		}
		for (const [part, adjacent] of [
			["rowSelectionGroupMergeWithPrevious", previous],
			["rowSelectionGroupMergeWithNext", next],
		] as const) {
			if (c[part])
				row.classList.toggle(
					c[part],
					row.classList.contains("highlights-library-record-row") &&
						row.dataset.selected === "true" &&
						adjacent?.getAttribute("data-selected") === "true",
				);
		}
	}
	const grid = root.querySelector<HTMLElement>(".highlights-library-grid");
	if (grid && c.refreshedGridSection) addClasses(grid, c.refreshedGridSection);
	if (grid && space) addClasses(grid, components.spaceGridClass ?? SPACE_GRID);
	for (const card of root.querySelectorAll<HTMLElement>(
		".highlights-library-card",
	)) {
		addClasses(card, "group relative w-full min-w-0");
		const tile = card.querySelector<HTMLElement>(
			".highlights-library-card-tile",
		);
		if (tile) {
			addClasses(
				tile,
				space ? (components.spaceGridTileClass ?? SPACE_GRID_TILE) : GRID_TILE,
			);
			if (space) {
				tile.style.aspectRatio = "1";
				tile.style.width = "100%";
			}
			tile.setAttribute("data-library-grid-tile", "true");
			for (const name of GRID_SELECTED.split(" "))
				tile.classList.toggle(name, card.dataset.selected === "true");
		}
		const metadata = card.querySelector<HTMLElement>("header");
		if (metadata && c.folderGridMetadata)
			addClasses(metadata, c.folderGridMetadata);
	}
	for (const input of Array.from(
		root.querySelectorAll<LibraryCheckbox>(LIBRARY_CHECKBOX_SELECTOR),
	)) {
		const isGrid =
			view === "grid" && Boolean(input.closest(".highlights-library-card"));
		const alreadyApplied = input.closest<HTMLElement>(
			".highlights-library-native-check",
		);
		if (
			alreadyApplied &&
			input.matches("button[data-highlights-native-checkbox]")
		) {
			syncSpaceCheckbox(input, components, isGrid);
			continue;
		}
		if (alreadyApplied && !space) continue;
		if (alreadyApplied) alreadyApplied.replaceWith(input);
		const source = isGrid ? components.gridCheckbox : components.listCheckbox;
		const shell = space
			? createSpaceCheckbox(root.ownerDocument, components, isGrid)
			: ((source?.cloneNode(true) as HTMLElement | undefined) ??
				createCheckboxTemplate(
					root.ownerDocument,
					isGrid,
					components.checkIcon,
				));
		const control = shell.querySelector<LibraryCheckbox>(
			LIBRARY_CHECKBOX_SELECTOR,
		);
		if (!control) continue;
		const checked = input.checked;
		const mixed = input.indeterminate;
		for (const node of [shell, ...shell.querySelectorAll("*")]) {
			for (const attribute of Array.from(node.attributes)) {
				if (
					attribute.name === "id" ||
					attribute.name === "name" ||
					(attribute.name.startsWith("data-") && !space) ||
					attribute.name.startsWith("on") ||
					attribute.name.startsWith("aria-labelledby") ||
					attribute.name === "aria-describedby"
				)
					node.removeAttribute(attribute.name);
			}
		}
		control.removeAttribute("readonly");
		control.removeAttribute("aria-hidden");
		control.removeAttribute("tabindex");
		control.removeAttribute("checked");
		control.removeAttribute("aria-label");
		for (const attribute of Array.from(input.attributes)) {
			if (
				attribute.name !== "class" &&
				attribute.name !== "checked" &&
				attribute.name !== "type"
			)
				control.setAttribute(attribute.name, attribute.value);
		}
		control.checked = checked;
		control.indeterminate = mixed;
		addClasses(shell, "highlights-library-native-check");
		shell.dataset.highlightsCheckKind = isGrid ? "grid" : "list";
		shell.dataset.highlightsCheckSelected = String(checked || mixed);
		// Only dynamic visibility/selection classes are owned here; all native
		// geometry, themed colors, focus rings and glyph styles remain untouched.
		if (space) {
			// Visibility belongs to the hovered/focused row, not any host .group.
			for (const name of Array.from(shell.classList)) {
				if (name.includes("opacity") || name.includes("pointer-events"))
					shell.classList.remove(name);
			}
		} else if (isGrid) {
			for (const name of [
				...GRID_INPUT_SELECTED.split(" "),
				"opacity-0",
				"group-focus-within:opacity-100",
				"group-hover:opacity-100",
			])
				control.classList.remove(name);
			addClasses(
				control,
				checked || mixed
					? GRID_INPUT_SELECTED
					: "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
			);
		} else {
			for (const name of [
				"pointer-events-none",
				"pointer-events-auto",
				"opacity-0",
				"opacity-100",
				"group-hover:pointer-events-auto",
				"group-hover:opacity-100",
			])
				shell.classList.remove(name);
			addClasses(
				shell,
				checked || mixed ? "pointer-events-auto opacity-100" : REVEAL,
			);
		}
		if (!space && !shell.querySelector("span")) {
			const dash = root.ownerDocument.createElement("span");
			dash.setAttribute("aria-hidden", "true");
			dash.className = MIXED_ICON;
			if (space) {
				Object.assign(dash.style, {
					position: "absolute",
					width: "8px",
					height: "2px",
					left: "4px",
					display: mixed ? "block" : "none",
				});
			}
			shell.append(dash);
		}
		if (isGrid && !space)
			shell
				.querySelector("span")
				?.classList.add("highlights-library-grid-mixed");
		const dock = input.parentElement;
		if (dock?.classList.contains("highlights-library-check")) {
			dock.dataset.highlightsCheckKind = isGrid ? "grid" : "list";
			addClasses(
				dock,
				isGrid
					? (components.gridDockClass ?? "absolute z-10 end-4.5 bottom-4.5")
					: space
						? "absolute inset-y-0 -start-6 end-full z-10 flex cursor-default items-center"
						: DOCK,
			);
		}
		input.replaceWith(shell);
		if (!isGrid && dock?.classList.contains("highlights-library-check")) {
			// Keep the hover bridge non-labelable. Legacy inputs use the label's
			// default activation; controlled Space buttons are routed explicitly
			// by the root listener so a dock click toggles only once.
			const bridge = root.ownerDocument.createElement("span");
			bridge.dataset.highlightsCheckboxBridge = "true";
			bridge.setAttribute("aria-hidden", "true");
			bridge.className =
				"absolute start-5 top-0 m-0 h-full w-7 appearance-none border-0 bg-transparent p-0";
			dock.prepend(bridge);
		}
	}
}

function createCheckboxTemplate(
	doc: Document,
	grid: boolean,
	icon?: SVGElement,
) {
	const shell = doc.createElement("span");
	shell.className = grid ? GRID_SHELL : LIST_SHELL;
	const input = doc.createElement("input");
	input.type = "checkbox";
	input.className = grid ? GRID_INPUT : LIST_INPUT;
	const check =
		(icon?.cloneNode(true) as SVGElement | undefined) ??
		doc.createElementNS("http://www.w3.org/2000/svg", "svg");
	check.setAttribute("aria-hidden", "true");
	check.setAttribute("class", grid ? GRID_ICON : LIST_ICON);
	if (!check.firstElementChild) {
		check.setAttribute("viewBox", "0 0 16 16");
		const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("d", "M3 8l3 3 7-7");
		path.setAttribute("fill", "none");
		path.setAttribute("stroke", "currentColor");
		path.setAttribute("stroke-width", "1.5");
		check.append(path);
	}
	shell.append(input, check);
	return shell;
}
