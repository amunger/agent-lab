import { readFile } from "node:fs/promises";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { createReview, recommendationSchema } from "./model.ts";
import { inspectDirectory } from "./inspect.ts";

const resourceUri = "ui://disk-cleanup/review.html";
const server = new McpServer({ name: "Disk cleanup review", version: "0.2.0" });
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

server.registerTool("inspect_cleanup_directory", {
	title: "Measure a cleanup candidate",
	description: "Read-only size and latest filesystem activity for one absolute directory on this MCP server's machine. Excludes .git, skips and reports symlinks/junctions. Does not establish Git safety or recommend deletion. Fails explicitly on unreadable or disappearing files.",
	annotations,
	inputSchema: z.object({ path: z.string().min(1) }),
}, async ({ path }) => {
	try {
		const result = await inspectDirectory(path);
		return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
	} catch (error: unknown) {
		return { isError: true, content: [{ type: "text", text: `Inspection failed: ${error instanceof Error ? error.message : String(error)}` }] };
	}
});

registerAppTool(server, "show_cleanup_recommendations", {
	title: "Review disk cleanup candidates",
	description: "Display verified directory recommendations with sizes, reasons, evidence, risk warnings and checkboxes. The Cleanup button requests a new chat turn for selected paths; this server never deletes files. Prioritize reproducible artifacts across repositories. Worktrees require >7 days inactivity if recoverable, >30 days if potentially lossy. Supply nonoverlapping absolute directories and latest filesystem activity, not commit age.",
	annotations,
	inputSchema: recommendationSchema,
	_meta: { ui: { resourceUri } },
}, async (input) => {
	try {
		const review = createReview(input);
		return { content: [{ type: "text", text: JSON.stringify(review) }], structuredContent: review };
	} catch (error: unknown) {
		return { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
	}
});

registerAppResource(server, resourceUri, resourceUri, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
	contents: [{
		uri: resourceUri,
		mimeType: RESOURCE_MIME_TYPE,
		text: await readFile(new URL("./review.html", import.meta.url), "utf8"),
	}],
}));

await server.connect(new StdioServerTransport());
