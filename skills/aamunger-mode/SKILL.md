---
name: aamunger-mode
description: "Use only for /aamunger-mode or an explicit request to apply Aaron Munger's engineering workflow to the current task."
disable-model-invocation: true
---

# Aamunger mode

Apply this mode only for the current conversation after explicit invocation. Existing user, repository, and plugin instructions remain authoritative.

## Work from evidence

- Investigate logs, traces, errors, and runtime output before trying speculative fixes.
- Reproduce a defect before changing code when a practical reproduction path exists.
- Fix warnings rather than suppressing or ignoring them.
- Never change a timeout value without asking the user first. Treat the current value as intentional until evidence proves otherwise.
- If you add a safeguard, verify that the safeguard handles the observed failure. Do not add defensive complexity without proof.

## Choose the smallest workflow that fits

- Use direct repository tools for narrow questions and small changes.
- Use `/how` before changing an unfamiliar subsystem or when ownership and runtime flow are unclear.
- Use `/tdd` for a bug with a cheap, reliable local test path.
- Use `/architect` when a change crosses meaningful function, module, or ownership boundaries.
- Use `/arena` only when at least two materially different implementations or designs are plausible.
- Use `/interrogate` for an important diff, a contested design, or a change where independent reviewers are likely to find different bugs.
- Use `/swarm` only for disjoint slices or an explicitly requested race. Never let concurrent workers write to the same checkout.
- Use a project verification skill when one exists. Offer `/create-verification-skill` when the project lacks a repeatable way to exercise real behavior.

Do not fan out because a task is merely large. Delegate when independent context, model diversity, or parallel coverage will improve the result.

## Make changes

- Read enough context to fix the root cause without rewriting unrelated code.
- Reuse existing helpers, types, and patterns before adding new ones.
- Keep type safety. Do not bypass it with broad casts or suppressions.
- Preserve unrelated work in dirty trees.
- Do not use destructive git commands to make the checkout convenient.

## Ask only when the user owns the decision

Proceed with reversible engineering decisions when repository evidence supports one answer. Use `ask_user` for product behavior, meaningful scope choices, timeout changes, irreversible actions, or conflicting requirements.

## Validate and report

- Verify the requested outcome, not a proxy for it.
- Run independent slow checks in background tasks when they can execute safely in parallel.
- Report validation results when they finish. Fix isolated failures. Stop for guidance when the failure needs a product or design decision.
- Do not declare the task complete until the result is persistent and verified.

## Git and pull requests

- Never disable commit signing. Sign commits.
- Follow the active pull-request description, readiness, and comment-response instructions.
- Keep draft creation separate from review readiness.
- Do not commit or open a pull request unless the user asks or an active workflow explicitly requires it.
