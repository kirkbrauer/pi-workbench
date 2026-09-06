# Prepared Fedora handoff — native VM diagnostics work on both hosts

**Status: future reference only. Kirk's latest direction is to keep working on
macOS. No return to Fedora is scheduled; use this when a later handoff is requested.**

## Resume instruction

> Read AGENTS.md, README.md, docs/BOARD.md, docs/REVIEW-HANDOFF.md,
> docs/FEDORA-HANDOFF.md, docs/MACOS-E2E.md and docs/NATIVE-RUNTIME-SPIKE.md.
> Native OpenShell diagnostic execution now works on Fedora Linux and macOS.
> Preserve that milestone and its remaining failures separately. Inventory Fedora
> before launching anything, preserve actual attribution metadata and host security,
> use unmodified OpenShell with synthetic data only, and do not unlock Tier 1.
> Fetch actual branch/PR/main state; do not treat earlier evidence as a new run.

## Milestone recorded

| Host | Native VM path | Versions demonstrated | Working synthetic behavior |
|---|---|---|---|
| Fedora Linux x86_64 | libkrun + KVM | OpenShell 0.0.116 | Boot, authenticated gateway exec, workspace write/read, cooperative checkpoint/restart, cleanup |
| macOS 26.6.1 (25G76), Apple Silicon | libkrun + Hypervisor.framework | Stable 0.0.116 **and** rolling 0.0.117-dev.82+gb9c7d5c70 | Same E2E diagnostic sequence, direct ARM64 guest identity and changed boot IDs |

No OpenShell source/kernel/driver-code modifications or container substitution.
Mac release drivers only received upstream's documented ad-hoc Hypervisor signing
on disposable copies. No real account/provider enrollment; no host HOME or sockets
shared with guests. **Working native diagnostics is not worker/tier acceptance.**

## Revisions and evidence to carry through Git

- Last fetched merged main: `18eb784274d82dbaf668274a5be4558356c5036d`.
  PRs #1, #2 and #3 were human-merged. Do not reset unrelated local work to it.
- Mac feature branch: `feat/t0-macos-native-preflight`, based on that main.
  Handoff/documentation commits follow the tested code; discover the actual
  published head on Fedora. No merge, enqueue or Tier 1 approval is implied.
- Mac **successful native tested SHA**:
  `bf4a177bb407642b6e452937d687971a36285d96`.
  Both stable-control and rolling-success runs used this same helper revision.
- Fedora evidence: [native-spike.txt](evidence/native-spike.txt), source base
  `ac96b2b96203234908e44d85cb8465b140b57109` plus its exact helper/policy/config
  hashes. Those results were subsequently merged via PR #3. **Not rerun from Mac.**
- Mac final evidence: [macos-e2e.txt](evidence/macos-e2e.txt), including tested SHA,
  both config digests, image/platform, runtime/binary hashes, boot IDs and failures.
- Earlier Mac failures remain in [macos-native.txt](evidence/macos-native.txt),
  [preflight](MACOS-NATIVE-PREFLIGHT.md) and [helper history](MACOS-NATIVE-PROBE.md).
- [Upstream review](MACOS-UPSTREAM-REVIEW.md): current stable 0.0.116, unresolved
  Landlock issue #3095, documented/maintainer-confirmed Mac support, and closed
  **unmerged** #2658 supplying the overlay-permission lead. Open PRs are not fixes.

Transfer versioned source/docs only. **Never copy `.local/` between hosts**:
no Mac binaries/libraries, ext4 caches/overlays, auth caches, SSH material, PKI,
JWTs or gateway DBs. Git carries bounded nonsecret evidence, not private logs.

## Key Mac discovery — do not misattribute it to rolling

The original helper inherited umask 077 into the gateway/VM driver. On Mac this
produced the overlay upper root with mode **0700, UID 501**, while the sandbox user
is UID **998**. Both stable and rolling stalled in Provisioning. Read-only inode
inspection confirmed the mismatch; an upstream PR describes the same class.

Changing **only the gateway child** to umask 022 produces guest root mode 0755 and
unlocks command startup. Outer host state, synthetic HOME and PKI remain 0700;
CA/client/server/JWT signing keys remain 0600 (observed). No global umask or real
HOME permission change. Guest root ownership still carries host UID 501; it is
not a general identity/ownership fix. Exact failed exec errno was not captured.

Stable 0.0.116 then passed the same Mac diagnostic E2E. There is **no demonstrated
need to use rolling** for this milestone. The helper retains 077 as a failure
reproduction default; working Mac commands explicitly pass `--gateway-umask 022`.
Do not apply the Mac helper or a new Fedora permission change blindly: Fedora's
existing helper already has working evidence. Inspect actual generated metadata
if a new Fedora run encounters a similar failure.

## Remaining blockers (not waived)

- Landlock: Fedora direct query EOPNOTSUPP (95); Mac direct query ENOSYS (38).
  Rolling Mac uses the same libkrun/libkrunfw/gvproxy bytes as stable and does not
  repair this. Requested filesystem path lists are not fully enforced.
- Guest PID budget absent on both: workload is in root cgroup, `pids.max` absent.
  A host process/task cap is not a guest process budget.
- Raw stop/start loses unflushed markers on both. Cooperative guest sync before
  stop preserved exact contents across changed boot IDs. This is not atomic
  quiescing, concurrent-writer safety, crash recovery or durable workspace acceptance.
- Strict Landlock startup remains Provisioning at deadline rather than a clean
  terminal rejection. Timed-out probes must still be explicitly deleted.
- Limited proxy 403/direct-TCP refusal and host-path absence are narrow evidence,
  not comprehensive egress/filesystem/credential-boundary conformance.
- Mac host helper has deadlines and owned-process cleanup, **not aggregate host
  RAM/CPU/PID quotas**. Do not infer systemd controls on Mac.
- Workbench development image remains unqualified as VM userspace. No corporate
  CA/JFrog/Curation transport or real account qualification. No broker/worker/UI.

## State left on the Mac

All disposable gateway/VM processes stopped, port 18770 free, sandbox lists empty,
overlays removed, synthetic runtime HOME/PKI/JWT/DB deleted. Final global process
inspection found no OpenShell/krun/gvproxy/vfkit process. Existing Podman machine
remained stopped; Docker service/helper and other workloads were not changed.

Authorized persistent setup remains:

- keg-only e2fsprogs 1.47.4, without replacing Android platform-tools' mke2fs;
- installed pinned upstream git-attribution-hooks, git-signoff and global hooksPath;
- ignored public stable/rolling artifacts, signed disposable copies, isolated
  Node/Corepack/pnpm toolchain/dependency caches and bounded private evidence.

No host Pi/Node replacement, OS upgrade, sudo, firewall/security change or service
installation. The rolling driver archive was attestation-verified; rolling CLI
and gateway were GitHub-hash verified but are not attested by that release workflow.
Stable all-three archive attestations passed. See exact provenance in Mac evidence.

## Fedora resume checklist

1. Preserve unpublished work; inspect `git status`, fetch origin, inspect actual
   main/feature/PR state. If the Mac branch has not been published, request its
   versioned commits rather than transporting private `.local/` state. Keep the
   actual installed attribution hooks and active harness identity; no overrides.
2. Re-inventory OS/architecture, free memory/disk, `/dev/kvm` access, gateways,
   listening probe port, Podman/workloads, SELinux and firewalld. The old handoff
   said Fedora was cleaned up; confirm current state rather than assume it.
   Kirk's prior temporary KVM ACL is a human host-policy decision, not renewed
   authority for sudo/ACL/security changes.
3. Use Fedora's approved pinned toolchain boundary. Node 22.23.2, Corepack 0.34.6,
   integrity-pinned pnpm 11.25.0 and Pi 0.85.0 are unchanged. Do not replace the
   running host Pi. Run frozen no-script install as needed, `pnpm check`,
   `pnpm audit --audit-level high`, `pnpm check:hooks`, and actual-session
   `pnpm test:hooks` when attribution integration is exercised/changed.
4. Mac suite: nine host tests passed. The old Fedora fake-CLI tests need Linux/GNU
   timeout and two fail on Mac; **not a waived CI check**. Run the combined Python
   suite in Fedora's appropriate toolchain. Do not weaken tests to pass.
5. If requested to rerun native Fedora diagnostics, use the existing Fedora helpers
   after inspection; recreate isolated synthetic PKI/HOME and bind fresh evidence
   to the checkout/config/runtime/image. Stable 0.0.116 remains sufficient for
   known diagnostic behavior. Do not transplant Darwin assets or assume a rolling
   Linux artifact shares Mac provenance/results.
6. Keep raw-stop failure and checkpoint success separate. Capture bounded evidence
   before explicitly deleting probes/stopping the gateway/removing synthetic keys.
7. Next work is review/qualification of remaining Tier 0 gaps, or a separately
   authorized upstream-compatible diagnostic—not implicit Tier 1 development.

No new hosted CI, clean-clone acceptance or human tier approval is claimed by this
handoff. Do not merge or enqueue on Kirk's behalf.
