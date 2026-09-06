# Tier 0 board

Current tier: **0 — partially merged, NOT accepted for untrusted workers**.
Kirk merged foundation PR #1 on 2026-09-05 as
`6969178d25bb5078da66d688668758a672869a03` (squash, same source tree as tested
`acda428`). The remaining work starts from that observed merged base. No Tier 1.

| ID / tier | Outcome | Dependencies | State | Branch / PR | Acceptance / evidence | Next action |
|---|---|---|---|---|---|---|
| T0-01 / 0 | Corepack/pnpm TypeScript monorepo | — | done | #1 merged | Clean clone + 7 tests + audit + Actions 33998468742 on merge 5618907; source acda428 | Maintain pins; image/registry follow-up |
| T0-02 / 0 | Preserve and exercise attribution | T0-01 | done | #1 merged | Pinned hook hashes; attributed commit/push; agent-deny and chained-hook denial passed at acda428 | Preserve real identity; inspect squash metadata differences |
| T0-03 / 0 | CI and supported forge gates | T0-01 | review | feat/t0-runtime-preflight / follow-up | Main requires foundation-checks/up-to-date PR; self-approval conflict resolved as requested; queue unsupported | Review updated Actions/evidence; human gate is explicit, not server-attested |
| T0-04 / 0 | Native Fedora OpenShell VM + development image | T0-01 | review | feat/t0-runtime-preflight / follow-up | Real native 0.0.116 boot/exec via mTLS, explicit VM, guest 6.12.76; toolchain-image build needs exact artifact evidence | Review setup and failure findings; no untrusted worker |
| T0-05 / 0 | Boundary, bounded resources, lifecycle | T0-04 | blocked | feat/t0-runtime-preflight / follow-up | Guest PID limit absent; Landlock unavailable; marker lost on restart; network/corporate CA tests unknown | Investigate upstream/runtime gaps in a separately bounded follow-up, without weakening predicates |
| T0-06 / 0 | Tier acceptance and recovery | T0-01–05 | blocked | Tier 0 | Foundation human merge observed, but mandatory sandbox predicates fail | Review follow-up; do not unlock Tier 1 |

## Scoped discoveries

- JFrog/Curation profile planning + certificate-only validation implemented with
  synthetic fixtures. Real mirror admission, credential delivery and corporate CA
  integration remain unverified; endpoint/enrollment/test flow needed privately.
- Existing token lacks Projects scope; no Project selected. This board remains the
  lightweight source, with no invented Issue/Project synchronization.
- Native experiment cleaned up its sandbox/overlay and transient service. Host
  security/workloads remain unchanged; temporary KVM ACL was supplied by Kirk.

Task completion does not imply tier acceptance. Missing/failed/stale evidence and
model reviews cannot waive safety or human review predicates.
