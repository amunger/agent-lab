import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { before, after, test } from "node:test";
import { chromium } from "playwright-core";
import { startPreview } from "../../preview/server.mjs";

let browser;
let preview;
before(async () => {
	preview = await startPreview();
	browser = await chromium.launch(process.env.MCP_APP_BROWSER ? { executablePath: process.env.MCP_APP_BROWSER } : { channel: "msedge" });
});
after(async () => {
	await browser?.close();
	await preview?.close();
});
async function openApp(t, mode = "") {
	const page = await browser.newPage();
	t.after(() => page.close());
	await page.goto(`${preview.origin}/?mode=${mode}`);
	await page.waitForFunction(() => window.previewHost?.ready);
	return { page, app: page.frameLocator("#app") };
}

async function waitForHostLayout(page, app) {
	const height = await app.locator("body").evaluate((body) => Math.ceil(body.getBoundingClientRect().height));
	// Host resize notifications cross the iframe boundary after the checkbox is visible.
	await page.waitForFunction((expected) => document.getElementById("app").clientHeight >= expected, height);
}

for (const mode of ["structured", "text"]) {
	test(`${mode}: unchecked defaults, selected-only prompt, one handoff, no real cleanup`, async (t) => {
		const { page, app } = await openApp(t, mode);
		const checkboxes = app.locator("#candidates input");
		assert.equal(await checkboxes.count(), 3);
		assert.equal(await app.locator("#candidates input:checked").count(), 0);
		assert.equal(await app.locator("#cleanup").isDisabled(), true);
		assert.deepEqual(await page.evaluate(() => window.previewHost.messages), []);
		await checkboxes.nth(0).check();
		await app.locator("#cleanup").click();
		await page.waitForFunction(() => window.previewHost.messages.length === 1);
		const messages = await page.evaluate(() => window.previewHost.messages);
		assert.equal(messages[0].role, "user");
		const prompt = messages[0].content[0].text;
		const snapshot = JSON.parse(prompt.slice(prompt.indexOf('{\n')));
		assert.equal(snapshot.selected.length, 1);
		assert.equal(snapshot.selected[0].kind, "build-artifacts");
		assert.match(prompt, /separate approval/);
		assert.equal(await app.locator("#cleanup").isDisabled(), true);
		assert.equal(await checkboxes.nth(1).isDisabled(), true);
		await app.getByText(/prompt handed to chat/).waitFor();
		assert.deepEqual(await page.evaluate(() => window.previewHost.errors), []);
	});
}

test("risk acknowledgement is required and resets when selection changes", async (t) => {
	const { page, app } = await openApp(t);
	await app.locator(".risky input").check();
	assert.equal(await app.locator("#risk-area").isVisible(), true);
	assert.equal(await app.locator("#cleanup").isDisabled(), true);
	await waitForHostLayout(page, app);
	await app.locator("#acknowledge").check();
	assert.equal(await app.locator("#cleanup").isEnabled(), true);
	await app.locator("#candidates input").nth(0).check();
	assert.equal(await app.locator("#acknowledge").isChecked(), false);
	assert.equal(await app.locator("#cleanup").isDisabled(), true);
	await app.locator("#clear").click();
	assert.equal(await app.locator("#risk-area").isVisible(), false);
	await app.locator("#select-recoverable").click();
	assert.equal(await app.locator("#candidates input:checked").count(), 2);
	assert.equal(await app.locator(".risky input").isChecked(), false);
});

test("host rejection is visible and allows retry without a success claim", async (t) => {
	const { page, app } = await openApp(t);
	await page.evaluate(() => { window.previewHost.reject = true; });
	await app.locator("#candidates input").nth(0).check();
	await app.locator("#cleanup").click();
	await app.getByText(/host rejected/).waitFor();
	assert.deepEqual(await page.evaluate(() => window.previewHost.messages), []);
	assert.equal(await app.locator("#cleanup").isEnabled(), true);
	await page.evaluate(() => { window.previewHost.reject = false; });
	await app.locator("#cleanup").click();
	await page.waitForFunction(() => window.previewHost.messages.length === 1);
});

test("malformed results invalidate old selections and a fresh result resets them", async (t) => {
	const { page, app } = await openApp(t);
	await app.locator("#candidates input").nth(0).check();
	await page.evaluate(() => window.previewHost.sendResult({ isError: true, content: [] }));
	await app.getByText(/Cannot load review/).waitFor();
	assert.equal(await app.locator("#cleanup").isDisabled(), true);
	assert.equal(await app.locator("#candidates input").count(), 0);
	await page.evaluate((result) => window.previewHost.sendResult(result), preview.result);
	await app.locator("#candidates input").nth(0).waitFor();
	assert.equal(await app.locator("#candidates input:checked").count(), 0);
	assert.equal(await app.locator("#cleanup").isDisabled(), true);
});

test("untrusted descriptions are text and layout remains usable at narrow widths", async (t) => {
	const { page, app } = await openApp(t);
	const result = structuredClone(preview.result);
	result.structuredContent.candidates[0].reason = '<img src=x onerror="window.injected=true">';
	await page.evaluate((value) => window.previewHost.sendResult(value), result);
	await app.getByText(result.structuredContent.candidates[0].reason, { exact: true }).waitFor();
	assert.equal(await app.locator("img").count(), 0);
	await page.setViewportSize({ width: 360, height: 900 });
	assert.equal(await app.locator("body").evaluate((body) => body.scrollWidth <= body.clientWidth), true);
	await app.locator("#candidates input").nth(0).focus();
	await app.locator("#candidates input").nth(0).press("Space");
	assert.equal(await app.locator("#cleanup").isEnabled(), true);
});

test("empty review and invalid initial result are explicit and non-actionable", async (t) => {
	const { page, app } = await openApp(t, "invalid");
	await app.getByText(/Cannot load review/).waitFor();
	assert.equal(await app.locator("#cleanup").isDisabled(), true);
	const result = structuredClone(preview.result);
	result.structuredContent.candidates = [];
	await page.evaluate((value) => window.previewHost.sendResult(value), result);
	await app.getByText(/No directories meet/).waitFor();
	assert.equal(await app.locator("#cleanup").isDisabled(), true);
});

test("exported standalone example works offline and captures only selected entries", async (t) => {
	const directory = await mkdtemp(path.join(os.tmpdir(), "cleanup-example-test-"));
	t.after(() => rm(directory, { recursive: true }));
	const file = path.join(directory, "example.html");
	await writeFile(file, preview.html);
	const page = await browser.newPage();
	t.after(() => page.close());
	await page.context().setOffline(true);
	await page.goto(pathToFileURL(file).href);
	await page.waitForFunction(() => window.previewHost?.ready);
	const app = page.frameLocator("#app");
	await app.locator("#select-recoverable").click();
	await app.locator("#cleanup").click();
	await page.waitForFunction(() => window.previewHost.messages.length === 1);
	const prompt = await page.locator("#prompt").innerText();
	assert.equal(JSON.parse(prompt.slice(prompt.indexOf('{\n'))).selected.length, 2);
	assert.match(await page.locator("#host-status").innerText(), /does not send it to chat/);
});
