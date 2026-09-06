# GitHub bootstrap state

Repository: https://github.com/kirkbrauer/pi-workbench (public, personal `User`
owner). Initial empty base `0d3af96`; Kirk merged PR #1 on 2026-09-05 as
`6969178d25bb5078da66d688668758a672869a03`. Source matches tested `acda428`.
No agent merge/enqueue was performed. Remaining Tier 0 work uses this merged base.

## Actual checks/protection

`foundation-checks` passed on PR #1 in Actions **33998468742**, testing GitHub's
merge SHA `5618907f103d6c447b96b8e5b0ba0d4a6e9f6844`. It uses pinned actions,
Node/Corepack + integrity-pinned pnpm, frozen no-script install, TypeScript
workspace build/lint/type/tests, source/integrity policy and high/critical audit.
Hosted ephemeral runners only; read-only permissions; no secrets or persisted
checkout credentials, package cache, `pull_request_target`, or workstation runner.

After observing the actual check/app ID, main was protected with:

- Required `foundation-checks` from GitHub Actions (app 15368), strict/up-to-date.
- Pull requests, resolved conversations, admin enforcement; no force push/deletion.
- Initially one independent review + latest-push approval; **removed at Kirk's
  request** because agent publication and human review use the same GitHub account.
  Current required approval count is **0**, latest-push approval is **false**.

Kirk records explicit review/acceptance on GitHub and controls merging. CI is
server-enforced, but the human tier-review gate is **not independently enforceable
with this single shared identity**. A distinct trusted agent publishing identity
is a future enrollment decision, not permission to impersonate a reviewer.
Never have the agent publish a human approval or bypass an existing check.

Current repository merge preferences were changed by Kirk to **squash only**.
Do not reset them. The observed #1 squash preserved assistance messages in its
body and Kirk's final DCO trailer; local hooks did not run server-side. The initial
merge-commit preference is superseded. Inspect future squash messages deliberately
rather than assuming exact per-commit assistance trailers survive every merge.

## Queue and stacks

GitHub's current [merge queue availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
requires organization ownership for public repositories. This personal repo is
ineligible, and GraphQL returned `mergeQueue: null`. No queue was enabled or run.
The workflow includes `merge_group: checks_requested` and tests its supplied SHA;
that is compatibility preparation, not evidence of queue execution.

`github/gh-stack` v0.1.0 is installed; repository stack behavior remains untested.
PR #1 merged before the follow-up, so the remaining feature branch was restacked
onto its actual squash base. No hosted stack service or atomic-stack assumption.
Future concurrent layers can use explicit branch-chain PRs until native stack
support is verified. Rewritten heads require fresh tests/evidence/review.

Use `docs/BOARD.md` until a Project and separately scoped integration are selected.
The personal gh login remains keyring-backed and outside workers. No privileged
metadata workflow, auth-copy flow or board service is introduced.
