# Tier 0 review handoff — foundation increment

## Outcome

- Intended outcome: reproducible repository checks and preserved attribution;
  foundation only, not a completed Tier 0 sandbox.
- Changed: pinned Node/npm/Pi/lint/type tools, lockfile, a compiled TypeScript tooling workspace,
  DCO behavior tests, installed-hook exercise and hosted PR/merge-group workflow.
- Inspect closely: hook identity preservation and fixtures; workflow permissions
  and candidate SHA selection; old-but-exact initial dependency pins.

## Revisions and dependencies

- Repository: https://github.com/kirkbrauer/pi-workbench
- Feature branch: `feat/t0-foundation`; PR/revision/run links will be recorded on
  the published PR. This document does not self-certify its containing SHA.
- Stack: foundation, then runtime/image/preflight increment, both Tier 0.
- Previous base: empty `0d3af96`; no accepted tier exists.
- Tool/config pins: `config/foundation.json`, `package-lock.json`. VM/image
  acceptance evidence does not yet exist.

## Verification

| Predicate | Check | Revision/configuration | Result / gap |
|---|---|---|---|
| Toolchain reproducible | `npm ci`, `npm run check` | exact pins/lock, current working tree | Local install in bounded rootless Node container and checks passed; clean candidate rerun pending |
| Hooks enforce policy | `npm run test:hooks` | upstream 4b7d05e + pinned hook hashes | Attributed commit, local feature push, agent-deny push, chained rejecting project hook passed; fixtures removed |
| CI executes | `foundation-checks` | actual PR merge SHA required | Workflow prepared; live run pending |
| Merge queue | API + GitHub availability docs | personal User owner | Unsupported here; no queue configured/run |
| Native VM executes | native OpenShell 0.0.116 | not installed/on PATH | Blocked; no VM evidence |
| Boundary / resources / persistence | real synthetic runtime tests | no VM configuration yet | Unknown, mandatory and blocking |
| Recovery | README | foundation only | No services installed; VM recovery untested |
| Human tier acceptance | Kirk's GitHub decision + merged base | absent | Blocked |

## Operational impact

- Created the public repository and empty base as authorized; no infrastructure
  settings changed. Pulled the official Node toolchain image into rootless Podman
  cache; dependency install mounted only this selected checkout with private
  SELinux labeling, no host home/env credentials/sockets. Temporary container
  removed. Downloaded OpenShell RPM/reference files for inspection under `/tmp`;
  queried package metadata, did not install it.
- Personal Git/GitHub identity used only for trusted publication/metadata.
  No Codex/model credentials enrolled, shared, copied or sent to a worker.
- Toolchain container was non-root, read-only root, 2 CPUs/2 GiB/256 PIDs requested;
  this is **not** verified native VM isolation or resource evidence.
- Recovery: retain source, reinstall locked dependencies; do not remove existing
  workloads, disable host security or replace hooks. Runtime follow-up will record
  exact bounded cleanup before any native launch.

## Review / next action

Kirk's review: pending. Merge/queue: not requested. Stay in Tier 0.
Resolve VM installation/network authority, required checks/reviewer identity and
board integration. Tier 1 remains blocked even if this individual PR merges.
Resume with `git status`, `docs/BOARD.md`, PR runs and `npm run check`.
