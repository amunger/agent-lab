import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { connectServer } from "../test/helpers.mjs";
import { exampleReview } from "./example.mjs";

export async function startPreview() {
	const { client } = await connectServer();
	let server;
	try {
		const result = await client.callTool({ name: "show_cleanup_recommendations", arguments: exampleReview() });
		if (result.isError) {
			throw new Error(JSON.stringify(result.content));
		}
		const resource = await client.readResource({ uri: "ui://disk-cleanup/review.html" });
		const host = await build({
			entryPoints: [fileURLToPath(new URL("./host.mjs", import.meta.url))],
			bundle: true, format: "esm", platform: "browser", minify: true, write: false,
		});
		const data = JSON.stringify({ result, html: resource.contents[0].text }).replaceAll("<", "\\u003c");
		const script = host.outputFiles[0].text.replaceAll("</script", "<\\/script");
		const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Disk cleanup - interactive example</title>
<style>body{font:14px system-ui;background:#edf1f7;color:#202938;max-width:1080px;margin:24px auto;padding:0 16px}iframe{width:100%;height:1000px;border:1px solid #cbd5e1;border-radius:12px;background:white}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:white;padding:16px;border-radius:8px}.notice{padding:12px;background:#fff4d8;border-radius:8px}</style>
<h1>Disk cleanup / MCP App example</h1><p class="notice"><strong>Simulation only.</strong> These are illustrative entries, not recommendations for this computer. Select entries and click cleanup to preview the exact prompt. Nothing is deleted or sent to a real chat.</p>
<iframe id="app" title="Cleanup review app" sandbox="allow-scripts"></iframe>
<p id="host-status" role="status">Waiting for the MCP App.</p><details open><summary>Captured cleanup prompt</summary><pre id="prompt">Select directories in the app above.</pre></details><script>window.previewData=${data};</script><script type="module">${script}</script></html>`;
		const routes = new Map([
			["/", ["text/html", html]],
			["/favicon.ico", ["image/x-icon", ""]],
		]);
		server = createServer((request, response) => {
			const route = routes.get(new URL(request.url, "http://localhost").pathname);
			response.writeHead(route ? 200 : 404, { "Content-Type": route?.[0] ?? "text/plain", "Cache-Control": "no-store" });
			response.end(route?.[1] ?? "Not found");
		});
		await new Promise((resolve, reject) => {
			server.once("error", reject);
			server.listen(0, "127.0.0.1", resolve);
		});
		return {
			origin: `http://127.0.0.1:${server.address().port}`,
			result,
			html,
			async close() {
				try {
					await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
				} finally {
					await client.close();
				}
			},
		};
	} catch (error) {
		server?.close();
		await client.close();
		throw error;
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const preview = await startPreview();
	console.log(`Disk cleanup example: ${preview.origin}`);
	const stop = async () => { await preview.close(); };
	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);
}
