# Pause point: resume native MicroVM verification on macOS

## Resume instruction

> Read AGENTS.md, docs/MACOS-HANDOFF.md and docs/NATIVE-RUNTIME-SPIKE.md. Verify
> the native macOS MicroVM leg using unmodified OpenShell and synthetic data only.
> Inventory the Mac first; do not run the Fedora helpers unchanged. Preserve host
> installations, credentials and workloads. No implicit container fallback, custom
> OpenShell build or Tier 1. Record successes and limitations separately.

These notes are versioned; **do not copy `.local/` from Fedora**. It contains
machine-specific runtime caches and historical private diagnostic state. Recreate
synthetic PKI on the Mac. Never transfer host auth, signing keys or gateway DBs.

## Actual merged base

Kirk merged the repository increments; this is NOT full worker acceptance:

| PR | Actual squash commit | Outcome |
|---|---|---|
| #1 | `6969178d25bb5078da66d688668758a672869a03` | TypeScript/Corepack/pnpm foundation |
| #2 | `38ab0243ecd547d694593e376e681a54b4a3e183` | Development image, registry/CA plans, native findings |
| #3 | `18eb784274d82dbaf668274a5be4558356c5036d` | Restricted native diagnostics and cooperative checkpoints |

Main at pause: `18eb784274d82dbaf668274a5be4558356c5036d`. PR #3 was restacked
before merge: final head `5641edda41b69de632b99c575d0a7db86933795d`, green Actions
[34001230359](https://github.com/kirkbrauer/pi-workbench/actions/runs/34001230359).
The merged main tree equals the earlier tested spike tree `3b3829b`; commit IDs
changed during restacking/squashing. Never treat old CI as evidence for new Mac
artifacts or edits. Fetch actual main/PR state again on resume.

Repository: https://github.com/kirkbrauer/pi-workbench. Read this notes PR before
resuming if it has not merged. Start a fresh feature branch from the observed
merged base; preserve installed attribution hooks and actual session identity.
Never override identity, forge a human sign-off or bypass a hook refusal.

## What Fedora established

Native **unmodified OpenShell 0.0.116**, x86_64 libkrun/KVM:

- VM boot, distinct guest kernel/boot identity and authenticated gateway exec work.
- 2 vCPUs, 2 GiB guest RAM, 4 GiB overlay; host service bounded separately.
- Isolated HOME, synthetic PKI, mTLS, explicit VM driver and no auto-providers.
- Explicit diagnostic policy has an empty network allowlist. Example.com HTTPS
  via proxy returned 403; one direct TCP probe was refused. Narrow evidence only.
- Allowed workspace read/write and synthetic host-path absence were observed.
- Cooperative guest `sync` before stop preserved a boot-bound marker on restart.

**Known limitations are not waived:**

- Guest Landlock syscall returned EOPNOTSUPP (95). Kernel feature appears built,
  but pinned base `CONFIG_LSM` omits landlock. No filesystem-rule enforcement claim.
- Guest PID controller exists, but workload is in root cgroup with no PID budget.
  Host task limits do not constrain guest processes.
- Raw stop loses unflushed writes. Checkpoint-stop is not atomic quiescing, does
  not stop concurrent writers and does not protect against forced/service shutdown.
- Strict Landlock prevented observed command startup, but gateway stayed
  Provisioning; CLI hit its 60-second timeout rather than a clean terminal error.
- Workbench development image has NOT been qualified as the native VM userspace.
  “Usable locally” means trusted diagnostics/limited trusted experimentation, not
  a ready credentialed agent environment. Full Tier 0 and Tier 1 remain blocked.

Versioned outputs and component hashes: `docs/evidence/native-spike.txt`.
Documentation/source analysis: `docs/NATIVE-RUNTIME-SPIKE.md`.

## macOS-specific prerequisites: inspect before changing anything

1. Record macOS version/build, `uname -m`, virtualization availability, free memory
   and disk, existing OpenShell/Podman/Docker installations, listening probe ports,
   and existing gateways/workloads. Do not dump environment or credentials.
2. Upstream native Mac path is **Apple Silicon + Hypervisor.framework**, not Linux
   KVM. If this is an Intel Mac, stop and verify upstream support rather than
   assuming the ARM64 procedure or silently emulating another architecture.
3. Inspect released **Darwin ARM64** CLI/gateway/driver assets for v0.0.116. Pin
   exact hashes before execution, verify attestations where available, and inspect
   the driver signature/Hypervisor entitlement. Prefer official packaged artifacts;
   no source rebuild. Any installation/signing change needs a concrete scoped plan.
4. The upstream driver docs describe Homebrew packaging and Hypervisor signing;
   they also mention e2fsprogs (`mke2fs`, `debugfs`). Inventory installed tools first.
   Do not run an upstream build/dependency installer or `brew services` command
   blindly: that can change installations, start services or use the real HOME.
5. Use a short, private, user-owned state directory: macOS Unix sockets have a
   tighter pathname limit (`SUN_LEN`). Separate synthetic HOME/PKI and work state
   from real OpenShell configuration. Check ownership/permissions and path length.
6. Resolve a suitable **linux/arm64** sandbox/bootstrap image to a digest, inspect
   its platform and record it. Fedora's image observation was linux/amd64; do not
   assume that digest is a suitable native ARM64 image. Do not use an unpinned tag
   or silently accept emulation as ARM64 verification.

Relevant pinned [VM driver docs](https://github.com/NVIDIA/OpenShell/blob/d1155aa70042d3e2ee49dbfa15346b108b7c1d92/crates/openshell-driver-vm/README.md)
and [runtime docs](https://github.com/NVIDIA/OpenShell/blob/d1155aa70042d3e2ee49dbfa15346b108b7c1d92/crates/openshell-driver-vm/runtime/README.md).
Some upstream quick starts disable TLS or write real HOME state: **do not copy
those defaults**. Preserve this project's authenticated, isolated profile.

### Expected ARM64 issue: verify, do not assume

Upstream [#3095](https://github.com/NVIDIA/OpenShell/issues/3095) reports v0.0.116
on Apple Silicon returning **ENOSYS (38)** rather than Fedora's EOPNOTSUPP (95).
It reports missing kernel security configuration, not merely LSM activation.
This is a hypothesis for the Mac run, not our own Mac evidence or a resolved issue.

The rolling Darwin ARM64 runtime digest observed during Fedora investigation was
`04349e6395c60e8cda059cc74e24105fdd23cec49ceac84966ce7377396e757d`.
It has **not been downloaded/verified/executed by this project on a Mac**. Rolling
release assets can change; compare current asset metadata and verify before use.
Do not transplant Linux runtime libraries or cached ext4 state to the Mac.

## Adapt helpers, not OpenShell

Existing `scripts/inspect-runtime.sh` and `scripts/native-probe.sh` are Fedora
x86_64 helpers, NOT portable Mac launchers. They assume Linux archives, `/dev/kvm`,
`systemd-run`, `systemctl`, `ss`, GNU `timeout`, `/usr/bin` tools and Linux service
resource controls. macOS's default Bash/tool locations also differ. The host
paths in `guest-boundary.sh` specifically name the Fedora fixture and are not a
valid Mac host-denial test as-is.

Implement a small, separately reviewed Mac diagnostic helper with equivalent
intent: explicit vm, loopback-only listener, verified TLS/mTLS plus separate
sandbox JWT configuration, isolated environment, no auto-providers, bounded
operation deadlines, explicit child/process cleanup and unique state. Do not
pretend Linux service limits exist on macOS; document the controls actually
available and observed. Do not implement a general broker or background daemon.

The guest Python diagnostic is reusable for Linux ARM64, but preserve explicit
unknown/error reporting. Adapt lifecycle commands to the new host helper; assert
both exact marker content and a changed guest boot ID. A CLI timeout does not
mean the guest was destroyed.

## Verification sequence and evidence

Use sleep-only/synthetic commands. No real account enrollment or untrusted agent.

1. Preflight exact artifacts/platforms, entitlement, private paths and free port.
2. Start isolated gateway; verify authenticated status, explicit VM backend and
   intended loopback binding. Configure gateway JWT keys separately from mTLS.
3. Boot one diagnostic VM, prove guest architecture/kernel/boot identity and UID.
4. Query Landlock ABI/errno, cgroup controllers/placement, capabilities, seccomp,
   CPU/memory and overlay. Unknown/absent controls must remain unknown/failing.
5. Create an actual synthetic host-denied fixture on the Mac. Test its absence
   and allowed guest workspace writes; check host-home/socket absence without
   reading any real credential. Do not infer full isolation from absent paths.
6. Test explicit proxy denial, direct-network bypass and relevant allowed controls
   with bounded harmless probes. No network outage-as-policy-success assumption.
7. Independently test raw stop/start and cooperative checkpoint/start. Exact
   marker content must survive and guest boot identity change; keep failures.
8. Test strict Landlock policy separately with a deadline. Record supervisor
   result AND gateway phase. Delete failed/stuck probes explicitly.
9. Capture bounded nonsecret evidence BEFORE deleting overlays; delete only this
   probe, stop its gateway/children, remove synthetic PKI/DB and confirm cleanup.

Bind evidence to checkout SHA, helper/policy/config hashes, macOS build/architecture,
OpenShell artifact hashes and versions, runtime provenance and image digest/platform.
Report each result separately: diagnostic usefulness is not worker qualification.
Limit repair attempts; no kernel/driver modifications under current authority.

## Development toolchain and registry constraints

Pins: Node 22.23.2, bundled Corepack 0.34.6, integrity-pinned pnpm 11.25.0, Pi 0.85.0.
Do not replace the running Mac Pi/Node installation. Supply-chain release-age,
provenance, frozen-install, no-lifecycle-script and audit checks remain mandatory.

`dev/Containerfile` and its Fedora build evidence are linux/amd64. Mac/ARM64 inputs
need separate inspection and a reviewed platform pin; do not silently switch
architecture or call an emulated build native. Podman on macOS may use its own
Linux VM for trusted build tooling; that is distinct from proving OpenShell's
native Hypervisor.framework worker boundary. Do not create/reconfigure a Podman
machine or Docker installation without inspecting the existing setup first.

Registry/CA functionality is planning plus synthetic validation only. No real
JFrog/Curation or corporate-CA transport qualification or credentials exist.
No credential/cache/socket copying to make a probe work.

## Fedora left paused

At handoff: no disposable sandboxes/overlays, gateway service inactive, synthetic
PKI/client config/gateway DB removed. SELinux Enforcing, firewalld active, no host
security/package changes. Ignored runtime/image caches and evidence remain on
Fedora. Kirk's temporary KVM ACL is unchanged; revoking it is a scoped human host
policy decision, unrelated to macOS setup. Preserve unrelated host workloads.
