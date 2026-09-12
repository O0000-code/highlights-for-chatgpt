import { Window } from "happy-dom";

export class MockHighlight extends Set<Range> {
	constructor(...ranges: Range[]) {
		super(ranges);
	}
}

export function installDom(
	html: string,
	url = "https://chatgpt.com/c/test-conversation",
) {
	const window = new Window({
		url,
	});
	window.document.body.innerHTML = html;
	const nativeHighlights = new Map<string, MockHighlight>();
	Object.assign(globalThis, {
		CSS: { highlights: nativeHighlights },
		Highlight: MockHighlight,
		window,
		document: window.document,
		Node: window.Node,
		Text: window.Text,
		Element: window.Element,
		HTMLElement: window.HTMLElement,
		HTMLInputElement: window.HTMLInputElement,
		HTMLTextAreaElement: window.HTMLTextAreaElement,
		NodeFilter: window.NodeFilter,
		Range: window.Range,
		Event: window.Event,
		CustomEvent: window.CustomEvent,
		MouseEvent: window.MouseEvent,
		MutationObserver: window.MutationObserver,
		getComputedStyle: window.getComputedStyle.bind(window),
	});
	return { window, nativeHighlights };
}
