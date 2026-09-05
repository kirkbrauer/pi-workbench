# First milestone: a reviewable development foundation

Scope: Tier 0 only. This document makes IMPLEMENTATION-TIERS.md actionable; that plan governs tier boundaries.

## Work order

1. **Select and inspect the repository.** Read its instructions, preserve local changes, identify the forge and verify feature-branch/attribution requirements. Record exact Pi, package-manager, Node, OpenShell and host versions. Separate observed facts from desired versions.
2. **Establish the smallest toolchain.** Choose the package layout from DESIGN.md, pin dependencies and lockfiles, implement lint/type commands and document clean-clone setup. Add executable behavior tests only as corresponding behavior appears.
3. **Establish deterministic gates.** Use the existing attribution-hook installation mechanism and test its intended accept/reject paths in a disposable repository. Add minimally privileged GitHub Actions on PR and merge-group events. Never run untrusted PR code on a persistent credential-bearing workstation runner.
4. **Verify native Fedora MicroVM.** Inspect a pinned OpenShell release and its VM dependencies. Explicitly select the VM driver. Prepare concrete scoped installation/configuration changes, apply within existing authority, and verify host networking without disabling firewalld/SELinux. No Kind deployment. Record guest identity, gateway execution, image provenance, storage and teardown.
5. **Publish evidence for review.** Prepare small stacked PRs and a tier acceptance record. Verify CI runs on the actual revisions and merge-queue configuration is supported. Wait for Kirk's review and the merged foundation before Tier 1 implementation.

Do independent repository/toolchain work while a genuine runtime prerequisite is unresolved. Do not mark Tier 0 complete or substitute shared-kernel execution to hide a VM blocker.

## Acceptance record

| Predicate | Required evidence |
|---|---|
| Clean-clone setup is reproducible | Pinned versions, lockfile, setup command and exit result from a clean checkout. |
| Hooks enforce attribution | Successful legitimate commit path and intended rejection cases; no skipped hooks. |
| CI gates execute | PR run IDs/SHAs and merge-group compatibility; distinguish workflow inspection from an actual queue run. |
| Native VM really runs | Explicit driver configuration, runtime identity, distinct guest kernel/boot evidence and successful OpenShell command execution. |
| Workspace boundary is enforced | Expected denial of host paths/credentials and prohibited network routes using synthetic fixtures; an allowed operation also succeeds. |
| Resources and lifecycle are bounded | Observed memory/CPU/PID limits, stop/start persistence and disposable-workspace cleanup tests. Document unsupported controls as blockers. |
| Recovery is usable | Restart/reconnect procedure, failure diagnostics and rollback instructions. |
| Human review is complete | Kirk's review and merged base; agent assertions cannot satisfy this predicate. |

Evidence must include source revision, image digest, runtime version/configuration fingerprint and test outcome. Keep secrets, private keys, auth caches and kubeconfigs out of attachments. A failed diagnostic that discovers an invariant is useful evidence; it is not a passing gate.

## Minimal task board

Begin with a small repository document or structured file. Use GitHub Issues/Projects when the repository and authorized integration are available. Do not build a board service before building the worker.

Seed items: `T0-01 repository/toolchain`, `T0-02 attribution hooks`, `T0-03 CI/queue checks`, `T0-04 native VM setup`, `T0-05 isolation/lifecycle checks`, `T0-06 review package`.

Each item records ID, tier, outcome, dependencies, state, current branch/PR, acceptance predicates, evidence and the next action. Suggested states: ready, active, blocked, review, done. A discovered subtask remains inside its parent's scope and budget. Mark done only after its acceptance evidence exists; tier completion additionally needs Kirk's review.

Use ordinary scripts and persisted records initially. Later workflow loops may propose tasks and bounded retries, but cannot change permissions, acceptance predicates or tier boundaries to keep themselves running.

## Follow-on tiers

After Tier 0 merges: Tier 1 introduces contracts, registry and fake providers; Tier 2 connects one real sandboxed Pi worker for an inspect/edit/test/repair task. Full TUI, dynamic workflow engine, remote placements and team distribution follow the existing plan. Testing extensions in child Pi instances and controlled promotion belong to their authorized later tier.
