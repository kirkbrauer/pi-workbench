# GitHub bootstrap observations

Repository: https://github.com/kirkbrauer/pi-workbench (public, personal `User`
owner), created with Kirk's authorization on 2026-09-05. `main` initially contains
only the empty hook-attributed review-base commit `0d3af96`. Implementation goes
through feature PRs. No merge is authorized by this document.

## Checks and queue

Initial API observations: viewer ADMIN, no rulesets, branch protection 404, and
GraphQL `mergeQueue: null`. GitHub's current [merge queue availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
requires an **organization-owned** public repo (or an eligible Enterprise private
org repo). This personal repository is not eligible. Do not attempt to enable a
queue, claim a queue run, or transfer ownership without Kirk's decision.

The stable proposed required check is `foundation-checks`. It runs on
`pull_request` and `merge_group: checks_requested`, checks out the supplied merge
revision, activates integrity-pinned pnpm through Corepack, installs frozen no-script
dependencies, checks TypeScript workspaces/source policy/candidate-range DCO,
and blocks known high/critical dependency advisories.
Hosted ephemeral runners only; no persistent workstation runner. No secrets,
write token, `pull_request_target`, dependency scripts or credential caching.
The check implementation is candidate code: human review of gate changes remains
mandatory. It is not an independent trusted completion checker.

After a real run reports the check name, configure only supported main protection:
strict up-to-date checks, no force push/deletion, required review and no bypass.
This is proposed, not yet configured. GitHub does not let PR authors approve their
own PR: these agent-published PRs use Kirk's account. Kirk must record his explicit
review on GitHub, and choose an independent publishing/review identity for
server-enforced approvals. Never impersonate an independent reviewer or bypass a
review rule. A trailer, token identity, model review or comment by the agent cannot
stand in for Kirk's decision.

Prefer **merge commits**, preserving each hook-generated author/assistance/DCO
message. The upstream hooks and CI exclude merge commits from DCO checks.
Server squash/rebase does not run local hooks; do not enable it as a tested
attribution path. The eventual real merge still needs observed evidence.

## Stacks and board

Installed `github/gh-stack` is v0.1.0; installation alone is not verified repository
stack support. Until established, use transparent branch-chain PRs:
`main <- feat/t0-foundation <- feat/t0-runtime-preflight`. No hosted stack service.
After the lower PR merges, fetch its actual merged base, restack the upper branch
using ordinary Git, inspect attribution and rerun checks. If rewriting is needed,
push with lease through hooks and refresh review/evidence. Never assume atomic
stack landing.

Use `docs/BOARD.md` while a GitHub Project and its scoped integration are not
selected. Existing trusted gh login is personal and keyring-backed; its observed
scopes do not include Projects access. No worker receives it. No board service or
privileged metadata workflow is introduced. Issue/Project synchronization needs a
selected Project and separately authorized credentials; absence is a tracked gap,
not a fake successful sync.
