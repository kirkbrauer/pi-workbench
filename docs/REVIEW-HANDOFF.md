# Tier 0 follow-up review handoff

## Current handoff: native diagnostics work on Fedora and macOS

**Continue working on macOS** per Kirk's latest direction. The prepared
[FEDORA-HANDOFF.md](FEDORA-HANDOFF.md) is for a possible later return, not an
active host migration. Both native legs now demonstrate authenticated exec, workspace writes, cooperative
checkpoint/restart and cleanup using synthetic data. Mac stable **0.0.116** and
rolling **0.0.117-dev.82+gb9c7d5c70** passed that diagnostic sequence at
`bf4a177bb407642b6e452937d687971a36285d96`; see [MACOS-E2E.md](MACOS-E2E.md)
and [bound evidence](evidence/macos-e2e.txt).

The Mac helper's inherited umask made the guest overlay root 0700/host-owned.
Child-only 022 fixes traversability while outer host state and keys stay private.
OpenShell remains unmodified except upstream's documented disposable-driver
Hypervisor signing. Rolling alone did not fix startup; stable works too.
Landlock ENOSYS (Mac), missing guest PID budget, raw-stop data loss and strict
Provisioning timeout remain. No Tier 1 or untrusted-worker acceptance.

Fetched main is `18eb784274d82dbaf668274a5be4558356c5036d` (PRs #1–#3 merged).
Mac work is on `feat/t0-macos-native-preflight`; preserve attribution hooks and
human review. Mac gateways/VMs/overlays/PKI/DB are removed. Do not transfer `.local/`
or apply Mac host setup to Fedora. Nine Mac helper tests, foundation checks/audit
and real-session hook tests passed; Fedora-only helper tests need their Linux
boundary. No new hosted CI/clean-clone result or full tier acceptance is claimed.

## Prior stacked follow-up: native best effort (historical)

Branch `feat/t0-native-runtime-spike` depends on open PR #2 at `ac96b2b`. Kirk
explicitly requested **no changes to OpenShell**, then best effort within that
constraint. Review [NATIVE-RUNTIME-SPIKE.md](NATIVE-RUNTIME-SPIKE.md),
`config/native-diagnostic-policy.yaml`, and `scripts/native-probe.sh` closely:
filesystem/PID limitations remain, checkpoint-stop is cooperative rather than
atomic, and strict startup times out in Provisioning. Original failure predicates
are retained. No privileged host changes, custom runtime or backend substitution.

Local verification: 10 TypeScript tests, three fake-CLI helper tests, syntax,
lint/type/build/policy, hook hashes and audit passed. Native marker checkpoint
passed, raw stop/PID checks still failed, and limited network denial was observed.
Both disposable VMs and synthetic PKI were removed, service inactive. Exact
helper/policy/config hashes and outputs are in `evidence/native-spike.txt`; PR
publication/CI result follows the committed candidate. Full Tier 0 stays blocked.

## Prior PR #2 outcome

- Remaining Tier 0 only: registry/CA planning, reusable setup/diagnostic helpers,
  reproducible toolchain image and honest native-VM acceptance evidence.
- Added a typed operator-owned JFrog/Curation plan interface and certificate-only
  validation. No real mirror/account enrollment or unverified CA transport claim.
- Native OpenShell boots/executes, but PID, Landlock and persistence predicates
  fail. The profile is NOT admitted for untrusted workers. Kirk accepted stopping
  this investigation for now; no Tier 1 work started.
- Inspect closely: `NATIVE-VM.md` failure evidence and cleanup; registry/CA trust
  separation; image build context/no credentials; single-account review limits.

## Revisions / dependencies

- Repo: https://github.com/kirkbrauer/pi-workbench
- Branch: `feat/t0-runtime-preflight`; follow-up PR published after committed checks.
- Base: Kirk's #1 squash `6969178d25bb5078da66d688668758a672869a03` (same source tree
  as `acda42805f3633c2de7fd10a9900a16b7420db3d`). No accepted worker tier exists.
- Initial Actions evidence: [33998468742](https://github.com/kirkbrauer/pi-workbench/actions/runs/33998468742),
  tested merge `5618907f103d6c447b96b8e5b0ba0d4a6e9f6844`. New follow-up needs its
  own run and clean-clone/image evidence, attached to the PR after commit.
- Runtime/image/config/script hashes and exact guest identity: `NATIVE-VM.md`.
- Toolchain inputs: `config/foundation.json`, `pnpm-lock.yaml`, `dev/Containerfile`.
  Actual image IDs are recorded by the builder, not invented in this document.

## Verification

| Predicate | Evidence / command | Result or gap |
|---|---|---|
| Clean monorepo setup | `scripts/toolchain.sh`, frozen pnpm, check | 10 focused tests/lint/type/build/policy checks passed in bounded toolchain; final committed clone rerun required |
| Dependency advisories | `pnpm audit --audit-level high` | No known vulnerabilities at latest local check; CI must repeat; no malware-free claim |
| Attribution | hook hashes + disposable commit/push/rejection tests | Passed for merged foundation; preserve on follow-up |
| Toolchain image | `scripts/build-dev-image.sh` | Exact snapshot/digest build and offline run; result attached after candidate commit |
| PR / merge-group checks | `foundation-checks` | First PR passed; follow-up pending; merge queue unsupported, not executed |
| Native VM execution | explicit VM + mTLS + distinct kernel/boot ID | PASS for diagnostic, not worker admission |
| Host fixture/home/socket path denial | `native-guest-boundary.txt` | Narrow checks pass with allowed workspace write; broader boundary unknown |
| Landlock / guest PID budget | console warning + boundary exit 1 | FAIL; no guest PID enforcement; Landlock unavailable |
| Stop/start persistence | `native-guest-restart.txt` | FAIL; marker missing. Guest boot changed; exit 0 of final command does not waive failed marker assertion |
| Network / corporate CA / Curation | `REGISTRIES-AND-CA.md` | Required qualification missing; no real endpoint or credentials supplied |
| Cleanup/recovery | isolated sandbox delete + transient service stop | Sandbox overlay removed, service inactive; host security preserved |
| Human tier acceptance | actual reviewed/merged base + all predicates | Foundation merge observed; full Tier 0 remains blocked |

## Operational impact

Only public repo metadata, rootless toolchain/image caches and isolated user-local
OpenShell state were changed. Kirk supplied temporary KVM ACL access. No sudo,
RPM install, networking/firewall/SELinux change, Kind deployment or existing workload
delete. Native image export used the trusted host's existing Podman socket; that
socket was NOT placed in the VM. The gateway/CLI had a clean environment and
isolated HOME with synthetic PKI, no model/provider/forge credentials.

The sandbox/overlay and transient service were torn down. Synthetic PKI/client
state is removed after evidence capture; binaries and root image caches may remain
in ignored `.local/` and Podman storage. No private keys, JWTs, sandbox.pb or DBs
are attached. Keep unpublished source/workspace data before destructive cleanup.
Recovery commands/known failures are in `NATIVE-VM.md` and `DEVELOPMENT-IMAGE.md`.

## Review / next action

Follow-up review pending; nothing enqueued/merged by the agent. Required CI/PR
protections remain, but independent approvals were removed as Kirk requested for
same-account bootstrap. Kirk controls explicit review/merge; no automated human
approval is inferred. Future native fixes, real Curation/CA qualification and
Project enrollment are separately scoped Tier 0 follow-ups, not implicit Tier 1.

Resume from the actual PR head with `git status`, `BOARD.md`, the bound evidence
and `bash scripts/toolchain.sh pnpm check`. Do not run a credentialed implementation
worker while mandatory sandbox predicates fail.
