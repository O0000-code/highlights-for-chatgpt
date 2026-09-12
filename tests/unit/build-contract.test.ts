import { describe, expect, test } from "bun:test";
import { build } from "bun";

describe("content-script build contract", () => {
	test("isolates bundle variables from browser globals", async () => {
		const result = await build({
			entrypoints: ["src/content.ts"],
			target: "browser",
			format: "iife",
			minify: false,
			sourcemap: "none",
		});

		expect(result.success).toBe(true);
		const output = result.outputs[0];
		expect(output).toBeDefined();
		const code = await output?.text();
		expect(code).toStartWith("(() => {");
		expect(code).not.toMatch(/\bvar navigator\s*=/);
	});
});
