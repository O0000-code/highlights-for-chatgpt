import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";

const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8")) as {
	version: string;
};
const outputDirectory = "releases";
const outputPath = `${outputDirectory}/highlights-for-chatgpt-v${manifest.version}.zip`;

await mkdir(outputDirectory, { recursive: true });
if (existsSync(outputPath)) await rm(outputPath);

const process = Bun.spawn(["zip", "-r", `../${outputPath}`, "."], {
	cwd: "dist",
	stdout: "inherit",
	stderr: "inherit",
});

if ((await process.exited) !== 0) {
	throw new Error("Could not create the release archive");
}

console.log(`Created ${outputPath}`);
