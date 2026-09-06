# Workbench implementation board

## Current inventory — 2026-09-06

**Focused Tier 1 authorized by Kirk; development continues on macOS.**
Current slice: typed ORM and local schema migrations for the merged registry/CLI,
not an execution broker, worker, UI or workflow engine. Bundle/distribution work is deferred, not a product prerequisite.
Merged baseline: `a8b4e4dfb3086e081e5cca6c343661aaabc6e24b` (PRs #1–#3, #6, #7,
ESLint #8 via #9, inventory verifier #10, dependency planner #11 and registry #12). PR #5 was
superseded/closed. The #8/#9 stack is
fully reconciled; no formatting/lint increment remains waiting on an old base.

Native OpenShell diagnostic execution works on Fedora x86_64/KVM and macOS
arm64/Hypervisor.framework. Kirk accepted **Landlock unavailability and raw-stop
persistence issues**; see [ACCEPTED-RUNTIME-LIMITATIONS.md](ACCEPTED-RUNTIME-LIMITATIONS.md).
The observed failures remain in evidence, not rewritten as passes. Remaining
resource and credential/boundary qualification does not permit untrusted workers.

| ID / tier | Outcome | State | Evidence / next action |
|---|---|---|---|
| T0-01 / 0 | Pinned Corepack/pnpm TypeScript monorepo and dependency policy | merged, #1 | Exact versions, frozen/no-script installs, source/age/integrity/audit gates; maintain pins |
| T0-02 / 0 | Preserve/exercise upstream attribution | merged, #1 | Hash checks and real-session commit/push/intentional-refusal fixtures; preserve identity/hooks |
| T0-03 / 0 | Hosted foundation and forge gates | merged | PR/merge-group workflow; #12 run 34043738163 passed; personal-owner merge queue unsupported, not tested |
| T0-04 / 0 | Native OpenShell diagnostics on Fedora and Mac | merged, #2/#3/#6 | Real VM + mTLS exec + workspace write + cooperative checkpoint/restart; not worker qualification |
| T0-05 / 0 | Worker resource and credential/boundary qualification | blocked | Guest PID budget absent; broad credential/network conformance and in-VM development userspace unverified; two scoped limitations accepted, not blanket waiver |
| T0-06 / 0 | Foundation review and scope transition | accepted for focused Tier 1 | Kirk explicitly authorized Tier 1 after foundation merges; this does not turn T0-05 gaps into passes or admit workers |
| T0-07 / 0 | Partial-staging-safe formatting hook | merged, #7 | Installed locally; Biome index-blob check chained through untouched attribution; real-session tests passed |
| T0-08 / 0 | Root ESLint policy/declaration spacing | merged, #8 via #9 | Five regression tests; Biome formatting + JS/TS recommended rules; compiler 7.0.2 with isolated supported parser dependency 6.0.3 |
| T0-09 / 0 | Offline bundle content inventory/verification | merged, #10 | Canonical metadata, external expected digest/platform, exact bytes/modes, bounded scans and rejection fixtures; no installer or payload execution |
| T0-10a / 0 | Locked bundle dependency plan | merged, #11 | 13 tests; metadata graph only, no assembly/SBOM claim; not a prerequisite to core product behavior |
| Deferred | Self-contained bundle builder and managed installation/updates | deferred | Distribution/enrollment requirements retained; no further bundle iteration on the current critical path |
| CORE-001a / 1 | Persistent local Work/Workspace registry, context and CLI | merged, #12 | Stable IDs, two worktrees, reopen/drift/profile/concurrent-client tests; Commander/simple-git; package README and opt-in Pi skill |
| CORE-001a.orm / 1 | Typed SQLite ORM and schema migrations | candidate, this increment | Drizzle queries/inferred rows, preserved schema-1 data, atomic upgrade/journal checks and regression tests; backup/transfer/JJ/Gerrit documented, not implemented |
| DEV-001 / tooling | Scoped post-turn checks with direct model feedback | requested next, not active | [Lightweight Pi extension contract](POST-TURN-CHECKS.md); coalesced checks plus TypeScript-first LSP diagnostics, bounded repair feedback, no auto-install/reload or replacement of CI |
| CORE-001a.1 / 1 | Project/Work/goals/tasks/thread and optional checkout-set contracts | next design consumer | [Work and resumption](WORK-AND-RESUMPTION.md); explicit migrations/fixtures, no live sessions, scheduler or Repo adapter |
| CORE-001b / 1 | Typed prepared actions and fixture policy/approval binding | pending | Use pinned Pi ecosystem schema conventions; altered/expired approvals and invalid context must fail |
| CORE-001c / 1 | Fake-provider run state and bounded artifacts | pending | Duplicate-request reconciliation, output bounds and revision-bound evidence; no actual worker |
| CORE-001d / 1 | Tier 1 review gate | pending | Registry alone is not full Tier 1 acceptance; stop for Kirk before Tier 2 execution |

## Native evidence and accepted limitations

| Host | Tested runtime | Evidence |
|---|---|---|
| Fedora Linux x86_64 | OpenShell 0.0.116, native libkrun/KVM | [Native spike](NATIVE-RUNTIME-SPIKE.md), [bound evidence](evidence/native-spike.txt) |
| macOS Apple Silicon | Stable 0.0.116 and rolling 0.0.117-dev.82+gb9c7d5c70, native libkrun/Hypervisor.framework | [Mac E2E](MACOS-E2E.md), tested helper `bf4a177bb407642b6e452937d687971a36285d96` |

Mac gateway-child umask 022 permits overlay traversal; outer host state/keys stay
0700/0600. Raw stop does not guarantee writes survive. Cooperative sync-stop and
marker verification are the tested path, not atomic/crash-safe persistence. Strict
Landlock startup still stalls; do not claim a supported strict profile or silent
fallback. No custom kernel/OpenShell patch or container replacement was introduced.
Disposable native probes and synthetic PKI were cleaned up; no new native run is
claimed by this inventory increment. [FEDORA-HANDOFF.md](FEDORA-HANDOFF.md) remains
future reference, not a host migration instruction.

## Remote/bootstrap inventory

The approved read-only Mac → `kirk@kirk-pc` SSH probe reached Fedora, reporting
`Linux 7.1.13-200.fc44.x86_64 x86_64`, UID 1000. This is reachability/execution only,
not host enrollment, selected-key lifecycle qualification or remote Pi control.
A source-based development install can be attempted on a concretely approved target
without first building a fully offline bundle; it still needs target-side testing.

[REMOTE-BOOTSTRAP.md](REMOTE-BOOTSTRAP.md) records new-host/account/profile/key
approval, complete platform bundles, scoped automatic extension updates, offline
verification and safe activation/rollback requirements. [BUNDLE-INVENTORY.md](BUNDLE-INVENTORY.md)
defines the first content-checking primitive; [BUNDLE-PLAN.md](BUNDLE-PLAN.md)
adds a lock-graph projection for Pi and declared foundation-tooling dependencies.
Darwin selects 129 snapshots, Linux 128, including native platform packages. Neither
a content inventory nor a lock projection proves a complete runtime SBOM, publisher
trust, native-library closure or approval. Real bundle assembly remains pending.

## Review/evidence discipline

- [REVIEW-HANDOFF.md](REVIEW-HANDOFF.md) binds the merged baseline and identifies
  this candidate's reproduction commands and outstanding tests.
- Keep current source and configuration hashes with each local/hosted result.
  A successful prior run does not validate later source or qualify another runtime.
- No real corporate registry/CA/provider enrollment. Existing JFrog/Curation and
  certificate-only validation uses synthetic fixtures; real transport is unverified.
- No GitHub Project enrollment/synchronization: existing token lacks Projects scope.
  This board is the explicit lightweight ledger, not a live GitHub adapter.
- Prior Fedora/Mac increment tracking is retained in Git history and linked runtime
  evidence. This snapshot supersedes stale branch/main/PR status in older handoffs.
- Stop at Kirk's review/merge gate. For future stacks, retarget/rebase upper layers
  against actual merged main **before** merging them; observe source-tree identity
  and run fresh CI. Neither a merge nor a model review waives remaining predicates.
