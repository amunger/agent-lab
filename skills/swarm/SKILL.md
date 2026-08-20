---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration."
disable-model-invocation: true
---

# Swarm

Fan out N parallel cloud workers. They may cover separate slices, race the same brief, or mix both. The parent waits, aggregates, and returns one report.

## Start

Open a todolist with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
3. Set N from the user or derive it from the shape. N is total workers, not the cloud concurrency limit.
4. Use `grok-4.6@high` for ordinary workers. Split it into the task tool's `model` and `reasoning_effort` fields. For a model race, name each arm's model and effort up front.
5. Give each worker its own writable output when it writes. Use a worktree, branch, or OS-appropriate temporary directory named `swarm-<slug>/worker-<n>/`.

## Phase B: Fan out

Spawn all N workers concurrently with one task call per worker, `agent_type: "general-purpose"`, `mode: "background"`, and the model plus reasoning effort selected in Phase A. Read-only/report workers may share the current checkout. Give every writing worker a separate worktree or independently scoped session; never let concurrent workers mutate the same checkout.

If the task tool rejects a model or effort, inspect its schema or error and use the closest available model in the same family with the highest supported effort at or below the requested level. Record the substitution in the result table. Do not look for a global pstack configuration.

When a worker must start from a non-default branch, create its worktree or session from that branch explicitly.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence.

If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

Read the terminal results. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

Keep a compact result table, one-line evidenced issues, and explicit gaps or dropouts.

## Phase D: Report

Return one consolidated in-chat report with the table, issue one-liners, gaps or dropouts, and the race rule when used.
