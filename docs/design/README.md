# Versioned design baseline 1.27

The Markdown handoff was imported verbatim from Kirk's selected handoff bundle
on 2026-09-05. `HANDOFF-MARKDOWN-SHA256SUMS` records the original bytes. Future
reviewed design changes should deliberately update the documents; the manifest
continues to identify the import baseline, not certify later edits.

Start with `START-HERE.md`, `CURRENT-STATE.md`, `FIRST-MILESTONE.md`, and
`IMPLEMENTATION-TIERS.md`. `DESIGN.md` is the architecture; `BOOTSTRAP.md` supplies
technical sequencing. Historical statements such as “no repository selected”
describe the handoff, not today's implementation.

Active implementation status, repository selection, attribution policy, package
manager and evidence are in `../../README.md`, `../../AGENTS.md`, `../BOARD.md`,
`../FORGE.md`, and `../REVIEW-HANDOFF.md`. Current user decisions select a pnpm /
Corepack TypeScript monorepo. The installed hooks use actual Pi session metadata;
legacy Codex co-author examples must not invent assistance by another harness.

The mockup and mockup-source are intentionally not imported as implementation
packages. Links to those assets in the original documents refer to the separate
handoff bundle. All mockup integrations/actions are simulated. Nothing in the
illustrative workflow YAML is an executable engine.
