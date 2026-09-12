import { beforeEach, describe, expect, test } from "bun:test";
import { initHighlightNavigator } from "../../src/content/navigator";
import { initHighlightPalette } from "../../src/content/palette";
import {
	clearRenderedHighlights,
	renderHighlight,
} from "../../src/content/renderer";
import { initSelectionToolbar } from "../../src/content/selection-toolbar";
import {
	DATA_SCHEMA_VERSION,
	type HighlightRecord,
} from "../../src/shared/types";
import { installDom, type MockHighlight } from "./test-environment";

let nativeHighlights: Map<string, MockHighlight>;

function record(): HighlightRecord {
	return {
		id: "interaction-highlight",
		schemaVersion: DATA_SCHEMA_VERSION,
		threadId: "chatgpt:test-conversation",
		url: "https://chatgpt.com/c/test-conversation",
		text: "Useful answer",
		prefix: "",
		suffix: "",
		color: "yellow",
		createdAt: 1,
		updatedAt: 1,
	};
}

describe("core interactions", () => {
	beforeEach(() => {
		({ nativeHighlights } = installDom(`
			<article data-message-author-role="user" id="prompt-one">
				<p>First prompt</p>
			</article>
			<article data-message-author-role="assistant">
				<p id="answer">Useful answer for this test.</p>
			</article>
			<article data-message-author-role="user" id="prompt-two">
				<p>Second prompt</p>
			</article>
			<div id="native-toolbar">
				<button class="native-segment">Ask ChatGPT</button>
				<button class="native-segment">Start writing</button>
			</div>
		`));
		clearRenderedHighlights();
	});

	test("adds Highlight as a native toolbar segment with a separator", async () => {
		let capturedText = "";
		initSelectionToolbar(async (capture) => {
			capturedText = capture.text;
			return true;
		});
		const textNode = document.getElementById("answer")?.firstChild;
		const range = document.createRange();
		range.setStart(textNode as Text, 0);
		range.setEnd(textNode as Text, 13);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
		document
			.getElementById("answer")
			?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

		const action = document.getElementById(
			"highlights-native-action",
		) as HTMLButtonElement | null;
		expect(action).not.toBeNull();
		expect(action?.className).toBe("native-segment");
		expect(action?.style.borderInlineStart).toContain("1px solid");
		action?.click();
		await Promise.resolve();
		expect(capturedText).toBe("Useful answer");
	});

	test("opens the equal-weight color palette and keeps Remove last", () => {
		renderHighlight(record());
		const range = Array.from(
			nativeHighlights.get("highlights-yellow") ?? [],
		)[0];
		expect(range).toBeTruthy();
		Object.defineProperty(range, "getClientRects", {
			value: () => [
				{ left: 0, right: 120, top: 0, bottom: 24, width: 120, height: 24 },
			],
		});
		initHighlightPalette({
			onColorChange: async () => true,
			onRemove: async () => true,
		});
		document
			.getElementById("answer")
			?.dispatchEvent(
				new MouseEvent("click", { bubbles: true, clientX: 20, clientY: 10 }),
			);

		const palette = document.getElementById("highlights-color-palette");
		const buttons = palette?.querySelectorAll("button");
		expect(buttons).toHaveLength(5);
		expect(buttons?.[0]?.getAttribute("aria-pressed")).toBe("true");
		expect(buttons?.[4]?.textContent).toBe("Remove");
		expect(
			palette?.querySelector("[aria-pressed='true']")?.className,
		).toContain("color");
	});

	test("renders a real navigation marker for a single highlight", () => {
		renderHighlight(record());
		initHighlightNavigator();
		const navigator = document.getElementById("highlights-navigator");
		expect(navigator?.hidden).toBe(false);
		expect(
			navigator?.querySelectorAll(
				".highlights-fallback-marker[data-highlight-id='interaction-highlight']",
			),
		).toHaveLength(1);
	});

	test("integrates markers and rows into ChatGPT's native prompt navigator", async () => {
		const firstMountedPrompt = document.querySelector("#prompt-one p");
		const secondMountedPrompt = document.querySelector("#prompt-two p");
		if (firstMountedPrompt) firstMountedPrompt.textContent = "Third prompt";
		if (secondMountedPrompt) secondMountedPrompt.textContent = "Fourth prompt";
		Object.defineProperty(window, "innerWidth", {
			configurable: true,
			value: 1218,
		});
		Object.defineProperty(window, "innerHeight", {
			configurable: true,
			value: 768,
		});
		const nativeRail = document.createElement("div");
		nativeRail.className = "fixed inset-e-4 top-1/2";
		nativeRail.style.position = "fixed";
		Object.defineProperty(nativeRail, "getBoundingClientRect", {
			value: () => ({
				bottom: 464,
				height: 160,
				left: 1166,
				right: 1202,
				top: 304,
				width: 36,
			}),
		});
		const nativeStack = document.createElement("div");
		for (const index of [1, 2, 3, 4]) {
			const marker = document.createElement("button");
			marker.setAttribute("aria-label", `Prompt ${index}`);
			Object.defineProperty(marker, "getBoundingClientRect", {
				value: () => ({
					bottom: 308 + index * 10,
					height: 2,
					left: 1175,
					right: 1193,
					top: 306 + index * 10,
					width: 18,
				}),
			});
			nativeStack.appendChild(marker);
		}
		nativeRail.appendChild(nativeStack);

		const nativeMenu = document.createElement("ul");
		Object.defineProperty(nativeMenu, "getBoundingClientRect", {
			value: () => ({
				bottom: 258,
				height: 180,
				left: 882,
				right: 1202,
				top: 150,
				width: 320,
			}),
		});
		const promptLabels = [
			"First prompt",
			"Second prompt",
			"Third prompt",
			"Fourth prompt",
		];
		for (const index of [1, 2, 3, 4]) {
			const item = document.createElement("li");
			const button = document.createElement("button");
			button.className = "group __menu-item hoverable w-full text-start";
			button.textContent = promptLabels[index - 1] ?? "";
			Object.defineProperty(button, "getBoundingClientRect", {
				value: () => ({
					bottom: 186 + index * 36,
					height: 36,
					left: 888,
					right: 1196,
					top: 150 + index * 36,
					width: 308,
				}),
			});
			item.appendChild(button);
			nativeMenu.appendChild(item);
		}
		nativeRail.appendChild(nativeMenu);
		document.body.appendChild(nativeRail);

		renderHighlight(record());
		const renderedRange = Array.from(
			nativeHighlights.get("highlights-yellow") ?? [],
		)[0];
		Object.defineProperty(renderedRange, "getClientRects", {
			value: () => [
				{
					left: 100,
					right: 220,
					top: 300,
					bottom: 324,
					width: 120,
					height: 24,
				},
			],
		});
		initHighlightNavigator();
		const navigator = document.getElementById("highlights-navigator");
		expect(navigator?.hidden).toBe(true);

		const integratedMarker = nativeStack.querySelector<HTMLElement>(
			"[data-highlights-native-marker]",
		);
		expect(integratedMarker).not.toBeNull();
		expect(
			Array.from(nativeStack.children).map((child) =>
				child.getAttribute("aria-label"),
			),
		).toEqual([
			"Prompt 1",
			"Prompt 2",
			"Prompt 3",
			"Highlight 1 of 1: Useful answer",
			"Prompt 4",
		]);
		expect(
			integratedMarker?.style.getPropertyValue("--highlights-marker-color"),
		).toBeTruthy();

		const integratedRow = nativeMenu.querySelector<HTMLElement>(
			"[data-highlights-native-menu-item]",
		);
		expect(integratedRow).not.toBeNull();
		expect(
			Array.from(nativeMenu.children).map((child) => child.textContent),
		).toEqual([
			"First prompt",
			"Second prompt",
			"Third prompt",
			"Useful answer",
			"Fourth prompt",
		]);
		const integratedButton = integratedRow?.querySelector("button");
		expect(integratedButton?.className).toContain("__menu-item");
		expect(integratedButton?.className).toContain(
			"highlights-native-menu-button",
		);
		expect(integratedButton?.textContent).toBe("Useful answer");
		expect(
			integratedButton?.querySelector(".highlights-native-menu-color"),
		).not.toBeNull();
		let didScrollToHighlight = false;
		Object.defineProperty(window, "scrollBy", {
			configurable: true,
			value: () => {
				didScrollToHighlight = true;
			},
		});
		integratedButton?.click();
		expect(didScrollToHighlight).toBe(true);

		integratedMarker?.remove();
		integratedRow?.remove();
		nativeRail.classList.add("opacity-100");
		await new Promise((resolve) => window.setTimeout(resolve, 50));
		expect(
			nativeStack.querySelectorAll("[data-highlights-native-marker]"),
		).toHaveLength(1);
		expect(
			nativeMenu.querySelectorAll("[data-highlights-native-menu-item]"),
		).toHaveLength(1);
	});
});
