# Tier 0 review handoff — foundation increment (PR #1)

## Outcome

- Intended outcome: a reproducible **pnpm/Corepack TypeScript monorepo**, versioned
  design baseline, supply-chain gates and preserved attribution. Not completed Tier 0.
- Changed: `packages/tooling` implements real checks/tests; exact tools/lock; frozen
  no-script installation; source/integrity/age/provenance checks; Actions audit;
  original handoff Markdown imported under `docs/design/` with source checksums.
- Inspect closely: supply-chain policy and Node-types override; Corepack pin and
  candidate-SHA CI permissions; hook fixture identity and historical-vs-current docs.

## Revisions and dependencies

- Repository: https://github.com/kirkbrauer/pi-workbench
- Initial PR: https://github.com/kirkbrauer/pi-workbench/pull/1 (`feat/t0-foundation`).
- Previous base: empty `0d3af964e9131d4a8cbabaade0fde573f053db28`; no accepted tier.
- The initial npm revision `d5161da40f888aec82d6560783ff5e53696b8b58` passed
  [Actions 33997825483](https://github.com/kirkbrauer/pi-workbench/actions/runs/33997825483)
  on tested merge `b6cc504411b0ab8ea72033d70a8ccd795db23dc5`.
  **That run does not validate the subsequent pnpm changes.** Current exact SHA,
  clean-install results and new run links are attached to the PR after commit.
- Inputs: Node 22.23.2, Corepack 0.34.6, pnpm 11.25.0 + integrity, Pi 0.85.0,
  Biome 2.5.12, TypeScript 7.0.2; `config/foundation.json`, `pnpm-lock.yaml`.
- Toolchain base linux/amd64 image:
  `docker.io/library/node@sha256:4d676821dff059fd00d277ee4261ef34ea712317fed0737c03941481b5760c96`.
- Follow-up: native-runtime/image/preflight PR, stacked inside Tier 0.

## Verification

| Predicate | Check | Result / remaining gap |
|---|---|---|
| Reproducible setup | Corepack + frozen pnpm + `pnpm check` | Working-tree checks passed in bounded rootless container; final clean SHA rerun required |
| Real tooling behavior | 7 unit tests | Source confusion/alternate URLs, policy weakening, missing DCO rejected; positive controls pass |
| Supply-chain observations | `pnpm audit --audit-level high` | No known vulnerabilities in current lock at investigation time; final CI audit required; not proof of no malware |
| Hook integration | upstream 4b7d05e, pinned executable hashes | Attributed commit/local push + agent-deny and chained hook denial passed; repeat for final candidate |
| PR CI | `foundation-checks` | Initial npm run passed; final pnpm run pending |
| Queue | API + GitHub availability docs | Personal owner is ineligible; no queue configured/run |
| Native VM | OpenShell 0.0.116, explicit VM required | Not boot-tested; Kirk granted temporary KVM ACL, now readable/writable |
| Boundary/resources/lifecycle | Synthetic real-VM conformance | Unknown, mandatory, blocking |
| Recovery | README + upcoming runtime instructions | Foundation recovery provided; native VM recovery untested |
| Human acceptance | Kirk's GitHub decision + observed accepted merge | Pending; Tier 1 remains blocked |

## Operational impact

- Public repository and empty base created as authorized. Existing global hooks,
  Git identity, host Pi/Node, SELinux, firewalld, networking and workloads preserved.
- Rootless Node toolchain images/dependency cache created. Temporary container has
  only this selected checkout, read-only root, non-root user, dropped capabilities,
  no-new-privileges, bounded scratch and requested 2 CPU/2 GiB/256 PID limits.
  This is not native VM conformance. No host home, keyring, auth, SSH or engine
  socket is mounted; environment credentials are not inherited.
- Trusted personal gh/keyring identity is used only for publication/metadata.
  No real Codex credentials enrolled or shared. Temporary helpers/cache live in
  ignored `.local/`; downloads under `/tmp` were inspected, not RPM-installed.
- Preserve source when recreating ignored dependencies. Investigate security-check
  failures rather than exceptions. Do not delete existing host workloads/tools or
  replace attribution hooks as recovery.

## Review / next action

Kirk review pending. No enqueue/merge authorized or performed. Resolve native VM
boundary and lifecycle predicates in the next Tier 0 increment. Select a Project
and scoped board integration; current lightweight board is `BOARD.md`. See
`FORGE.md` for required-check and distinct reviewer-identity constraints. Resume
with `git status`, the PR's actual head/runs and the pinned development commands.
