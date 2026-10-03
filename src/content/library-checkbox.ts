import type { NativeLibraryComponents } from "./library-native";

export const LIBRARY_CHECKBOX_SELECTOR =
	"input[type='checkbox'], button[data-highlights-native-checkbox]";
export type LibraryCheckbox = HTMLElement & {
	checked: boolean;
	indeterminate: boolean;
	disabled: boolean;
};
type State = {
	checked: boolean;
	mixed: boolean;
	components: NativeLibraryComponents;
	grid: boolean;
	signature?: string;
};
const states = new WeakMap<HTMLElement, State>();

const COMMON =
	"peer shrink-0 outline-none transition-[background-color,border-color,box-shadow] border border-strong shadow-sm data-[state=checked]:text-default data-[state=indeterminate]:text-default focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 hover:bg-surface-tertiary cursor-interaction";
const PRESENTATION = new Set([
	"class",
	"style",
	"data-color",
	"data-variant",
	"data-size",
	"data-icon-size",
	"data-pill",
	"data-uniform",
]);

export function isLibraryCheckbox(node: unknown): node is LibraryCheckbox {
	return node instanceof HTMLElement && node.matches(LIBRARY_CHECKBOX_SELECTOR);
}

export function createSpaceCheckbox(
	doc: Document,
	components: NativeLibraryComponents,
	grid: boolean,
) {
	const shell = doc.createElement("span");
	shell.className =
		components.spaceCheckboxShellClass ?? "relative flex items-center";
	const button = doc.createElement("button") as HTMLButtonElement &
		LibraryCheckbox;
	button.type = "button";
	button.setAttribute("role", "checkbox");
	button.dataset.highlightsNativeCheckbox = "true";
	const state: State = { checked: false, mixed: false, components, grid };
	states.set(button, state);
	Object.defineProperties(button, {
		checked: {
			configurable: true,
			get: () => state.checked,
			set: (value: boolean) => {
				state.checked = Boolean(value);
				paint(button, state);
			},
		},
		indeterminate: {
			configurable: true,
			get: () => state.mixed,
			set: (value: boolean) => {
				state.mixed = Boolean(value);
				paint(button, state);
			},
		},
	});
	syncSpaceCheckbox(button, components, grid);
	shell.append(button);
	return shell;
}

export function syncSpaceCheckbox(
	button: LibraryCheckbox,
	components: NativeLibraryComponents,
	grid: boolean,
) {
	const state = states.get(button);
	if (!state) return;
	state.components = components;
	state.grid = grid;
	const template = grid
		? components.spaceGridCheckboxButton
		: components.spaceListCheckboxButton;
	const className =
		template?.className ??
		(grid
			? components.spaceGridCheckboxClass
			: components.spaceCheckboxClass) ??
		`${COMMON} ${grid ? "size-5 rounded-full bg-surface" : "icon-2xs rounded-xs data-[state=checked]:bg-primary-soft data-[state=indeterminate]:bg-primary-soft"}`;
	const attributes = template
		? Array.from(template.attributes)
				.filter((attribute) => PRESENTATION.has(attribute.name))
				.map((attribute) => [attribute.name, attribute.value])
		: [];
	const signature = JSON.stringify([
		className,
		attributes,
		components.checkIcon?.outerHTML,
		components.spaceMixedIcon?.outerHTML,
	]);
	if (signature === state.signature) return;
	state.signature = signature;
	for (const name of PRESENTATION)
		if (name !== "class") button.removeAttribute(name);
	for (const [name, value] of attributes)
		button.setAttribute(name as string, value as string);
	button.className = className;
	button.toggleAttribute("data-highlights-fallback-checkbox", !template);
	Object.assign(button.style, {
		width: grid ? "20px" : "16px",
		height: grid ? "20px" : "16px",
		borderRadius: grid ? "9999px" : "2px",
		padding: "0",
		margin: "0",
	});
	paint(button, state);
}

function paint(button: LibraryCheckbox, state: State) {
	const value = state.mixed
		? "indeterminate"
		: state.checked
			? "checked"
			: "unchecked";
	button.dataset.state = value;
	button.setAttribute(
		"aria-checked",
		state.mixed ? "mixed" : String(state.checked),
	);
	button.replaceChildren();
	if (!state.checked && !state.mixed) return;
	const doc = button.ownerDocument;
	const indicator = doc.createElement("span");
	indicator.dataset.state = value;
	indicator.className =
		"flex h-full w-full items-center justify-center text-current";
	indicator.style.pointerEvents = "none";
	const source = state.mixed
		? state.components.spaceMixedIcon
		: state.components.checkIcon;
	const svg =
		(source?.cloneNode(true) as SVGElement | undefined) ??
		doc.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("aria-hidden", "true");
	for (const element of [svg, ...svg.querySelectorAll("*")]) {
		element.removeAttribute("id");
		for (const attribute of Array.from(element.attributes))
			if (attribute.name.startsWith("on"))
				element.removeAttribute(attribute.name);
	}
	if (!source) {
		const size = state.mixed ? "20" : "17";
		svg.setAttribute("width", size);
		svg.setAttribute("height", size);
		svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
		const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("fill", "currentColor");
		path.setAttribute(
			"d",
			state.mixed
				? "M3.5 10.0002C3.5 9.63297 3.79777 9.33521 4.16504 9.33521H15.835C16.2022 9.33521 16.5 9.63297 16.5 10.0002C16.5 10.3675 16.2022 10.6652 15.835 10.6652H4.16504C3.79777 10.6652 3.5 10.3675 3.5 10.0002Z"
				: "M12.8961 3.64101C13.1297 3.41418 13.4984 3.37523 13.7779 3.56581C14.0571 3.75635 14.1554 4.11331 14.0299 4.41347L13.9615 4.53847L7.71151 13.7045C7.59411 13.8767 7.4063 13.9877 7.19881 14.0072C6.99136 14.0267 6.78564 13.9533 6.63826 13.806L2.88826 10.056L2.79842 9.9457C2.6192 9.67407 2.64927 9.30496 2.88826 9.06581C3.12738 8.82669 3.49647 8.79676 3.76815 8.97597L3.8785 9.06581L7.03084 12.2182L12.8053 3.74941L12.8961 3.64101Z",
		);
		svg.append(path);
	}
	indicator.append(svg);
	button.append(indicator);
}
