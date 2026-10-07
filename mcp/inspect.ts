import { lstat, readdir, realpath, statfs } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export async function inspectDirectory(directory: string) {
	if (!path.isAbsolute(directory)) {
		throw new Error("Inspection requires an absolute directory path.");
	}
	const root = path.resolve(directory);
	const info = await lstat(root);
	if (!info.isDirectory() || info.isSymbolicLink()) {
		throw new Error("Inspection requires a directory, not a file, symlink or junction.");
	}
	const resolved = await realpath(root);
	const pending = [resolved];
	let bytes = 0;
	let files = 0;
	let lastModified = info.mtimeMs;
	let latestFile = resolved;
	const skippedLinks: string[] = [];
	while (pending.length) {
		const current = pending.pop();
		if (!current) {
			throw new Error("Missing pending directory.");
		}
		for (const entry of await readdir(current, { withFileTypes: true })) {
			// A worktree's .git pointer/shared object store is not reclaimable tree content.
			if (entry.name === ".git") {
				continue;
			}
			const fullPath = path.join(current, entry.name);
			const stat = await lstat(fullPath);
			if (stat.isSymbolicLink()) {
				skippedLinks.push(fullPath);
				continue;
			}
			if (stat.mtimeMs > lastModified) {
				lastModified = stat.mtimeMs;
				latestFile = fullPath;
			}
			if (stat.isDirectory()) {
				pending.push(fullPath);
			} else if (stat.isFile()) {
				bytes += stat.size;
				files++;
			}
		}
	}
	const volume = await statfs(resolved);
	return {
		path: resolved,
		host: os.hostname(),
		bytes,
		files,
		lastModifiedAt: new Date(lastModified).toISOString(),
		latestEntry: latestFile,
		skippedLinks,
		freeBytes: volume.bavail * volume.bsize,
		inspectedAt: new Date().toISOString(),
		note: "Logical file sizes, not allocated disk space; hardlinks may be counted more than once. .git excluded. No Git safety assessment performed.",
	};
}
