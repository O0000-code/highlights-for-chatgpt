import { describe, expect, test } from "bun:test";
import {
	captureSelectionAnchor,
	findBestRange,
} from "../../src/content/anchors";
import {
	getMessageElement,
	getPromptElements,
} from "../../src/content/chatgpt-dom";
import {
	dismissSelectionToolbar,
	initSelectionToolbar,
} from "../../src/content/selection-toolbar";
import { installDom } from "./test-environment";

describe("refreshed ChatGPT conversation", () => {
	test("recognizes messages without articles and captures context within the message", () => {
		installDom(
			`<nav>Unrelated duplicate</nav><div data-chatgpt-selection-message-id="message-one"><div data-markdown-text-style="assistant-message"><p>Before useful <strong>answer</strong> after.</p></div></div>`,
		);
		const text = document.querySelector("p")?.firstChild as Text;
		const range = document.createRange();
		range.setStart(text, 7);
		range.setEnd(text, 13);
		const selection = window.getSelection() as Selection;
		selection.addRange(range);
		expect(
			getMessageElement(text)?.getAttribute("data-markdown-text-style"),
		).toBe("assistant-message");
		const capture = captureSelectionAnchor(selection);
		expect(capture?.text).toBe("useful");
		expect(capture?.prefix).toBe("Before ");
		expect(capture?.suffix).toBe(" answer after.");
	});

	test("adds the native action to the single Ask ChatGPT toolbar", async () => {
		installDom(
			`<div data-chatgpt-selection-message-id="one"><div data-markdown-text-style="assistant-message"><p id="answer">Useful answer.</p></div></div><div role="presentation"><button class="native-action h-token-button-composer-sm rounded-none">Ask ChatGPT</button></div>`,
		);
		let text = "";
		initSelectionToolbar(async (capture) => {
			text = capture.text;
			return true;
		});
		const range = document.createRange();
		range.selectNodeContents(document.querySelector("p") as HTMLElement);
		(window.getSelection() as Selection).addRange(range);
		document
			.getElementById("answer")
			?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
		const action = document.getElementById(
			"highlights-native-action",
		) as HTMLButtonElement;
		expect(action).not.toBeNull();
		expect(action.className).toContain("h-token-button-composer-sm");
		action.click();
		await Promise.resolve();
		expect(text).toBe("Useful answer.");
		dismissSelectionToolbar();
	});

	test("deduplicates nested user message hooks and ignores hidden cached conversations", () => {
		installDom(
			`<div data-chatgpt-selection-message-id="user-one"><div data-markdown-text-style="user-message">First prompt</div></div><article data-message-author-role="user">Second prompt</article><div hidden><div data-markdown-text-style="user-message">Cached prompt</div></div>`,
		);
		expect(getPromptElements().map((element) => element.textContent)).toEqual([
			"First prompt",
			"Second prompt",
		]);
	});

	test("recognizes the refreshed plain user prompt without a markdown or selection wrapper", () => {
		installDom(
			`<div data-chatgpt-search-unit-key="fallback-turn-0:0:user"><div><p id="prompt">A useful user prompt</p></div></div><div data-chatgpt-search-unit-key="fallback-turn-0:2:assistant"><div data-markdown-text-style="assistant-message">An answer</div></div>`,
		);
		const paragraph = document.getElementById("prompt") as HTMLElement;
		expect(
			getMessageElement(paragraph)?.getAttribute(
				"data-chatgpt-search-unit-key",
			),
		).toBe("fallback-turn-0:0:user");
		expect(getPromptElements()).toHaveLength(1);
		expect(getPromptElements()[0]?.textContent).toBe("A useful user prompt");
	});

	test("restores the visible passage rather than a hidden cached duplicate or composer", () => {
		installDom(
			`<div hidden>Useful answer.</div><div aria-hidden="true">Useful answer.</div><div contenteditable="plaintext-only">Useful answer.</div><div data-chatgpt-selection-message-id="one"><div data-markdown-text-style="assistant-message"><p id="visible-answer">Useful <strong>answer.</strong></p></div></div>`,
		);
		const before = document.body.innerHTML;
		const range = findBestRange(document.body, "Useful answer.");
		expect(range?.startContainer.parentElement?.id).toBe("visible-answer");
		expect(document.body.innerHTML).toBe(before);
	});
});
