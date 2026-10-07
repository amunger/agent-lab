import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { connectServer } from "./helpers.mjs";

test("bundled stdio MCP exposes read-only tools, app metadata, errors and a self-contained resource", async (t) => {
	const { client, stderr } = await connectServer();
	t.after(() => client.close());
	const tools = await client.listTools();
	assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), ["inspect_cleanup_directory", "show_cleanup_recommendations"]);
	for (const tool of tools.tools) {
		assert.equal(tool.annotations.readOnlyHint, true);
		assert.equal(tool.annotations.destructiveHint, false);
	}
	const tool = tools.tools.find((value) => value.name === "show_cleanup_recommendations");
	const uri = tool._meta.ui.resourceUri;
	const resource = await client.readResource({ uri });
	assert.equal(resource.contents[0].mimeType, "text/html;profile=mcp-app");
	assert.match(resource.contents[0].text, /Clean up selected/);
	assert.ok(!resource.contents[0].text.includes("/* APP_SCRIPT */"));
	assert.ok(!/<script[^>]+src=/.test(resource.contents[0].text));
	const result = await client.callTool({
		name: tool.name, arguments: { title: "Test", scope: "Test host", candidates: [] },
	});
	assert.ok(!result.isError);
	assert.deepEqual(result.structuredContent.candidates, []);
	assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
	const bad = await client.callTool({ name: "inspect_cleanup_directory", arguments: { path: "relative" } });
	assert.equal(bad.isError, true);
	assert.match(bad.content[0].text, /absolute/);
	const config = JSON.parse(await readFile(new URL("../../.mcp.json", import.meta.url)));
	assert.equal(config.mcpServers["disk-cleanup"].args[0], "${PLUGIN_ROOT}/mcp/dist/server.mjs");
	const manifest = JSON.parse(await readFile(new URL("../../plugin.json", import.meta.url)));
	assert.equal(manifest.mcpServers, ".mcp.json");
	assert.equal(stderr(), "");
});
