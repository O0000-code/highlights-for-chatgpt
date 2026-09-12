import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { build } from "bun";

const outputDirectory = "dist";

if (existsSync(outputDirectory)) {
	await rm(outputDirectory, { recursive: true, force: true });
}
await mkdir(outputDirectory, { recursive: true });

const extensionPages = await build({
	entrypoints: ["src/background.ts", "src/options.ts"],
	outdir: outputDirectory,
	target: "browser",
	format: "esm",
	minify: false,
	sourcemap: "none",
});

const contentScript = await build({
	entrypoints: ["src/content.ts"],
	outdir: outputDirectory,
	target: "browser",
	format: "iife",
	minify: false,
	sourcemap: "none",
});

if (!extensionPages.success || !contentScript.success) {
	for (const message of [...extensionPages.logs, ...contentScript.logs]) {
		console.error(message);
	}
	process.exit(1);
}

await cp("src/manifest.json", `${outputDirectory}/manifest.json`);
await cp("src/options/options.html", `${outputDirectory}/options.html`);
await cp("LICENSE", `${outputDirectory}/LICENSE`);
await cp("THIRD_PARTY_NOTICES.md", `${outputDirectory}/THIRD_PARTY_NOTICES.md`);
await mkdir(`${outputDirectory}/icons`, { recursive: true });
for (const size of [16, 32, 48, 128]) {
	await cp(
		`assets/icons/icon-${size}.png`,
		`${outputDirectory}/icons/icon-${size}.png`,
	);
}

console.log("Built the unpacked extension in dist/.");
