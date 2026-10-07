import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";

const { result, html } = window.previewData;
const mode = new URL(location.href).searchParams.get("mode");
const bridge = new AppBridge(null,
	{ name: "Cleanup preview host", version: "1.0.0" },
	{ message: { text: {} } },
	{ hostContext: { theme: "light" } },
);
const state = window.previewHost = {
	ready: false, messages: [], errors: [], reject: false,
	sendResult: (value) => bridge.sendToolResult(value),
};
bridge.onerror = (error) => {
	state.errors.push(error.message);
	document.getElementById("host-status").textContent = error.message;
};
bridge.onmessage = async (message) => {
	if (state.reject) {
		return { isError: true };
	}
	state.messages.push(message);
	document.getElementById("prompt").textContent = message.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
	document.getElementById("host-status").textContent = "Prompt captured below. This preview does not send it to chat or remove files.";
	return {};
};
bridge.oninitialized = async () => {
	await bridge.sendToolInput({ arguments: result.structuredContent });
	await bridge.sendToolResult(mode === "invalid" ? { content: [] } : mode === "text" ? { content: result.content } : result);
	state.ready = true;
	document.getElementById("host-status").textContent = "Example ready. Select directories to preview a cleanup prompt.";
};
bridge.onsizechange = ({ height }) => {
	document.getElementById("app").style.height = `${height}px`;
};
const iframe = document.getElementById("app");
await bridge.connect(new PostMessageTransport(iframe.contentWindow, iframe.contentWindow));
iframe.srcdoc = html;
