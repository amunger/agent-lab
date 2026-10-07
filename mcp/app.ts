import { App, applyDocumentTheme, applyHostStyleVariables, type McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { buildCleanupPrompt, formatBytes, readReview, type Review } from "./model.ts";

function element(id: string): HTMLElement {
	const value = document.getElementById(id);
	if (!value) {
		throw new Error(`Missing UI element: ${id}`);
	}
	return value;
}

const app = new App({ name: "Disk cleanup", version: "0.2.0" });
const list = element("candidates");
const cleanup = element("cleanup");
const status = element("status");
const riskArea = element("risk-area");
const acknowledgement = element("acknowledge");
const selectRecoverable = element("select-recoverable");
const clear = element("clear");
const selected = new Set<string>();
let review: Review | undefined;
let connected = false;
let busy = false;
let submitted = false;
let acknowledged = false;
let generation = 0;

function update(): void {
	const entries = review?.candidates.filter((entry) => selected.has(entry.path)) ?? [];
	const risky = entries.some((entry) => entry.risk === "possible-data-loss");
	riskArea.hidden = !risky;
	element("selection").textContent = `${entries.length} selected / ${formatBytes(entries.reduce((sum, entry) => sum + entry.bytes, 0))} estimated`;
	cleanup.toggleAttribute("disabled", !connected || busy || submitted || !entries.length || (risky && !acknowledged));
	for (const control of [selectRecoverable, clear, acknowledgement, ...list.querySelectorAll("input")]) {
		control.toggleAttribute("disabled", busy || submitted);
	}
}

function render(value: Review): void {
	generation++;
	review = value;
	selected.clear();
	acknowledged = false;
	submitted = false;
	busy = false;
	if (acknowledgement instanceof HTMLInputElement) {
		acknowledgement.checked = false;
	}
	element("title").textContent = value.title;
	element("scope").textContent = value.scope;
	element("reviewed").textContent = `Reviewed ${new Date(value.reviewedAt).toLocaleString()}. Sizes are estimates; evidence must be rechecked before removal.`;
	list.replaceChildren();
	for (const [index, entry] of value.candidates.entries()) {
		const card = document.createElement("article");
		card.className = entry.risk === "possible-data-loss" ? "candidate risky" : "candidate";
		const label = document.createElement("label");
		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.id = `candidate-${index}`;
		checkbox.dataset.path = entry.path;
		checkbox.addEventListener("change", () => {
			if (checkbox.checked) {
				selected.add(entry.path);
			} else {
				selected.delete(entry.path);
			}
			acknowledged = false;
			if (acknowledgement instanceof HTMLInputElement) {
				acknowledgement.checked = false;
			}
			update();
		});
		const path = document.createElement("strong");
		path.textContent = entry.path;
		label.append(checkbox, path);
		const size = document.createElement("span");
		size.className = "size";
		size.textContent = formatBytes(entry.bytes);
		const header = document.createElement("div");
		header.className = "candidate-header";
		header.append(label, size);
		const metadata = document.createElement("p");
		metadata.className = "metadata";
		const age = Math.floor((Date.parse(value.reviewedAt) - Date.parse(entry.lastModifiedAt)) / 86_400_000);
		metadata.textContent = `${entry.kind} / ${entry.risk === "recoverable" ? "Recoverable" : "Possible data loss"} / Updated ${new Date(entry.lastModifiedAt).toLocaleString()} (${age} days ago)`;
		const reason = document.createElement("p");
		reason.textContent = entry.reason;
		const details = document.createElement("details");
		const summary = document.createElement("summary");
		summary.textContent = "Evidence and recovery";
		const evidence = document.createElement("ul");
		for (const fact of entry.evidence) {
			const item = document.createElement("li");
			item.textContent = fact;
			evidence.append(item);
		}
		const recovery = document.createElement("p");
		recovery.textContent = `Recovery: ${entry.recovery}`;
		details.append(summary, evidence, recovery);
		card.append(header, metadata, reason, details);
		list.append(card);
	}
	if (!value.candidates.length) {
		list.textContent = "No directories meet the cleanup criteria in this scope.";
	}
	status.textContent = "";
	update();
}

function theme(context: McpUiHostContext): void {
	if (context.theme) {
		applyDocumentTheme(context.theme);
	}
	if (context.styles?.variables) {
		applyHostStyleVariables(context.styles.variables);
	}
}

app.ontoolresult = (result) => {
	try {
		render(readReview(result));
	} catch (error: unknown) {
		generation++;
		review = undefined;
		selected.clear();
		list.replaceChildren();
		status.textContent = `Cannot load review: ${error instanceof Error ? error.message : String(error)}`;
		update();
	}
};
app.onhostcontextchanged = theme;
app.onerror = (error) => {
	status.textContent = `MCP App error: ${error.message}`;
};

acknowledgement.addEventListener("change", () => {
	acknowledged = acknowledgement instanceof HTMLInputElement && acknowledgement.checked;
	update();
});
selectRecoverable.addEventListener("click", () => {
	for (const input of list.querySelectorAll("input")) {
		const path = input.dataset.path;
		if (path && review?.candidates.some((entry) => entry.path === path && entry.risk === "recoverable")) {
			input.checked = true;
			selected.add(path);
		}
	}
	update();
});
clear.addEventListener("click", () => {
	selected.clear();
	acknowledged = false;
	if (acknowledgement instanceof HTMLInputElement) {
		acknowledgement.checked = false;
	}
	for (const input of list.querySelectorAll("input")) {
		input.checked = false;
	}
	update();
});
cleanup.addEventListener("click", async () => {
	if (!review || cleanup.hasAttribute("disabled")) {
		return;
	}
	const currentGeneration = generation;
	busy = true;
	status.textContent = "Sending cleanup request to chat...";
	update();
	try {
		const result = await app.sendMessage({
			role: "user",
			content: [{ type: "text", text: buildCleanupPrompt(review, selected) }],
		});
		if (currentGeneration !== generation) {
			return;
		}
		if (result.isError) {
			throw new Error("The host rejected the request. Check the chat input before retrying.");
		}
		submitted = true;
		status.textContent = "Cleanup prompt handed to chat. Send it if your host requires confirmation. No files have been deleted by this app.";
	} catch (error: unknown) {
		if (currentGeneration === generation) {
			status.textContent = `Request failed: ${error instanceof Error ? error.message : String(error)} Check chat before retrying to avoid duplicate requests.`;
		}
	} finally {
		if (currentGeneration === generation) {
			busy = false;
			update();
		}
	}
});

try {
	await app.connect();
	const context = app.getHostContext();
	if (context) {
		theme(context);
	}
	connected = true;
	update();
} catch (error: unknown) {
	status.textContent = `Cannot connect to the MCP host: ${error instanceof Error ? error.message : String(error)}`;
	update();
}
