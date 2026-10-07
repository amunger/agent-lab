import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const directory = new URL("./dist/", import.meta.url);
await mkdir(directory, { recursive: true });
const app = await build({
	entryPoints: [fileURLToPath(new URL("./app.ts", import.meta.url))],
	bundle: true, format: "esm", minify: true, platform: "browser", target: "es2022", write: false, metafile: true,
});
const script = app.outputFiles[0]?.text;
const template = (await readFile(new URL("./review.html", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
if (!script || !template.includes("/* APP_SCRIPT */")) {
	throw new Error("Missing application bundle or HTML script placeholder.");
}
await writeFile(new URL("review.html", directory), template.replace("/* APP_SCRIPT */", () => script.replaceAll("</script", "<\\/script")));
const server = await build({
	entryPoints: [fileURLToPath(new URL("./server.ts", import.meta.url))],
	bundle: true, format: "esm", minify: true, platform: "node", target: "node22", metafile: true,
	outfile: fileURLToPath(new URL("server.mjs", directory)),
});

const packages = new Set();
for (const input of [...Object.keys(app.metafile.inputs), ...Object.keys(server.metafile.inputs)]) {
	const match = input.replaceAll("\\", "/").match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);
	if (match) {
		packages.add(match[1]);
	}
}
const notices = [];
for (const directory of [...packages].sort()) {
	const manifest = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
	const licenseFiles = (await readdir(directory)).filter((file) => /^licen[cs]e(?:[.-]|$)/i.test(file));
	if (!licenseFiles.length) {
		throw new Error(`Missing license text for bundled dependency ${manifest.name}`);
	}
	notices.push(`${manifest.name}@${manifest.version}\n${manifest.license}\n`);
	for (const license of licenseFiles.sort()) {
		notices.push(await readFile(path.join(directory, license), "utf8"));
	}
}
await writeFile(new URL("THIRD_PARTY_LICENSES.txt", directory), notices.join("\n\n").replaceAll("\r\n", "\n").replace(/[ \t]+$/gm, ""));
