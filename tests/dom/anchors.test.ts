import { beforeEach, describe, expect, test } from "bun:test";
import {
	captureSelectionAnchor,
	findBestRange,
	findRangeCandidates,
} from "../../src/content/anchors";
import { installDom } from "./test-environment";

describe("text anchoring", () => {
	beforeEach(() => {
		installDom(`
			<main>
				<article data-message-author-role="assistant">
					<p id="first">Before duplicate answer after.</p>
					<p id="second">Before better duplicate answer after.</p>
				</article>
			</main>
		`);
	});

	test("uses surrounding context to choose between duplicate text", () => {
		const candidates = findRangeCandidates(document.body, "duplicate answer", {
			prefix: "Before better ",
			suffix: " after.",
		});
		expect(candidates).toHaveLength(2);
		const best = findBestRange(document.body, "duplicate answer", {
			prefix: "Before better ",
			suffix: " after.",
		});
		expect(
			best?.startContainer.parentElement?.closest("#second"),
		).not.toBeNull();
	});

	test("restores text across nested elements without changing markup", () => {
		installDom(`
			<article data-message-author-role="assistant">
				<p id="message">A <strong>multi-node</strong> answer remains intact.</p>
			</article>
		`);
		const before = document.body.innerHTML;
		const range = findBestRange(
			document.body,
			"A multi-node answer remains intact.",
		);
		expect(range?.toString()).toBe("A multi-node answer remains intact.");
		expect(document.body.innerHTML).toBe(before);
	});

	test("falls back to collapsed-whitespace matching", () => {
		installDom(`
			<article data-message-author-role="assistant">
				<p>The anchored\n\tanswer survives\n\tlayout whitespace.</p>
			</article>
		`);
		const range = findBestRange(
			document.body,
			"The anchored answer survives layout whitespace.",
		);
		expect(range?.toString().replace(/\s+/g, " ").trim()).toBe(
			"The anchored answer survives layout whitespace.",
		);
	});

	test("captures prefix, suffix, and the exact selected range", () => {
		const paragraph = document.getElementById("second");
		const text = paragraph?.firstChild;
		expect(text).toBeTruthy();
		const range = document.createRange();
		range.setStart(text as Text, 14);
		range.setEnd(text as Text, 30);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
		const captured = captureSelectionAnchor(selection as Selection);
		expect(captured?.text).toBe("duplicate answer");
		expect(captured?.prefix.endsWith("Before better ")).toBe(true);
		expect(captured?.suffix.startsWith(" after.")).toBe(true);
		expect(captured?.occurrence).toBe(1);
		expect(captured?.range.toString()).toBe("duplicate answer");
	});
});
