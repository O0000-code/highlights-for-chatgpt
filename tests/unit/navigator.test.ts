import { describe, expect, test } from "bun:test";
import { layoutMarkerStack } from "../../src/content/navigator";

describe("highlight navigation rail", () => {
	test("shows a centered marker even when only one highlight exists", () => {
		const layout = layoutMarkerStack(1, 520);
		expect(layout.height).toBe(10);
		expect(layout.positions).toEqual([5]);
	});

	test("matches ChatGPT's 10px prompt-marker rhythm and compresses dense sets", () => {
		expect(layoutMarkerStack(4, 520)).toMatchObject({
			height: 40,
			pitch: 10,
		});
		const dense = layoutMarkerStack(100, 520);
		expect(dense.height).toBe(520);
		expect(dense.pitch).toBeCloseTo(510 / 99);
		expect(dense.positions).toHaveLength(100);
	});
});
