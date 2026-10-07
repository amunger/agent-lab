export function exampleReview() {
	const daysAgo = (days) => new Date(Date.now() - days * 86_400_000).toISOString();
	return {
		title: "Recommended disk cleanup",
		scope: "EXAMPLE ONLY - illustrative directories, not a scan of this computer",
		candidates: [
			{
				path: "Q:\\example\\copilot-runtime\\build-output",
				kind: "build-artifacts",
				bytes: 48 * 2 ** 30,
				lastModifiedAt: daysAgo(3),
				risk: "recoverable",
				reason: "Example of high-impact compiled runtime artifacts. In a real review, verify the exact output directory and rebuild command from that repository.",
				evidence: ["Illustrative 48 GiB, not a measured directory.", "No Copilot runtime repository was found in the earlier scan."],
				recovery: "Example only: regenerate with the repository's documented build.",
			},
			{
				path: "Q:\\example\\worktrees\\completed-validation",
				kind: "worktree",
				bytes: Math.round(7.19 * 2 ** 30),
				lastModifiedAt: daysAgo(41),
				risk: "recoverable",
				reason: "Example of an old validation worktree with no unique source; removal retains shared Git history.",
				evidence: ["Illustrative clean worktree; assume live main contains HEAD.", "Ignored files verified as reproducible in this example."],
				recovery: "Recreate the worktree from its preserved commit and reinstall dependencies.",
			},
			{
				path: "Q:\\example\\worktrees\\unfinished-experiment",
				kind: "worktree",
				bytes: 3 * 2 ** 30,
				lastModifiedAt: daysAgo(46),
				risk: "possible-data-loss",
				reason: "Over 30 days inactive, but uncommitted changes and untracked notes may be unique. Review before removing.",
				evidence: ["Illustrative dirty working tree.", "Remote preservation has not been established."],
				recovery: "No verified recovery. Preserve unique files/commits first or obtain separate approval.",
			},
		],
	};
}
