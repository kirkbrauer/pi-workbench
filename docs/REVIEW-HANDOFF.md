# Tier 0 follow-up review handoff

## Outcome

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
