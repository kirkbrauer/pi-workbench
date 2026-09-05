# Tier 0 board

Current tier: **0 — active, NOT accepted**. No dependent tier starts before
Kirk's explicit GitHub tier review and approved merged base. This checked-in
board is the bootstrap planning view, not a workflow engine or live Project sync.

| ID / tier | Outcome | Dependencies | State | Branch / PR | Acceptance / evidence | Next action |
|---|---|---|---|---|---|---|
| T0-01 / 0 | Repository and exact toolchain | — | active | feat/t0-foundation / pending | Locked clean install, lint/type/behavior checks; review handoff | Publish/check clean candidate |
| T0-02 / 0 | Preserve and exercise attribution | T0-01 | active | feat/t0-foundation / pending | Installed hook hashes; positive commit/push and two negative paths passed locally | Bind rerun to committed SHA |
| T0-03 / 0 | CI and supported forge gates | T0-01 | active | feat/t0-foundation / pending | PR and merge-group workflow; actual CI pending; personal-owner queue unavailable | Observe Actions, resolve review identity/protection |
| T0-04 / 0 | Native Fedora OpenShell VM | T0-01 | blocked | feat/t0-runtime-preflight / planned | No native boot; missing KVM access and runtime install; pinned upstream inspection | Review scoped installation/network prerequisites |
| T0-05 / 0 | Boundary, bounded resources, lifecycle | T0-04 | blocked | feat/t0-runtime-preflight / planned | Host/credential/network denial + allowed operation; CPU/memory/PIDs, stop/start and cleanup all required | Real synthetic VM tests after prerequisite resolution |
| T0-06 / 0 | Review package and accepted base | T0-01–05 | blocked | Tier 0 stack | Exact SHA/config/image evidence + Kirk review + observed merge; all required | Submit partial increment, retain blockers |

No item is done merely because it has a branch, passing model review or queued PR.
No Issues/Project mapping exists yet; see `FORGE.md` for the integration gap.
