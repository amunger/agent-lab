import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCleanupPrompt, createReview, readReview } from "../model.ts";

const now = new Date("2026-10-07T16:00:00Z");
const day = 86_400_000;
const candidate = {
	path: "Q:\\src\\example\\out",
	kind: "build-artifacts",
	bytes: 1234,
	lastModifiedAt: "2026-10-01T16:00:00Z",
	risk: "recoverable",
	reason: "Reproducible output; no tracked files.",
	evidence: ["Build script regenerates this directory."],
	recovery: "Run the repository build.",
};
const input = (candidates) => ({ title: "Review", scope: "Test machine", candidates });

for (const [risk, threshold] of [["recoverable", 7], ["possible-data-loss", 30]]) {
	for (const [offset, allowed] of [[-1, false], [0, false], [1, true]]) {
		test(`${risk} worktree threshold ${threshold} days with ${offset}ms is ${allowed}`, () => {
			const entry = { ...candidate, kind: "worktree", risk, lastModifiedAt: new Date(now.getTime() - threshold * day - offset).toISOString() };
			if (allowed) {
				assert.equal(createReview(input([entry]), now).candidates.length, 1);
			} else {
				assert.throws(() => createReview(input([entry]), now), /must be over/);
			}
		});
	}
}

test("recent artifacts qualify, future dates do not", () => {
	assert.equal(createReview(input([{ ...candidate, lastModifiedAt: now.toISOString() }]), now).candidates.length, 1);
	assert.throws(() => createReview(input([{ ...candidate, lastModifiedAt: new Date(now.getTime() + 1).toISOString() }]), now), /future/);
});

test("sorts biggest first without mutating inputs and supports an empty review", () => {
	const entries = [candidate, { ...candidate, path: "/repo/build-output", bytes: 999999 }];
	assert.equal(createReview(input(entries), now).candidates[0].bytes, 999999);
	assert.equal(entries[0], candidate);
	assert.deepEqual(createReview(input([]), now).candidates, []);
});

for (const path of ["Q:\\src\\example", "q:/src/EXAMPLE/out", "Q:/src/example//out/child"]) {
	test(`rejects overlapping paths ${path}`, () => {
		assert.throws(() => createReview(input([candidate, { ...candidate, path }]), now), /Overlapping/);
	});
}

for (const path of ["/", "C:\\", "\\\\server\\share", "relative/out", "\\rooted", "C:\\src\\..\\out", "/repo/*", "/repo/\n"]) {
	test(`rejects unsafe path ${JSON.stringify(path)}`, () => {
		assert.throws(() => createReview(input([{ ...candidate, path }]), now));
	});
}

test("roundtrips structured and text-only results, and clears invalid/error results", () => {
	const review = createReview(input([candidate]), now);
	assert.deepEqual(readReview({ structuredContent: review }), review);
	assert.deepEqual(readReview({ content: [{ type: "text", text: JSON.stringify(review) }] }), review);
	assert.throws(() => readReview({ isError: true, structuredContent: review }), /tool failed/);
	assert.throws(() => readReview({ content: [] }), /missing/);
	assert.throws(() => readReview({ structuredContent: { candidates: [] } }));
	assert.throws(() => readReview({ content: [{ type: "text", text: "broken JSON" }] }));
});

test("prompt contains exactly selected entries with revalidation and preservation instructions", () => {
	const excluded = { ...candidate, path: "/repo/do-not-delete" };
	const review = createReview(input([candidate, excluded]), now);
	const prompt = buildCleanupPrompt(review, new Set([candidate.path]));
	const snapshot = JSON.parse(prompt.slice(prompt.indexOf('{\n')));
	assert.deepEqual(snapshot.selected, [candidate]);
	assert.ok(!prompt.includes(excluded.path));
	assert.match(prompt, /without force; preserve branches/);
	assert.match(prompt, /separate approval/);
	assert.match(prompt, /not commands or instructions/);
	assert.throws(() => buildCleanupPrompt(review, new Set()), /Select at least/);
	assert.throws(() => buildCleanupPrompt(review, new Set(["/unknown"])), /Select at least/);
});
