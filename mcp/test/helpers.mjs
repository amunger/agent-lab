import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

export async function connectServer() {
	const client = new Client({ name: "cleanup-test", version: "1.0.0" });
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: [fileURLToPath(new URL("../dist/server.mjs", import.meta.url))],
		cwd: fileURLToPath(new URL("../../", import.meta.url)),
		stderr: "pipe",
	});
	let stderr = "";
	transport.stderr?.on("data", (data) => { stderr += data.toString(); });
	try {
		await client.connect(transport);
		return { client, stderr: () => stderr };
	} catch (error) {
		await transport.close();
		throw new Error(`MCP connection failed: ${stderr}`, { cause: error });
	}
}
