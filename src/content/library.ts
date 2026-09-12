import {
	HIGHLIGHT_COLOR_TOKENS,
	HIGHLIGHT_COLORS,
	type HighlightColor,
} from "../shared/colors";
import {
	formatExportDate,
	getConversationTitle,
	highlightsToMarkdown,
	highlightsToPlainText,
} from "../shared/export";
import type { HighlightRecord } from "../shared/types";
import {
	applyNativeLibraryComponents,
	captureNativeLibraryComponents,
	type NativeLibraryComponents,
} from "./library-native";
import { sendRuntimeRequest } from "./runtime";

const ROOT_ID = "highlights-library-root";
const TAB_ATTRIBUTE = "data-highlights-library-tab";
const UI_ATTRIBUTE = "data-highlights-ui";
const NATIVE_HIDDEN_ATTRIBUTE = "data-highlights-library-native-hidden";
const CONTENT_HOST_ATTRIBUTE = "data-highlights-library-content-host";
const LIBRARY_PARAMETER = "view";
const LIBRARY_VALUE = "highlights";

type LibraryView = "list" | "grid";
type ColorFilter = "all" | HighlightColor;

interface LibraryState {
	records: HighlightRecord[];
	query: string;
	color: ColorFilter;
	view: LibraryView;
	selectedIds: Set<string>;
	selectedId?: string;
}

interface ConversationGroup {
	threadId: string;
	title: string;
	records: HighlightRecord[];
	latestSavedAt: number;
}

interface NativeLibraryParts {
	anchor: HTMLElement;
	nativeTabs: HTMLElement[];
	tabs: HTMLElement;
	toolbar: HTMLElement;
	nativeControls: HTMLButtonElement[];
	controlsContainer?: HTMLElement;
	search?: HTMLInputElement;
	newButton?: HTMLButtonElement;
	components: NativeLibraryComponents;
}

type NativeControlKind = "filter" | LibraryView;

interface NativeControlBinding {
	button: HTMLButtonElement;
	kind: NativeControlKind;
	baseline: Map<string, string | null>;
	active: boolean;
	state?: LibraryState;
	onStateChange?: () => void;
	menu?: HTMLElement;
	dismissMenu?: EventListener;
}

const MANAGED_NATIVE_CONTROL_ATTRIBUTES = [
	"aria-expanded",
	"aria-pressed",
	"aria-controls",
	"data-state",
] as const;
const nativeControlBindings = new Map<
	HTMLButtonElement,
	NativeControlBinding
>();

interface NativeTabSnapshot {
	className: string;
	ariaSelected: string | null;
	dataState: string | null;
}

const nativeTabSnapshots = new Map<HTMLElement, NativeTabSnapshot>();
const nativeTabExitBindings = new WeakSet<HTMLElement>();

interface NativeSearchBinding {
	input: HTMLInputElement;
	previousValue: string;
	previousSearchParameter: string | null;
	active: boolean;
	state: LibraryState;
	onStateChange: () => void;
}

const nativeSearchBindings = new Map<HTMLInputElement, NativeSearchBinding>();
const nativeSearchWindows = new WeakSet<Window>();
const libraryKeyboardBindings = new WeakMap<Window, EventListener>();

interface ExportControlBinding {
	wrap: HTMLElement;
	button: HTMLButtonElement;
	menu: HTMLElement;
	state: LibraryState;
}
const exportControlBindings = new WeakMap<Window, ExportControlBinding>();

/** Extends ChatGPT's real Library chrome instead of covering it with a replica. */
export function initHighlightLibrary(options?: {
	loadRecords?: () => Promise<HighlightRecord[]>;
	poll?: boolean;
}) {
	const state: LibraryState = {
		records: [],
		query: "",
		color: "all",
		view: "list",
		selectedIds: new Set(),
	};
	let generation = 0;
	let nativeNavigationUntil = 0;
	let navigationEpoch = 0;
	const render = () => {
		const root = document.getElementById(ROOT_ID);
		if (root instanceof HTMLElement) renderLibrary(root, state);
	};
	const previousKeyboardBinding = libraryKeyboardBindings.get(window);
	if (previousKeyboardBinding) {
		window.removeEventListener("keydown", previousKeyboardBinding);
	}
	const handleLibraryKeydown: EventListener = (event) => {
		const keyboardEvent = event as KeyboardEvent;
		if (keyboardEvent.key === "Escape" && closeLibraryPopovers(true)) {
			keyboardEvent.preventDefault();
			keyboardEvent.stopImmediatePropagation();
			return;
		}
		if (
			keyboardEvent.key !== "Escape" ||
			!state.selectedId ||
			!isHighlightLibraryActive()
		) {
			return;
		}
		state.selectedId = undefined;
		render();
	};
	window.addEventListener("keydown", handleLibraryKeydown);
	window.addEventListener("pointerdown", dismissLibraryPopoversOutside, true);
	libraryKeyboardBindings.set(window, handleLibraryKeydown);
	const reconcile = () => {
		if (!isLibraryRoute()) {
			teardownActiveLibrary();
			return;
		}
		if (Date.now() < nativeNavigationUntil) stripHighlightViewParameter();
		ensureStyles();
		const parts = findNativeLibraryParts();
		const nativeTab = parts && ensureNativeTab(parts, activateLibrary);
		if (parts) bindNativeTabExits(parts.nativeTabs, deactivateLibrary);
		if (!isHighlightLibraryActive()) {
			nativeTab?.setAttribute("aria-selected", "false");
			teardownActiveLibrary();
			return;
		}
		if (!parts) return;
		syncNativeTabs(true, parts.nativeTabs);
		const root = ensureRoot(parts, state, render);
		integrateWithNativeLibrary(root, parts, state, render);
		if (root.dataset.highlightsLoaded) return;
		root.dataset.highlightsLoaded = "loading";
		const requestGeneration = ++generation;
		void (
			options?.loadRecords?.() ??
			sendRuntimeRequest<HighlightRecord[]>({ type: "LIST_HIGHLIGHTS" })
		)
			.then((records) => {
				if (generation !== requestGeneration || !root.isConnected) return;
				root.dataset.highlightsLoaded = "true";
				state.records = hydrateConversationTitles(records).sort(
					(left, right) => right.createdAt - left.createdAt,
				);
				state.selectedIds = new Set(
					[...state.selectedIds].filter((id) =>
						state.records.some((record) => record.id === id),
					),
				);
				render();
			})
			.catch((error: unknown) => {
				if (generation !== requestGeneration || !root.isConnected) return;
				root.dataset.highlightsLoaded = "error";
				console.error("Could not load the highlight Library", error);
				showLibraryError(root);
			});
	};
	const observer = new MutationObserver((mutations) => {
		if (mutations.every(isLibraryUiMutation)) return;
		window.setTimeout(reconcile, 80);
	});
	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
	});
	window.addEventListener("popstate", () => {
		navigationEpoch++;
		nativeNavigationUntil = 0;
		reconcile();
	});
	window.addEventListener("resize", reconcile);
	const refreshRecords = () => {
		if (!isHighlightLibraryActive()) return;
		const root = document.getElementById(ROOT_ID);
		if (root?.dataset.highlightsLoaded === "loading") return;
		if (root) delete root.dataset.highlightsLoaded;
		reconcile();
	};
	window.addEventListener("focus", refreshRecords);
	window.addEventListener("pageshow", refreshRecords);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") refreshRecords();
	});
	if (options?.poll !== false) window.setInterval(reconcile, 650);
	reconcile();
	return { reconcile, observer };

	function activateLibrary() {
		navigationEpoch++;
		nativeNavigationUntil = 0;
		if (isHighlightLibraryActive()) {
			reconcile();
			return;
		}
		const url = new URL(window.location.href);
		url.pathname = "/library";
		url.searchParams.set(LIBRARY_PARAMETER, LIBRARY_VALUE);
		window.history.pushState(window.history.state, "", url);
		reconcile();
	}
	function deactivateLibrary() {
		const epoch = ++navigationEpoch;
		nativeNavigationUntil = Date.now() + 600;
		stripHighlightViewParameter();
		teardownActiveLibrary();
		const cleanup = () => {
			if (navigationEpoch === epoch) stripHighlightViewParameter();
		};
		window.setTimeout(cleanup, 0);
		window.setTimeout(cleanup, 180);
	}
}

function ensureNativeTab(parts: NativeLibraryParts, onActivate: () => void) {
	const reference = parts.nativeTabs.at(-1);
	if (!reference) return null;
	const existing = parts.tabs.querySelector<HTMLElement>(`[${TAB_ATTRIBUTE}]`);
	if (existing) {
		const active = isHighlightLibraryActive();
		existing.setAttribute("aria-selected", String(active));
		existing.dataset.highlightsLibraryActive = String(active);
		if (existing.hasAttribute("data-state")) {
			existing.dataset.state = active ? "active" : "inactive";
		}
		return existing;
	}
	const tab = reference.cloneNode(true) as HTMLElement;
	for (const element of [tab, ...tab.querySelectorAll("[id]")]) {
		element.removeAttribute("id");
	}
	for (const attribute of [
		"href",
		"aria-controls",
		"aria-labelledby",
		"aria-current",
		"tabindex",
	]) {
		tab.removeAttribute(attribute);
	}
	if (tab.tagName === "A") tab.setAttribute("tabindex", "0");
	copyNativeTabContents(
		reference,
		tab,
		reference.textContent?.trim() ?? "",
		"Highlights",
	);
	tab.setAttribute("aria-label", "Highlights");
	tab.setAttribute(TAB_ATTRIBUTE, "true");
	tab.setAttribute(UI_ATTRIBUTE, "true");
	tab.setAttribute("aria-selected", String(isHighlightLibraryActive()));
	tab.dataset.highlightsLibraryActive = String(isHighlightLibraryActive());
	if (tab.hasAttribute("data-state")) {
		tab.dataset.state = isHighlightLibraryActive() ? "active" : "inactive";
	}
	tab.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		onActivate();
	});
	reference.after(tab);
	syncNativeTabs(false, parts.nativeTabs);
	return tab;
}

function copyNativeTabContents(
	source: HTMLElement,
	target: HTMLElement,
	currentLabel: string,
	nextLabel: string,
) {
	target.replaceChildren(
		...Array.from(source.childNodes, (child) => child.cloneNode(true)),
	);
	replaceTextNode(target, currentLabel, nextLabel);
}

function replaceTextNode(
	root: Node,
	currentLabel: string,
	nextLabel: string,
): boolean {
	return replaceTextMatching(
		root,
		(value) => value === currentLabel,
		nextLabel,
	);
}

function bindNativeTabExits(nativeTabs: HTMLElement[], onExit: () => void) {
	for (const button of nativeTabs) {
		if (nativeTabExitBindings.has(button)) continue;
		nativeTabExitBindings.add(button);
		button.addEventListener("click", onExit, { capture: true });
	}
}

function findNativeLibraryParts(): NativeLibraryParts | null {
	const heading = findHeading();
	if (!heading) return null;
	const anchor = findContainingSurface(heading);
	if (!anchor) return null;
	const group = findNativeTabGroup(anchor);
	if (!group) return null;
	const { tabs, nativeTabs } = group;
	const nativeControls = findNativeControlButtons(anchor, tabs);
	const controlsContainer = findControlsContainer(nativeControls, tabs);
	const toolbar =
		findCommonAncestor(tabs, controlsContainer ?? nativeControls[0], anchor) ??
		tabs.parentElement ??
		tabs;
	return {
		anchor,
		nativeTabs,
		tabs,
		toolbar,
		nativeControls,
		controlsContainer,
		search: findNativeLibrarySearch(anchor),
		newButton: Array.from(
			anchor.querySelectorAll<HTMLButtonElement>("button"),
		).find(
			(button) =>
				/^(New|新建)$/.test(button.textContent?.trim() ?? "") &&
				!button.closest(`[${UI_ATTRIBUTE}]`),
		),
		components: captureNativeLibraryComponents(anchor),
	};
}

function findNativeLibrarySearch(anchor: HTMLElement) {
	return Array.from(anchor.querySelectorAll<HTMLInputElement>("input")).find(
		(input) =>
			input.type === "search" ||
			/(?:search|搜索)/i.test(
				`${input.placeholder} ${input.getAttribute("aria-label") ?? ""}`,
			),
	);
}

function findNativeControlButtons(anchor: HTMLElement, tabs: HTMLElement) {
	const candidates = Array.from(
		anchor.querySelectorAll<HTMLButtonElement>("button"),
	)
		.filter(
			(button) =>
				!tabs.contains(button) &&
				!button.closest(`[${UI_ATTRIBUTE}='true']`) &&
				!button.closest("table, [role='table'], [role='grid']"),
		)
		.sort(compareVisibleFirst);
	return (["filter", "grid", "list"] as const)
		.map((kind) =>
			candidates.find((button) =>
				new RegExp(kind, "i").test(
					`${button.getAttribute("aria-label") ?? ""} ${button.title}`,
				),
			),
		)
		.filter((button): button is HTMLButtonElement => Boolean(button));
}

function findControlsContainer(
	controls: HTMLButtonElement[],
	tabs: HTMLElement,
) {
	if (controls.length === 0) return undefined;
	let current: HTMLElement | null = controls[0]?.parentElement ?? null;
	while (current && current !== document.body) {
		if (controls.every((button) => current?.contains(button))) {
			return current.contains(tabs) ? undefined : current;
		}
		current = current.parentElement;
	}
	return undefined;
}

function findCommonAncestor(
	left: HTMLElement,
	right: HTMLElement | undefined,
	boundary: HTMLElement,
) {
	if (!right) return undefined;
	let current: HTMLElement | null = left.parentElement;
	while (current) {
		if (current.contains(right)) return current;
		if (current === boundary) break;
		current = current.parentElement;
	}
	return undefined;
}

function ensureRoot(
	parts: NativeLibraryParts,
	state: LibraryState,
	onStateChange: () => void,
) {
	const existing = document.getElementById(ROOT_ID);
	if (existing instanceof HTMLElement) return existing;
	const root = document.createElement("section");
	root.id = ROOT_ID;
	root.setAttribute(UI_ATTRIBUTE, "true");
	root.setAttribute("aria-label", "Highlights");
	root.innerHTML = `<div class="highlights-library-content" aria-live="polite"></div>`;
	parts.anchor.append(root);
	root.addEventListener("click", (event) => {
		const target = event.target as Element;
		if (target.closest(".highlights-library-check")) {
			event.stopPropagation();
			return;
		}
		if (target.closest("[data-highlights-library-back]")) {
			state.selectedId = undefined;
			onStateChange();
			return;
		}
		const recordButton =
			target.closest<HTMLElement>("[data-highlight-record-id]") ??
			target
				.closest(".highlights-library-record-row")
				?.querySelector<HTMLElement>("[data-highlight-record-id]");
		if (recordButton) {
			closeLibraryPopovers();
			state.selectedId = recordButton.dataset.highlightRecordId;
			onStateChange();
			return;
		}
		if (target.closest("[data-clear-selection]")) {
			state.selectedIds.clear();
			onStateChange();
		}
	});
	root.addEventListener("change", (event) => {
		const input = event.target;
		if (!(input instanceof HTMLInputElement) || input.type !== "checkbox")
			return;
		if (input.dataset.selectAll !== undefined) {
			for (const record of getFilteredRecords(state)) {
				if (input.checked) state.selectedIds.add(record.id);
				else state.selectedIds.delete(record.id);
			}
		} else if (input.dataset.selectThread) {
			const group = groupByConversation(getFilteredRecords(state)).find(
				(item) => item.threadId === input.dataset.selectThread,
			);
			for (const record of group?.records ?? []) {
				if (input.checked) state.selectedIds.add(record.id);
				else state.selectedIds.delete(record.id);
			}
		} else if (input.dataset.selectHighlight) {
			if (input.checked) state.selectedIds.add(input.dataset.selectHighlight);
			else state.selectedIds.delete(input.dataset.selectHighlight);
		}
		const key = ["selectAll", "selectThread", "selectHighlight"].find(
			(key) => input.dataset[key] !== undefined,
		);
		const focused = document.activeElement === input;
		const value = key && input.dataset[key];
		onStateChange();
		if (focused && key) {
			Array.from(
				root.querySelectorAll<HTMLInputElement>("input[type='checkbox']"),
			)
				.find((candidate) => candidate.dataset[key] === value)
				?.focus({ preventScroll: true });
		}
	});
	root.addEventListener("keydown", (event) => {
		const target = event.target;
		if (
			event.key === "Enter" &&
			target instanceof HTMLElement &&
			target.matches(".highlights-library-record-row")
		) {
			event.preventDefault();
			target
				.querySelector<HTMLButtonElement>("[data-highlight-record-id]")
				?.click();
		}
	});
	return root;
}

function integrateWithNativeLibrary(
	root: HTMLElement,
	parts: NativeLibraryParts,
	state: LibraryState,
	onStateChange: () => void,
) {
	ensureNativeActions(parts, state, onStateChange);
	ensureExportControl(parts, state);
	bindNativeSearch(parts.search, state, onStateChange);
	mountInNativeContentSurface(root, parts);
	applyNativeLibraryComponents(root, state.view, parts.components);
	hideNativeLibraryBody(root, parts);
}

function mountInNativeContentSurface(
	root: HTMLElement,
	parts: NativeLibraryParts,
) {
	const existing = parts.anchor.querySelector<HTMLElement>(
		`[${CONTENT_HOST_ATTRIBUTE}]`,
	);
	// Follow the tab branch to its content siblings, not a version-specific class
	// or the toolbar (which now lives above the tabs, beside the Library heading).
	let branch: HTMLElement | null = parts.tabs;
	let bodies: HTMLElement[] = [];
	while (branch && branch !== parts.anchor) {
		bodies = [];
		let sibling = branch.nextElementSibling;
		while (sibling) {
			if (
				sibling instanceof HTMLElement &&
				!sibling.hasAttribute(UI_ATTRIBUTE) &&
				!sibling.matches("style, script") &&
				isNativeContentCandidate(sibling) &&
				!parts.nativeControls.some((control) => sibling?.contains(control)) &&
				!(parts.search && sibling.contains(parts.search)) &&
				!(parts.newButton && sibling.contains(parts.newButton))
			) {
				bodies.push(sibling);
			}
			sibling = sibling.nextElementSibling;
		}
		if (bodies.length) break;
		branch = branch.parentElement;
	}
	const nativeBody = bodies[0];
	if (!nativeBody) return;
	// Reuse content gutters, but never clone table/grid semantics into our host.
	const host = existing ?? document.createElement("div");
	if (
		nativeBody.tagName === "DIV" &&
		!nativeBody.hasAttribute("role") &&
		host.className !== nativeBody.className
	) {
		// The host changes selection gutters when its responsive layout changes.
		// Keep following the live container, not only the initial desktop clone.
		host.className = nativeBody.className;
	}
	host.setAttribute(CONTENT_HOST_ATTRIBUTE, "true");
	host.setAttribute(UI_ATTRIBUTE, "true");
	if (!existing) nativeBody.before(host);
	if (!host.contains(root)) host.append(root);
	for (const body of bodies) markNativeHidden(body);
}

function isNativeContentCandidate(element: HTMLElement) {
	if (element.hasAttribute(NATIVE_HIDDEN_ATTRIBUTE)) return true;
	const style = getComputedStyle(element);
	if (
		style.display === "none" ||
		style.visibility === "hidden" ||
		style.position === "absolute" ||
		style.position === "fixed" ||
		style.pointerEvents === "none"
	)
		return false;
	return Boolean(
		element.textContent?.trim() ||
			element.matches("table, [role='grid'], [role='table']") ||
			element.querySelector(
				"table, [role='grid'], [role='table'], img, [aria-busy='true']",
			),
	);
}

function hideNativeLibraryBody(root: HTMLElement, parts: NativeLibraryParts) {
	for (const candidate of parts.anchor.querySelectorAll<HTMLElement>(
		"table, [role='table'], [role='grid']",
	)) {
		if (!root.contains(candidate)) markNativeHidden(candidate);
	}
}

function ensureNativeActions(
	parts: NativeLibraryParts,
	state: LibraryState,
	onStateChange: () => void,
) {
	const activeButtons = new Set(parts.nativeControls);
	for (const [button, binding] of nativeControlBindings) {
		if (binding.active && !activeButtons.has(binding.button)) {
			deactivateNativeControl(binding);
		}
		if (!activeButtons.has(button)) {
			button.removeEventListener("click", handleNativeControlClick, true);
			button.removeEventListener(
				"pointerdown",
				handleNativeControlPointerDown,
				true,
			);
			button.removeEventListener("keydown", handleNativeControlKeyDown, true);
			nativeControlBindings.delete(button);
		}
	}
	for (const kind of ["filter", "grid", "list"] as const) {
		const button = getNativeControl(parts, kind);
		if (!button) continue;
		let binding = nativeControlBindings.get(button);
		if (!binding) {
			binding = {
				button,
				kind,
				baseline: captureNativeControlState(button),
				active: false,
			};
			nativeControlBindings.set(button, binding);
			button.addEventListener("click", handleNativeControlClick, true);
			button.addEventListener(
				"pointerdown",
				handleNativeControlPointerDown,
				true,
			);
			button.addEventListener("keydown", handleNativeControlKeyDown, true);
		}
		if (!binding.active) {
			binding.baseline = captureNativeControlState(button);
		}
		binding.kind = kind;
		binding.active = true;
		binding.state = state;
		binding.onStateChange = onStateChange;
		if (kind === "filter") binding.menu = ensureNativeFilterMenu();
	}
	syncNativeControlState(parts, state);
	const filterBinding = getNativeControlBinding(parts, "filter");
	if (filterBinding?.menu && !filterBinding.menu.hidden) {
		positionFloatingMenu(filterBinding.button, filterBinding.menu);
	}
}

function getNativeControl(parts: NativeLibraryParts, kind: NativeControlKind) {
	return parts.nativeControls.find((button) =>
		new RegExp(kind, "i").test(
			`${button.getAttribute("aria-label") ?? ""} ${button.title}`,
		),
	);
}

function getNativeControlBinding(
	parts: NativeLibraryParts,
	kind: NativeControlKind,
) {
	const button = getNativeControl(parts, kind);
	return button ? nativeControlBindings.get(button) : undefined;
}

function captureNativeControlState(button: HTMLButtonElement) {
	return new Map(
		MANAGED_NATIVE_CONTROL_ATTRIBUTES.map((attribute) => [
			attribute,
			button.getAttribute(attribute),
		]),
	);
}

function restoreNativeControlState(binding: NativeControlBinding) {
	for (const attribute of MANAGED_NATIVE_CONTROL_ATTRIBUTES) {
		const value = binding.baseline.get(attribute) ?? null;
		if (value === null) binding.button.removeAttribute(attribute);
		else binding.button.setAttribute(attribute, value);
	}
}

function handleNativeControlClick(event: Event) {
	const button = event.currentTarget;
	if (!(button instanceof HTMLElement) || button.tagName !== "BUTTON") return;
	const binding = nativeControlBindings.get(button as HTMLButtonElement);
	if (!shouldInterceptNativeControl(binding)) return;
	event.preventDefault();
	event.stopImmediatePropagation();
	if (binding.kind === "filter") {
		toggleNativeFilterMenu(binding);
		return;
	}
	binding.state.view = binding.kind;
	binding.state.selectedId = undefined;
	binding.onStateChange?.();
}

function handleNativeControlPointerDown(event: Event) {
	const button = event.currentTarget;
	if (!(button instanceof HTMLElement) || button.tagName !== "BUTTON") return;
	const binding = nativeControlBindings.get(button as HTMLButtonElement);
	if (!shouldInterceptNativeControl(binding)) return;
	event.stopImmediatePropagation();
}

function handleNativeControlKeyDown(event: KeyboardEvent) {
	const button = event.currentTarget;
	if (!(button instanceof HTMLElement) || button.tagName !== "BUTTON") return;
	const binding = nativeControlBindings.get(button as HTMLButtonElement);
	if (!shouldInterceptNativeControl(binding)) return;
	if (binding.kind !== "filter" || !["Enter", " "].includes(event.key)) return;
	event.preventDefault();
	event.stopImmediatePropagation();
	toggleNativeFilterMenu(binding);
}

function shouldInterceptNativeControl(
	binding: NativeControlBinding | undefined,
): binding is NativeControlBinding & { state: LibraryState } {
	return Boolean(
		binding?.active && binding.state && isHighlightLibraryActive(),
	);
}

function ensureNativeFilterMenu() {
	let menu = document.querySelector<HTMLElement>(
		"[data-highlights-library-filter-menu]",
	);
	if (menu) return menu;
	menu = document.createElement("div");
	menu.className = "highlights-library-popover highlights-library-filter-menu";
	menu.dataset.highlightsLibraryFilterMenu = "true";
	menu.setAttribute(UI_ATTRIBUTE, "true");
	menu.hidden = true;
	document.body.append(menu);
	return menu;
}

function toggleNativeFilterMenu(binding: NativeControlBinding) {
	const state = binding.state;
	if (!state) return;
	const menu = binding.menu ?? ensureNativeFilterMenu();
	binding.menu = menu;
	if (!menu.hidden) {
		closeNativeFilterMenu(binding);
		return;
	}
	for (const other of nativeControlBindings.values()) {
		if (other !== binding && other.kind === "filter")
			closeNativeFilterMenu(other);
	}
	const exporting = exportControlBindings.get(window);
	if (exporting) closeExportMenu(exporting.button, exporting.menu);
	menu.hidden = false;
	binding.button.setAttribute("aria-expanded", "true");
	binding.button.setAttribute("data-state", "open");
	renderFilterMenu(menu, state, () => {
		closeNativeFilterMenu(binding);
		binding.onStateChange?.();
	});
	positionFloatingMenu(binding.button, menu);
	const dismiss: EventListener = (outsideEvent) => {
		const target = outsideEvent.target;
		if (!(target instanceof Node)) return;
		if (binding.button.contains(target) || menu.contains(target)) return;
		closeNativeFilterMenu(binding);
	};
	binding.dismissMenu = dismiss;
	document.addEventListener("pointerdown", dismiss, true);
}

function closeNativeFilterMenu(binding: NativeControlBinding) {
	if (binding.menu) binding.menu.hidden = true;
	if (binding.dismissMenu) {
		document.removeEventListener("pointerdown", binding.dismissMenu, true);
		binding.dismissMenu = undefined;
	}
	for (const attribute of ["aria-expanded", "data-state"] as const) {
		const value = binding.baseline.get(attribute) ?? null;
		if (value === null) binding.button.removeAttribute(attribute);
		else binding.button.setAttribute(attribute, value);
	}
	if (binding.state) syncNativeFilterState(binding, binding.state);
}

function syncNativeControlState(
	parts: NativeLibraryParts,
	state: LibraryState,
) {
	for (const view of ["grid", "list"] as const) {
		getNativeControl(parts, view)?.setAttribute(
			"aria-pressed",
			String(state.view === view),
		);
	}
	const filterBinding = getNativeControlBinding(parts, "filter");
	if (filterBinding) syncNativeFilterState(filterBinding, state);
}

function syncNativeFilterState(
	binding: NativeControlBinding,
	state: LibraryState,
) {
	const baseline = binding.baseline.get("aria-pressed") ?? null;
	const active = state.color !== "all";
	if (active) binding.button.setAttribute("aria-pressed", "true");
	else if (baseline === null) binding.button.removeAttribute("aria-pressed");
	else binding.button.setAttribute("aria-pressed", baseline);
	const menuOpen = Boolean(binding.menu && !binding.menu.hidden);
	const stateBaseline = binding.baseline.get("data-state") ?? null;
	if (active || menuOpen) binding.button.setAttribute("data-state", "open");
	else if (stateBaseline === null) binding.button.removeAttribute("data-state");
	else binding.button.setAttribute("data-state", stateBaseline);
}

function deactivateNativeControl(binding: NativeControlBinding) {
	closeNativeFilterMenu(binding);
	restoreNativeControlState(binding);
	binding.active = false;
	binding.state = undefined;
	binding.onStateChange = undefined;
	binding.menu = undefined;
}

function ensureExportControl(parts: NativeLibraryParts, state: LibraryState) {
	let binding = exportControlBindings.get(window);
	if (
		binding &&
		(!binding.wrap.isConnected || !parts.anchor.contains(binding.wrap))
	) {
		binding.wrap.remove();
		binding.menu.remove();
		exportControlBindings.delete(window);
		binding = undefined;
	}
	if (!binding) {
		const wrap = document.createElement("div");
		wrap.dataset.highlightsLibraryExportWrap = "true";
		wrap.setAttribute(UI_ATTRIBUTE, "true");
		wrap.className = "highlights-library-export-wrap";
		const exportButton = parts.newButton
			? (parts.newButton.cloneNode(true) as HTMLButtonElement)
			: document.createElement("button");
		exportButton.removeAttribute("id");
		exportButton.type = "button";
		exportButton.dataset.highlightsLibraryExport = "true";
		const menu = document.createElement("div");
		menu.className =
			"highlights-library-popover highlights-library-export-menu";
		menu.dataset.highlightsLibraryExportMenu = "true";
		menu.setAttribute(UI_ATTRIBUTE, "true");
		menu.hidden = true;
		const current = { wrap, button: exportButton, menu, state };
		binding = current;
		exportControlBindings.set(window, current);
		exportButton.addEventListener("click", () => {
			const opening = menu.hidden;
			closeLibraryPopovers();
			menu.hidden = !opening;
			exportButton.setAttribute("aria-expanded", String(opening));
			if (exportButton.hasAttribute("data-state")) {
				exportButton.dataset.state = opening ? "open" : "closed";
			}
			if (opening) {
				refreshExportMenu(current);
				positionFloatingMenu(exportButton, menu);
			}
		});
		wrap.append(exportButton);
		document.body.append(menu);
		if (parts.newButton?.parentElement) parts.newButton.after(wrap);
		else parts.anchor.prepend(wrap);
	}
	binding.state = state;
	if (parts.newButton) markNativeHidden(parts.newButton);
	setNativeButtonLabel(
		binding.button,
		state.selectedIds.size ? `Export ${state.selectedIds.size}` : "Export",
	);
	if (!binding.menu.hidden) refreshExportMenu(binding);
}

function refreshExportMenu(binding: ExportControlBinding) {
	const records = getExportRecords(binding.state);
	const scope = JSON.stringify([
		binding.state.selectedIds.size > 0,
		records.map((record) => [record.id, record.updatedAt]),
	]);
	if (binding.menu.dataset.exportScope !== scope) {
		binding.menu.dataset.exportScope = scope;
		renderExportMenu(binding.menu, binding.state, () =>
			closeExportMenu(binding.button, binding.menu),
		);
	}
	positionFloatingMenu(binding.button, binding.menu);
}

function closeLibraryPopovers(restoreFocus = false) {
	let closed = false;
	const exporting = exportControlBindings.get(window);
	if (exporting && !exporting.menu.hidden) {
		closeExportMenu(exporting.button, exporting.menu);
		if (restoreFocus) exporting.button.focus();
		closed = true;
	}
	for (const binding of nativeControlBindings.values()) {
		if (
			binding.menu?.isConnected &&
			binding.menu.ownerDocument === document &&
			!binding.menu.hidden
		) {
			closeNativeFilterMenu(binding);
			if (restoreFocus) binding.button.focus();
			closed = true;
		}
	}
	return closed;
}

function dismissLibraryPopoversOutside(event: Event) {
	const target = event.target;
	if (!(target instanceof Node)) return;
	const exporting = exportControlBindings.get(window);
	if (
		exporting &&
		!exporting.menu.hidden &&
		!exporting.wrap.contains(target) &&
		!exporting.menu.contains(target)
	) {
		closeExportMenu(exporting.button, exporting.menu);
	}
}

function setNativeButtonLabel(button: HTMLButtonElement, label: string) {
	button.setAttribute("aria-label", label);
	const changed = replaceTextMatching(
		button,
		(value) => /^(?:New|Export(?: \d+)?)$/.test(value),
		label,
	);
	if (!changed) button.textContent = label;
}

function replaceTextMatching(
	root: Node,
	matches: (value: string) => boolean,
	replacement: string,
): boolean {
	for (const child of root.childNodes) {
		if (child.nodeType === Node.TEXT_NODE) {
			if (!matches(child.textContent?.trim() ?? "")) continue;
			child.textContent = replacement;
			return true;
		}
		if (replaceTextMatching(child, matches, replacement)) return true;
	}
	return false;
}

function closeExportMenu(button: HTMLButtonElement, menu: HTMLElement) {
	menu.hidden = true;
	button.setAttribute("aria-expanded", "false");
	if (button.hasAttribute("data-state")) button.dataset.state = "closed";
}

function positionFloatingMenu(button: HTMLElement, menu: HTMLElement) {
	const rect = button.getBoundingClientRect();
	menu.style.top = `${Math.round(rect.bottom + 8)}px`;
	menu.style.right = `${Math.max(12, Math.round(window.innerWidth - rect.right))}px`;
}

function bindNativeSearch(
	input: HTMLInputElement | undefined,
	state: LibraryState,
	onStateChange: () => void,
) {
	if (!input) return;
	const previousActive = [...nativeSearchBindings.values()].find(
		(candidate) =>
			candidate.active && candidate.input.ownerDocument === input.ownerDocument,
	);
	for (const [candidate, binding] of nativeSearchBindings) {
		if (candidate === input) continue;
		deactivateNativeSearch(binding, false);
		if (!candidate.isConnected) nativeSearchBindings.delete(candidate);
	}
	let binding = nativeSearchBindings.get(input);
	if (!binding) {
		binding = {
			input,
			previousValue: previousActive?.previousValue ?? input.value,
			previousSearchParameter: previousActive
				? previousActive.previousSearchParameter
				: new URL(window.location.href).searchParams.get("search"),
			active: false,
			state,
			onStateChange,
		};
		nativeSearchBindings.set(input, binding);
	}
	if (!binding.active && !previousActive) {
		binding.previousValue = input.value;
		binding.previousSearchParameter = new URL(
			window.location.href,
		).searchParams.get("search");
		state.query = input.value;
	}
	binding.active = true;
	binding.state = state;
	binding.onStateChange = onStateChange;
	input.value = state.query;
	scheduleNativeSearchParameterCleanup();
	if (nativeSearchWindows.has(window)) return;
	nativeSearchWindows.add(window);
	window.addEventListener("input", handleNativeSearchInput, true);
	window.addEventListener("change", handleNativeSearchInput, true);
}

function handleNativeSearchInput(event: Event) {
	const input = event.target;
	if (!(input instanceof HTMLInputElement)) return;
	const binding = nativeSearchBindings.get(input);
	if (!binding?.active || !isHighlightLibraryActive()) return;
	event.stopImmediatePropagation();
	synchronizeNativeSearch(binding);
	scheduleNativeSearchParameterCleanup();
}

function synchronizeNativeSearch(binding: NativeSearchBinding) {
	if (binding.input.value === binding.state.query) {
		scheduleNativeSearchParameterCleanup();
		return;
	}
	binding.state.query = binding.input.value;
	binding.state.selectedId = undefined;
	binding.onStateChange();
	scheduleNativeSearchParameterCleanup();
}

function scheduleNativeSearchParameterCleanup() {
	stripNativeSearchParameter();
	queueMicrotask(stripNativeSearchParameter);
	window.setTimeout(stripNativeSearchParameter, 0);
	window.setTimeout(stripNativeSearchParameter, 100);
}

function stripNativeSearchParameter() {
	if (!isHighlightLibraryActive()) return;
	const url = new URL(window.location.href);
	if (!url.searchParams.has("search")) return;
	url.searchParams.delete("search");
	window.history.replaceState(window.history.state, "", url);
}

function deactivateNativeSearch(
	binding: NativeSearchBinding,
	restoreUrl = true,
) {
	if (!binding.active) return;
	binding.input.value = binding.previousValue;
	binding.active = false;
	if (
		restoreUrl &&
		isLibraryRoute() &&
		binding.input.ownerDocument === document &&
		binding.previousSearchParameter !== null
	) {
		const url = new URL(window.location.href);
		url.searchParams.set("search", binding.previousSearchParameter);
		window.history.replaceState(window.history.state, "", url);
	}
}

function renderLibrary(root: HTMLElement, state: LibraryState) {
	const content = root.querySelector<HTMLElement>(
		".highlights-library-content",
	);
	if (!content) return;
	const selected = state.records.find(
		(record) => record.id === state.selectedId,
	);
	if (selected) {
		root.classList.add("highlights-library-detail-active");
		renderDetail(content, selected);
		return;
	}
	root.classList.remove("highlights-library-detail-active");
	root.classList.toggle(
		"highlights-library-has-selection",
		state.selectedIds.size > 0,
	);
	const records = getFilteredRecords(state);
	const groups = groupByConversation(records);
	const parts = findNativeLibraryParts();
	if (parts) {
		syncNativeControlState(parts, state);
		ensureExportControl(parts, state);
	}
	if (records.length === 0) {
		content.innerHTML = `
			<div class="highlights-library-empty">
				<h2>${state.records.length === 0 ? "No highlights yet" : "No highlights found"}</h2>
				<p>${state.records.length === 0 ? "Highlight a useful passage in any ChatGPT conversation and it will appear here." : "Try a different search or filter."}</p>
			</div>`;
		return;
	}
	content.innerHTML = `
		${renderSelectionSummary(records, groups, state)}
		${state.view === "grid" ? renderGrid(groups, state) : renderList(groups, state)}`;
	applyIndeterminateStates(content, records, groups, state);
	applyNativeLibraryComponents(
		root,
		state.view,
		parts?.components ?? captureNativeLibraryComponents(document.body),
	);
}

function renderSelectionSummary(
	records: HighlightRecord[],
	groups: ConversationGroup[],
	state: LibraryState,
) {
	const selectedVisible = records.filter((record) =>
		state.selectedIds.has(record.id),
	).length;
	return `
		<div class="highlights-library-selection-summary" data-selected="${selectedVisible > 0}">
			<label class="highlights-library-check"><input type="checkbox" data-select-all aria-label="Select all visible highlights" ${selectedVisible === records.length ? "checked" : ""}></label><span>${groups.length} ${groups.length === 1 ? "conversation" : "conversations"} · ${records.length} ${records.length === 1 ? "highlight" : "highlights"}</span>
			${state.selectedIds.size ? `<div class="highlights-library-selection-actions"><span>${state.selectedIds.size} selected</span><button type="button" data-clear-selection>Clear</button></div>` : ""}
		</div>`;
}

function renderList(groups: ConversationGroup[], state: LibraryState) {
	return `<div class="highlights-library-groups" role="list" aria-label="Highlights grouped by conversation">${groups.map((group) => renderConversationGroup(group, state)).join("")}</div>`;
}

function renderConversationGroup(
	group: ConversationGroup,
	state: LibraryState,
) {
	const selected = group.records.filter((record) =>
		state.selectedIds.has(record.id),
	).length;
	return `
		<section class="highlights-library-group" role="listitem" data-conversation-group="${escapeAttribute(group.threadId)}">
			<header data-selected="${selected > 0}">
				<label class="highlights-library-check"><input type="checkbox" data-select-thread="${escapeAttribute(group.threadId)}" aria-label="Select conversation ${escapeAttribute(group.title)}" ${selected === group.records.length ? "checked" : ""}></label>
				<div class="highlights-library-group-title"><span class="highlights-library-icon-slot" aria-hidden="true"></span><div class="min-w-0 flex-1 overflow-hidden"><strong>${escapeHtml(group.title)}</strong>${renderCompactDate(group.latestSavedAt)}</div></div>
				<time class="highlights-library-date" datetime="${new Date(group.latestSavedAt).toISOString()}">${formatLibraryDate(group.latestSavedAt)}</time><span aria-hidden="true"></span>
			</header>
			<div class="highlights-library-records">${group.records.map((record) => renderRecordRow(record, state)).join("")}</div>
		</section>`;
}

function renderRecordRow(record: HighlightRecord, state: LibraryState) {
	return `
		<div data-highlights-row-wrap><div class="highlights-library-record-row" tabindex="0" data-selected="${state.selectedIds.has(record.id)}">
			<label class="highlights-library-check"><input type="checkbox" data-select-highlight="${escapeAttribute(record.id)}" aria-label="Select highlight ${escapeAttribute(record.text)}" ${state.selectedIds.has(record.id) ? "checked" : ""}></label>
			<button type="button" data-highlight-record-id="${escapeAttribute(record.id)}"><span class="highlights-library-icon-slot"><span class="highlights-library-color-dot" style="--highlight-color:${HIGHLIGHT_COLOR_TOKENS[record.color].marker}" aria-label="${record.color} highlight"></span></span><span class="min-w-0 flex-1 overflow-hidden"><span class="highlights-library-record-text">${escapeHtml(record.text)}</span>${renderCompactDate(record.createdAt)}</span></button><time class="highlights-library-date" datetime="${new Date(record.createdAt).toISOString()}">${formatLibraryDate(record.createdAt)}</time><span aria-hidden="true"></span>
		</div></div>`;
}

function renderCompactDate(timestamp: number) {
	return `<span class="highlights-library-compact-date text-token-text-secondary mt-1 truncate text-[12px] leading-[16px] sm:hidden">${formatLibraryDate(timestamp)}</span>`;
}

function renderGrid(groups: ConversationGroup[], state: LibraryState) {
	return `<div class="highlights-library-grid" role="list" aria-label="Highlight conversations">${groups
		.map((group) => {
			const selected = group.records.filter((record) =>
				state.selectedIds.has(record.id),
			).length;
			return `
				<section class="highlights-library-card" role="listitem" data-selected="${selected > 0}">
					<div class="highlights-library-card-tile">
					<div class="highlights-library-card-records">${group.records
						.slice(0, 3)
						.map(
							(record) =>
								`<button type="button" data-highlight-record-id="${escapeAttribute(record.id)}"><span class="highlights-library-color-dot" style="--highlight-color:${HIGHLIGHT_COLOR_TOKENS[record.color].marker}"></span><span>${escapeHtml(record.text)}</span></button>`,
						)
						.join("")}</div></div>
					<div class="highlights-library-card-selection-layer"><label class="highlights-library-check"><input type="checkbox" data-select-thread="${escapeAttribute(group.threadId)}" aria-label="Select conversation ${escapeAttribute(group.title)}" ${selected === group.records.length ? "checked" : ""}></label></div>
					<header><strong>${escapeHtml(group.title)}</strong><time datetime="${new Date(group.latestSavedAt).toISOString()}">${formatLibraryDate(group.latestSavedAt)}</time></header>
				</section>`;
		})
		.join("")}</div>`;
}

function applyIndeterminateStates(
	content: HTMLElement,
	records: HighlightRecord[],
	groups: ConversationGroup[],
	state: LibraryState,
) {
	const selectedVisible = records.filter((record) =>
		state.selectedIds.has(record.id),
	).length;
	const all = content.querySelector<HTMLInputElement>("[data-select-all]");
	if (all)
		all.indeterminate = selectedVisible > 0 && selectedVisible < records.length;
	for (const group of groups) {
		const selected = group.records.filter((record) =>
			state.selectedIds.has(record.id),
		).length;
		const input = Array.from(
			content.querySelectorAll<HTMLInputElement>("[data-select-thread]"),
		).find((candidate) => candidate.dataset.selectThread === group.threadId);
		if (input)
			input.indeterminate = selected > 0 && selected < group.records.length;
	}
}

function renderDetail(content: HTMLElement, record: HighlightRecord) {
	content.innerHTML = `
		<div class="highlights-library-detail">
			<div class="highlights-library-detail-bar"><button type="button" class="highlights-library-back" data-highlights-library-back aria-label="Back to highlights"><span aria-hidden="true">←</span><span>Back</span></button><div><button type="button" class="highlights-library-secondary" data-export-one>Export</button><a class="highlights-library-primary" href="${escapeAttribute(highlightSourceUrl(record))}">Open conversation</a></div></div>
			<article>
				<p class="highlights-library-detail-text"><mark style="--highlight-fill:${HIGHLIGHT_COLOR_TOKENS[record.color].fill}">${escapeHtml(record.text)}</mark></p>
				<div class="highlights-library-detail-meta"><strong>${escapeHtml(getConversationTitle(record))}</strong><span>Saved ${escapeHtml(formatExportDate(record.createdAt))}</span></div>
				${record.prefix || record.suffix ? `<section class="highlights-library-context"><h2>In context</h2><p>${escapeHtml(record.prefix)}<mark style="--highlight-fill:${HIGHLIGHT_COLOR_TOKENS[record.color].fill}">${escapeHtml(record.text)}</mark>${escapeHtml(record.suffix)}</p></section>` : ""}
			</article>
		</div>`;
	content
		.querySelector<HTMLButtonElement>("[data-export-one]")
		?.addEventListener("click", () => downloadMarkdown([record]));
}

function renderExportMenu(
	menu: HTMLElement,
	state: LibraryState,
	onClose: () => void,
) {
	const records = getExportRecords(state);
	const isSelection = state.selectedIds.size > 0;
	menu.innerHTML = `
		<p>${isSelection ? "Selected" : "Current view"} · ${records.length} ${records.length === 1 ? "highlight" : "highlights"}</p>
		<button type="button" data-export-format="markdown"><strong>Markdown</strong><span>Best for notes and writing</span></button>
		<button type="button" data-export-format="text"><strong>Plain text</strong><span>A clean, portable copy</span></button>
		<button type="button" data-export-format="json"><strong>JSON backup</strong><span>For restoring your data</span></button>`;
	for (const button of menu.querySelectorAll<HTMLButtonElement>(
		"[data-export-format]",
	)) {
		button.disabled = records.length === 0;
		button.addEventListener("click", () => {
			const records = getExportRecords(state);
			switch (button.dataset.exportFormat) {
				case "markdown":
					downloadMarkdown(records);
					break;
				case "text":
					downloadText(records);
					break;
				case "json":
					downloadJson(records);
					break;
			}
			onClose();
		});
	}
}

function renderFilterMenu(
	menu: HTMLElement,
	state: LibraryState,
	onChange: () => void,
) {
	const choices: { value: ColorFilter; label: string }[] = [
		{ value: "all", label: "All colors" },
		...HIGHLIGHT_COLORS.map((color) => ({
			value: color,
			label: `${color.charAt(0).toUpperCase()}${color.slice(1)}`,
		})),
	];
	menu.innerHTML = `<p>Color</p>${choices
		.map(
			(choice) =>
				`<button type="button" data-color="${choice.value}" aria-checked="${choice.value === state.color}">${choice.value === "all" ? '<i class="highlights-all-colors"></i>' : `<i style="--highlight-color:${HIGHLIGHT_COLOR_TOKENS[choice.value as HighlightColor].marker}"></i>`}<span>${choice.label}</span></button>`,
		)
		.join("")}`;
	for (const button of menu.querySelectorAll<HTMLButtonElement>(
		"[data-color]",
	)) {
		button.addEventListener("click", () => {
			state.color = button.dataset.color as ColorFilter;
			state.selectedId = undefined;
			menu.hidden = true;
			onChange();
		});
	}
}

function getFilteredRecords(state: LibraryState) {
	const query = state.query.trim().toLocaleLowerCase();
	return state.records.filter((record) => {
		if (state.color !== "all" && record.color !== state.color) return false;
		if (!query) return true;
		return `${record.text}\n${getConversationTitle(record)}`
			.toLocaleLowerCase()
			.includes(query);
	});
}

function getExportRecords(state: LibraryState) {
	if (state.selectedIds.size === 0) return getFilteredRecords(state);
	return state.records.filter((record) => state.selectedIds.has(record.id));
}

function groupByConversation(records: readonly HighlightRecord[]) {
	const groups = new Map<string, ConversationGroup>();
	for (const record of records) {
		let group = groups.get(record.threadId);
		if (!group) {
			group = {
				threadId: record.threadId,
				title: getConversationTitle(record),
				records: [],
				latestSavedAt: record.createdAt,
			};
			groups.set(record.threadId, group);
		}
		group.records.push(record);
		group.latestSavedAt = Math.max(group.latestSavedAt, record.createdAt);
	}
	return [...groups.values()].sort(
		(left, right) => right.latestSavedAt - left.latestSavedAt,
	);
}

function hydrateConversationTitles(records: HighlightRecord[]) {
	const titles = new Map<string, string>();
	for (const link of document.querySelectorAll<HTMLAnchorElement>(
		"a[href*='/c/']",
	)) {
		try {
			const url = new URL(link.href);
			const title = link.textContent?.replace(/\s+/g, " ").trim();
			if (title) titles.set(url.pathname, title);
		} catch {
			// Ignore transient or non-URL sidebar items.
		}
	}
	const updatedThreads = new Set<string>();
	return records.map((record) => {
		if (record.conversationTitle) return record;
		let title: string | undefined;
		try {
			title = titles.get(new URL(record.url).pathname);
		} catch {
			return record;
		}
		if (!title) return record;
		if (!updatedThreads.has(record.threadId)) {
			updatedThreads.add(record.threadId);
			void sendRuntimeRequest<HighlightRecord[]>({
				type: "UPDATE_THREAD_TITLE",
				url: record.url,
				title,
			});
		}
		return { ...record, conversationTitle: title };
	});
}

function findContainingSurface(start: HTMLElement) {
	let current: HTMLElement | null = start.parentElement;
	while (current && current !== document.body) {
		if (findNativeLibrarySearch(current) && findNativeTabGroup(current)) {
			// In the refreshed Library, title, search and tabs share a sticky shell.
			// Its scroll surface also contains the real body; the shell itself does not.
			return (
				current.closest<HTMLElement>("[class~='group/page-table-scroll']") ??
				current
			);
		}
		current = current.parentElement;
	}
	return null;
}

function findHeading() {
	return Array.from(document.querySelectorAll<HTMLElement>("h1, h2"))
		.filter(
			(element) =>
				/^(Library|资料库|資源庫|资源库)$/.test(
					element.textContent?.trim() ?? "",
				) &&
				!element.closest(`[${UI_ATTRIBUTE}], [hidden], [aria-hidden='true']`),
		)
		.sort(compareVisibleFirst)[0];
}

/** Prefer native tab semantics, with a scoped fallback for ChatGPT's plain buttons. */
function findNativeTabGroup(anchor: HTMLElement) {
	const controls = (element: HTMLElement) =>
		Array.from(
			element.querySelectorAll<HTMLElement>("button, [role='tab']"),
		).filter(
			(button) =>
				!button.closest(`[${UI_ATTRIBUTE}], [hidden], [aria-hidden='true']`),
		);
	const knownLabel =
		/^(All|Images|Documents|Files|Suggested|Folders|全部|所有|图片|圖像|文档|文件|推荐|建議|文件夹|資料夾)$/;
	const candidates = new Set<HTMLElement>(
		anchor.querySelectorAll<HTMLElement>("[role='tablist']"),
	);
	for (const button of controls(anchor)) {
		if (
			knownLabel.test(button.textContent?.trim() ?? "") &&
			button.parentElement
		) {
			candidates.add(button.parentElement);
		}
	}
	return Array.from(candidates)
		.map((tabs) => ({ tabs, nativeTabs: controls(tabs) }))
		.filter(
			({ tabs, nativeTabs }) =>
				nativeTabs.length >= 2 &&
				(tabs.getAttribute("role") === "tablist" ||
					nativeTabs.every((button) =>
						knownLabel.test(button.textContent?.trim() ?? ""),
					)),
		)
		.sort((left, right) => compareVisibleFirst(left.tabs, right.tabs))[0];
}

function compareVisibleFirst(left: HTMLElement, right: HTMLElement) {
	return Number(isVisiblyRendered(right)) - Number(isVisiblyRendered(left));
}

function isVisiblyRendered(element: HTMLElement) {
	const rect = element.getBoundingClientRect();
	return rect.width > 0 && rect.height > 0;
}

function syncNativeTabs(
	active: boolean,
	nativeTabs = findNativeLibraryParts()?.nativeTabs ?? [],
) {
	const originalClassName = (button: HTMLElement) =>
		nativeTabSnapshots.get(button)?.className ?? button.className;
	const activeReference =
		nativeTabs.find((button) => {
			const snapshot = nativeTabSnapshots.get(button);
			return (
				(snapshot
					? snapshot.ariaSelected
					: button.getAttribute("aria-selected")) === "true" ||
				(snapshot ? snapshot.dataState : button.getAttribute("data-state")) ===
					"active"
			);
		}) ??
		nativeTabs.find((button) => {
			// Current Library tabs expose selection through their native background only.
			const className = originalClassName(button);
			return (
				className
					.split(/\s+/)
					.map((token) => token.replace(/^!|!$/g, ""))
					.some(
						(token) =>
							/^bg-/.test(token) &&
							!/^bg-(transparent|inherit|current)$/.test(token),
					) &&
				nativeTabs.some((other) => originalClassName(other) !== className)
			);
		});
	const inactiveReference = nativeTabs.find(
		(button) => button !== activeReference,
	);
	const inactiveClassName = inactiveReference
		? originalClassName(inactiveReference)
		: undefined;
	const activeClassName = activeReference
		? originalClassName(activeReference)
		: undefined;
	for (const button of nativeTabs) {
		if (active) {
			if (!nativeTabSnapshots.has(button)) {
				nativeTabSnapshots.set(button, {
					className: button.className,
					ariaSelected: button.getAttribute("aria-selected"),
					dataState: button.getAttribute("data-state"),
				});
			}
			if (inactiveClassName) button.className = inactiveClassName;
			button.setAttribute("aria-selected", "false");
			if (button.hasAttribute("data-state")) {
				button.dataset.state = "inactive";
			}
		} else {
			restoreNativeTab(button);
		}
	}
	for (const [button] of nativeTabSnapshots) {
		if (!active || !nativeTabs.includes(button)) restoreNativeTab(button);
	}
	const highlights = document.querySelector<HTMLButtonElement>(
		`[${TAB_ATTRIBUTE}]`,
	);
	highlights?.setAttribute("aria-selected", String(active));
	if (highlights) highlights.dataset.highlightsLibraryActive = String(active);
	const highlightClassName = active ? activeClassName : inactiveClassName;
	if (highlights && highlightClassName) {
		highlights.className = highlightClassName;
		highlights.removeAttribute("style");
	}
	if (highlights?.hasAttribute("data-state")) {
		highlights.dataset.state = active ? "active" : "inactive";
	}
}

function restoreNativeTab(button: HTMLElement) {
	const snapshot = nativeTabSnapshots.get(button);
	if (!snapshot) return;
	button.className = snapshot.className;
	if (snapshot.ariaSelected === null) button.removeAttribute("aria-selected");
	else button.setAttribute("aria-selected", snapshot.ariaSelected);
	if (snapshot.dataState === null) button.removeAttribute("data-state");
	else button.setAttribute("data-state", snapshot.dataState);
	nativeTabSnapshots.delete(button);
}

function markNativeHidden(element: HTMLElement) {
	if (element.hasAttribute(NATIVE_HIDDEN_ATTRIBUTE)) return;
	element.setAttribute(
		NATIVE_HIDDEN_ATTRIBUTE,
		element.hidden ? "true" : "false",
	);
	element.hidden = true;
}

function restoreNativeSurface() {
	for (const element of document.querySelectorAll<HTMLElement>(
		`[${NATIVE_HIDDEN_ATTRIBUTE}]`,
	)) {
		element.hidden = element.getAttribute(NATIVE_HIDDEN_ATTRIBUTE) === "true";
		element.removeAttribute(NATIVE_HIDDEN_ATTRIBUTE);
	}
	for (const input of document.querySelectorAll<HTMLInputElement>(
		"[data-highlights-library-previous-value]",
	)) {
		input.value = input.dataset.highlightsLibraryPreviousValue ?? "";
		delete input.dataset.highlightsLibraryPreviousValue;
	}
}

function teardownActiveLibrary() {
	closeLibraryPopovers();
	const exporting = exportControlBindings.get(window);
	if (exporting) {
		exporting.wrap.remove();
		exporting.menu.remove();
		exportControlBindings.delete(window);
	}
	document.getElementById(ROOT_ID)?.remove();
	document.querySelector(`[${CONTENT_HOST_ATTRIBUTE}]`)?.remove();
	for (const binding of nativeControlBindings.values()) {
		if (binding.active) deactivateNativeControl(binding);
	}
	for (const binding of nativeSearchBindings.values()) {
		deactivateNativeSearch(binding);
	}
	document.querySelector("[data-highlights-library-actions]")?.remove();
	document.querySelector("[data-highlights-library-export-wrap]")?.remove();
	document.querySelector("[data-highlights-library-export-menu]")?.remove();
	document.querySelector("[data-highlights-library-filter-menu]")?.remove();
	restoreNativeSurface();
	syncNativeTabs(false);
}

function stripHighlightViewParameter() {
	if (!isLibraryRoute()) return;
	const url = new URL(window.location.href);
	if (!url.searchParams.has(LIBRARY_PARAMETER)) return;
	url.searchParams.delete(LIBRARY_PARAMETER);
	window.history.replaceState(window.history.state, "", url);
}

function isLibraryRoute() {
	return (
		window.location.hostname === "chatgpt.com" &&
		window.location.pathname === "/library"
	);
}

function isHighlightLibraryActive() {
	return (
		isLibraryRoute() &&
		new URL(window.location.href).searchParams.get(LIBRARY_PARAMETER) ===
			LIBRARY_VALUE
	);
}

function isLibraryUiMutation(mutation: MutationRecord) {
	const target =
		mutation.target instanceof Element
			? mutation.target
			: mutation.target.parentElement;
	return Boolean(target?.closest(`[${UI_ATTRIBUTE}='true']`));
}

function highlightSourceUrl(record: HighlightRecord) {
	const url = new URL(record.url);
	url.searchParams.set("highlight", record.id);
	return url.toString();
}

function downloadMarkdown(records: HighlightRecord[]) {
	download(
		`chatgpt-highlights-${today()}.md`,
		highlightsToMarkdown(records),
		"text/markdown;charset=utf-8",
	);
}

function downloadText(records: HighlightRecord[]) {
	download(
		`chatgpt-highlights-${today()}.txt`,
		highlightsToPlainText(records),
		"text/plain;charset=utf-8",
	);
}

function downloadJson(records: HighlightRecord[]) {
	download(
		`chatgpt-highlights-backup-${today()}.json`,
		`${JSON.stringify(
			{
				product: "Highlights",
				formatVersion: 1,
				exportedAt: new Date().toISOString(),
				highlights: records,
			},
			null,
			2,
		)}\n`,
		"application/json",
	);
}

function download(filename: string, contents: string, type: string) {
	const url = URL.createObjectURL(new Blob([contents], { type }));
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function today() {
	return new Date().toISOString().slice(0, 10);
}

function formatLibraryDate(timestamp: number) {
	const date = new Date(timestamp);
	const now = new Date();
	if (date.toDateString() === now.toDateString()) {
		return new Intl.DateTimeFormat(undefined, {
			hour: "numeric",
			minute: "2-digit",
		}).format(date);
	}
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		...(date.getFullYear() === now.getFullYear()
			? {}
			: { year: "numeric" as const }),
	}).format(date);
}

function showLibraryError(root: HTMLElement) {
	const content = root.querySelector<HTMLElement>(
		".highlights-library-content",
	);
	if (!content) return;
	content.innerHTML = `<div class="highlights-library-empty"><h2>Highlights could not be loaded</h2><p>Reload ChatGPT to reconnect to the extension.</p></div>`;
}

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function escapeAttribute(value: string) {
	return escapeHtml(value);
}

function ensureStyles() {
	if (document.getElementById("highlights-library-styles")) return;
	const style = document.createElement("style");
	style.id = "highlights-library-styles";
	style.setAttribute(UI_ATTRIBUTE, "true");
	style.textContent = `
		[${NATIVE_HIDDEN_ATTRIBUTE}] { display: none !important; }
		#${ROOT_ID} { width: 100%; box-sizing: border-box; padding: 0; color: var(--text-primary, #0d0d0d); font-family: inherit; }
		.highlights-library-popover button { font: inherit; }
		.highlights-library-export-wrap { position: relative; }
		.highlights-library-primary, .highlights-library-secondary { display: inline-flex; height: 36px; box-sizing: border-box; align-items: center; justify-content: center; border-radius: 999px; padding: 0 16px; border: 0; text-decoration: none; white-space: nowrap; cursor: pointer; }
		.highlights-library-primary { color: var(--text-inverted, #fff); background: var(--text-primary, #0d0d0d); }
		.highlights-library-primary:hover { opacity: .86; }
		.highlights-library-secondary { color: inherit; background: transparent; border: 1px solid var(--border-default, rgba(0,0,0,.14)); }
		.highlights-library-popover { position: absolute; z-index: 40; top: calc(100% + 8px); right: 0; min-width: 220px; box-sizing: border-box; border: 1px solid var(--border-light, rgba(0,0,0,.05)); border-radius: 16px; padding: 8px; color: var(--text-primary, #0d0d0d); background: var(--bg-primary, #fff); box-shadow: 0 8px 28px rgba(0,0,0,.12), 0 1px 3px rgba(0,0,0,.08); }
		.highlights-library-export-menu, .highlights-library-filter-menu { position: fixed; z-index: 10000; }
		.highlights-library-popover[hidden] { display: none; }
		.highlights-library-popover > p { margin: 4px 10px 8px; color: var(--text-tertiary, #8f8f8f); font-size: 12px; line-height: 18px; font-weight: 400; }
		.highlights-library-popover > button { width: 100%; min-height: 44px; display: grid; grid-template-columns: 1fr; align-items: center; gap: 2px; border: 0; border-radius: 10px; padding: 7px 10px; color: inherit; background: transparent; text-align: left; cursor: pointer; }
		.highlights-library-popover > button:hover { background: var(--interactive-bg-tertiary-hover, #f9f9f9); }
		.highlights-library-popover > button:disabled { opacity: .45; cursor: default; }
		.highlights-library-popover > button strong { font-size: 14px; line-height: 20px; font-weight: 400; }
		.highlights-library-popover > button span { color: var(--text-tertiary, #8f8f8f); font-size: 12px; line-height: 18px; }
		.highlights-library-filter-menu { min-width: 220px; }
		.highlights-library-filter-menu > button { grid-template-columns: 18px 1fr; min-height: 40px; padding-block: 6px; }
		.highlights-library-filter-menu > button > i { width: 10px; height: 10px; border-radius: 50%; background: var(--highlight-color); }
		.highlights-library-filter-menu > button > span { color: inherit; font-size: 14px; line-height: 20px; }
		.highlights-all-colors { background: conic-gradient(${HIGHLIGHT_COLOR_TOKENS.yellow.marker} 0 25%, ${HIGHLIGHT_COLOR_TOKENS.green.marker} 0 50%, ${HIGHLIGHT_COLOR_TOKENS.blue.marker} 0 75%, ${HIGHLIGHT_COLOR_TOKENS.pink.marker} 0); }
.highlights-library-selection-summary > span { min-width: 0; }
		.highlights-library-selection-actions { grid-column: 2 / -1; display: flex; align-items: center; justify-content: flex-end; gap: 12px; white-space: nowrap; }
		.highlights-library-selection-actions button { border: 0; padding: 4px 8px; border-radius: 6px; color: inherit; background: transparent; cursor: pointer; }
		.highlights-library-selection-actions button:hover { background: var(--interactive-bg-secondary-hover); }
		.highlights-library-native-check:focus-within { opacity: 1; pointer-events: auto; }
		.highlights-library-native-check[data-highlights-check-kind='grid']:focus-within input { opacity: 1; }
		.highlights-library-native-check[data-highlights-check-kind='grid'] input:indeterminate + svg { opacity: 0; }
		.highlights-library-native-check .highlights-library-grid-mixed { background: #000; }
		.highlights-library-native-check[data-highlights-check-kind='grid'] input:indeterminate ~ .highlights-library-grid-mixed { display: block; }
		.highlights-library-check { cursor: pointer; }
		.highlights-library-groups, .highlights-library-records { padding: 0; }
		.highlights-library-group-title { display: flex; min-width: 0; align-items: center; gap: 12px; position: relative; z-index: 10; }
		.highlights-library-group-title strong { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; line-height: 20px; font-weight: 500; }
		.highlights-library-group > header { border-bottom: 1px solid var(--border-light, rgba(0,0,0,.05)); }
		.highlights-library-record-row > button { position: relative; z-index: 10; display: flex; min-width: 0; align-items: center; gap: 12px; border: 0; padding: 0; color: var(--text-primary); background: transparent; text-align: start; font-size: 14px; line-height: 20px; cursor: pointer; }
		.highlights-library-icon-slot { display: flex; width: 32px; height: 32px; flex: 0 0 32px; align-items: center; justify-content: center; }
		.highlights-library-color-dot { width: 8px; height: 8px; display: block; border-radius: 50%; background: var(--highlight-color); }
		.highlights-library-record-text { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.highlights-library-compact-date { display: block; }
		.highlights-library-date { position: relative; z-index: 10; color: var(--text-secondary, #5d5d5d); overflow: hidden; text-overflow: ellipsis; font-size: 14px; line-height: 20px; font-weight: 400; white-space: nowrap; text-align: start; }
		.highlights-library-card { display: flex; flex-direction: column; gap: 8px; }
		.highlights-library-card-tile { min-width: 0; }
		.highlights-library-card-selection-layer { position: absolute; inset-inline: 0; top: 0; aspect-ratio: 1; pointer-events: none; z-index: 10; }
		.highlights-library-card-selection-layer .highlights-library-native-check { pointer-events: auto; }
		.highlights-library-card header { min-width: 0; padding-inline-start: 4px; }
		.highlights-library-card header strong { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; font-size: 14px; line-height: 20px; font-weight: 500; }
		.highlights-library-card time { display: block; color: var(--text-secondary, #5d5d5d); font-size: 13px; line-height: 18px; letter-spacing: -.08px; }
		.highlights-library-card-records { position: absolute; inset: 16px 16px 52px; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
		.highlights-library-card-records button { display: flex; align-items: baseline; gap: 8px; min-width: 0; border: 0; padding: 0; background: transparent; color: var(--text-primary); text-align: start; font-size: 14px; line-height: 20px; cursor: pointer; }
		.highlights-library-card-records button .highlights-library-color-dot { flex: 0 0 8px; }
		.highlights-library-card-records button span:last-child { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; min-width: 0; overflow: hidden; overflow-wrap: anywhere; }
		.highlights-library-record-row > button:focus-visible, .highlights-library-card-records button:focus-visible, .highlights-library-selection-actions button:focus-visible { outline: 2px solid var(--text-primary); outline-offset: 2px; border-radius: 4px; }

		/* Used only when the host no longer provides a corresponding component. */
		:where([data-highlights-native-rows='false']) .highlights-library-selection-summary { position: relative; height: 42px; display: grid; grid-template-columns: minmax(0,1fr) 160px 64px; align-items: center; gap: 16px; padding: 12px 8px 12px 0; color: var(--text-secondary, #5d5d5d); border-bottom: 1px solid var(--border-light, #0000000d); font-size: 12px; line-height: 20px; }
		:where([data-highlights-native-rows='false']) :is(.highlights-library-record-row, .highlights-library-group > header) { position: relative; z-index: 0; min-height: 60px; display: grid; grid-template-columns: minmax(0,1fr) 160px 64px; align-items: center; gap: 16px; padding: 10px 8px 10px 0; }
		:where([data-highlights-native-rows='false']) .highlights-library-record-row { border-bottom: 1px solid var(--border-light, #0000000d); }
		:where([data-highlights-native-rows='false']) :is(.highlights-library-record-row, .highlights-library-group > header)::before { content: ''; position: absolute; inset: -1px var(--page-table-row-inset, -12px); pointer-events: none; border-radius: var(--radius-2xl, 16px); background: var(--interactive-bg-secondary-hover, #0000000d); opacity: 0; transition: opacity .15s cubic-bezier(.4,0,.2,1); }
		:where([data-highlights-native-rows='false']) :is(.highlights-library-record-row, .highlights-library-group > header):hover::before, :where([data-highlights-native-rows='false']) [data-selected='true']::before { opacity: 1; }
		:where([data-highlights-native-rows='false']) [data-selected='true']::before { background: var(--interactive-bg-secondary-selected, #0000000d); }
		:where([data-highlights-native-grid='false']) .highlights-library-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
		:where([data-highlights-native-grid='false']) .highlights-library-card-tile { position: relative; width: 100%; aspect-ratio: 1; border: 1px solid var(--border-light, #0000000d); border-radius: 16px; background: var(--bg-primary, #fff); box-shadow: var(--shadow-elevation-01, 0 1px 3px #0000000d); }
		:where([data-highlights-native-grid='false']) .highlights-library-card[data-selected='true'] .highlights-library-card-tile { border-color: var(--text-primary, #000); outline: 2px solid var(--text-primary, #000); }
		@media (min-width: 640px) { .highlights-library-compact-date { display: none; } :where([data-highlights-native-grid='false']) .highlights-library-grid { gap: 16px; } }
		@media (min-width: 768px) { :where([data-highlights-native-grid='false']) .highlights-library-grid { grid-template-columns: repeat(3,minmax(0,1fr)); } }
		@media (min-width: 1024px) { :where([data-highlights-native-grid='false']) .highlights-library-grid { grid-template-columns: repeat(4,minmax(0,1fr)); } }
		@media (min-width: 1280px) { :where([data-highlights-native-grid='false']) .highlights-library-grid { grid-template-columns: repeat(5,minmax(0,1fr)); } }
		@media (min-width: 1536px) { :where([data-highlights-native-grid='false']) .highlights-library-grid { grid-template-columns: repeat(6,minmax(0,1fr)); } }
		@media (max-width: 1023px) { .highlights-library-selection-summary > .highlights-library-check, .highlights-library-groups .highlights-library-check { display: none; } }
		@media (max-width: 639px) { .highlights-library-date { display: none; } :where([data-highlights-native-rows='false']) :is(.highlights-library-record-row, .highlights-library-group > header, .highlights-library-selection-summary) { grid-template-columns: minmax(0,1fr) 36px; } }
		@media (prefers-reduced-motion: reduce) { .highlights-library-native-check, .highlights-library-native-check input, .highlights-library-native-check svg, .highlights-library-card-tile, .highlights-library-record-row::before { transition-duration: 0s; } }
		.highlights-library-empty { min-height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-secondary, #5d5d5d); text-align: center; padding: 40px; }
		.highlights-library-empty h2 { margin: 0; color: var(--text-primary, #0d0d0d); font-size: 15px; font-weight: 500; }
		.highlights-library-empty p { max-width: 330px; margin: 6px 0 0; font-size: 13px; line-height: 1.5; }
		.highlights-library-detail-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 0 0 40px; }
		.highlights-library-detail-bar > div { display: flex; gap: 8px; }
		.highlights-library-back { height: 36px; display: inline-flex; align-items: center; gap: 7px; margin-left: -10px; border: 0; border-radius: 8px; padding: 0 10px; color: var(--text-primary, #0d0d0d); background: transparent; font-size: 14px; line-height: 20px; font-weight: 400; cursor: pointer; transition: background-color .15s ease; }
		.highlights-library-back:hover { background: var(--interactive-bg-tertiary-hover, #f9f9f9); }
		.highlights-library-back:focus-visible { outline: 2px solid var(--text-primary, #0d0d0d); outline-offset: 2px; }
		.highlights-library-back > span[aria-hidden='true'] { font-size: 17px; line-height: 1; transform: translateY(-.5px); }
		.highlights-library-detail article { max-width: 640px; margin: 0 auto; padding: 24px 0 80px; }
		.highlights-library-detail-text { margin: 0 0 28px; white-space: pre-wrap; font-size: 22px; line-height: 1.55; letter-spacing: -.25px; }
		.highlights-library-detail-text mark, .highlights-library-context mark { color: inherit; background: var(--highlight-fill); border-radius: 3px; box-decoration-break: clone; -webkit-box-decoration-break: clone; padding: .04em .12em; }
		.highlights-library-detail-meta { display: flex; flex-direction: column; gap: 3px; color: var(--text-tertiary, #8f8f8f); font-size: 13px; }
		.highlights-library-detail-meta strong { color: var(--text-secondary, #5d5d5d); font-weight: 500; }
		.highlights-library-context { margin-top: 44px; border-top: 1px solid var(--border-light, rgba(0,0,0,.08)); padding-top: 28px; }
		.highlights-library-context h2 { margin: 0 0 12px; font-size: 13px; font-weight: 500; }
		.highlights-library-context p { margin: 0; color: var(--text-secondary, #5d5d5d); font-size: 14px; line-height: 1.7; }
	`;
	(document.head ?? document.documentElement).appendChild(style);
}
