import { describe, expect, test } from "bun:test";
import { loadEarlierUntilVisible } from "../../src/content/deep-link";

describe("long-conversation deep links", () => {
	test("loads older content until the requested highlight becomes visible", async () => {
		let top = 2400;
		let attempts = 0;
		const found = await loadEarlierUntilVisible({
			tryReveal: () => attempts >= 2,
			readScrollState: () => ({ top, height: 4000, viewport: 800 }),
			scrollUp: (nextTop) => {
				top = nextTop;
				attempts++;
			},
			waitForRender: async () => undefined,
		});
		expect(found).toBe(true);
		expect(attempts).toBe(2);
	});

	test("stops after the top remains stable", async () => {
		let attempts = 0;
		const found = await loadEarlierUntilVisible({
			tryReveal: () => false,
			readScrollState: () => ({ top: 0, height: 1000, viewport: 800 }),
			scrollUp: () => attempts++,
			waitForRender: async () => undefined,
			maxAttempts: 20,
		});
		expect(found).toBe(false);
		expect(attempts).toBe(20);
	});
});
