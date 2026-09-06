# Native macOS preflight — blocked before launch

Observed 2026-09-06 UTC on branch `feat/t0-macos-native-preflight`, based on
fetched main `18eb784274d82dbaf668274a5be4558356c5036d`. Handoff PR
[#5](https://github.com/kirkbrauer/pi-workbench/pull/5) was still open at
`f00f7a0c44cd9336828fc13a375810e302a8b6c0`; its handoff was read before branching.
This is **preflight evidence, not native VM verification or Tier 0 acceptance**.
Exact artifact hashes and commands are in [the evidence extract](evidence/macos-preflight.txt).

## Verified observations

- macOS 26.6.1, build 25G76, ARM64; `kern.hv_support=1`, 32 GiB physical RAM,
  approximately 85 GiB available disk. `memory_pressure` reported 77% system-wide
  memory free; initial `vm_stat` reported 4,941 free 16 KiB pages. These are
  different memory metrics, not a VM resource guarantee.
- No OpenShell executables found on PATH or matching running OpenShell/krun/
  gvproxy processes. Port 18770 had no listener. Existing Docker privileged
  networking helper was left alone. Podman 5.7.1's existing machine was stopped;
  Docker CLI 28.5.1 was present. No machine or service was started/reconfigured.
- Downloaded official v0.0.116 Darwin ARM64 CLI, gateway and VM driver archives.
  All matched GitHub asset SHA256 digests and passed `gh attestation verify`
  against NVIDIA/OpenShell. All three extracted executables are Mach-O ARM64.
  **No OpenShell executable was run**, including version/help commands.
- Downloaded and attestation-verified the rolling Darwin ARM64 runtime. Its hash
  matches the handoff observation. Embedded `provenance.json` reports kernel
  version and libkrunfw commit as `unknown`; do not inherit Fedora values.
  Matching this archive to the driver's embedded runtime remains unverified.
- Public downloads and inspection results are in private, user-owned mode-0700
  `.local/macos-preflight/`. No Fedora state, credentials, PKI, DB, VM overlay,
  host socket or source workspace was given to a guest.

## Blockers and untested predicates

1. **Hypervisor entitlement absent.** The released driver passes
   `codesign --verify --strict`, but has only an ad-hoc signature and emits no
   entitlement plist. The pinned official `openshell.rb` explicitly adds
   `com.apple.security.hypervisor=true` in `post_install` via ad-hoc re-signing.
   No signing operation was performed. A valid signature alone is insufficient
   for this prerequisite. This is a static finding, not an observed boot error.
2. **e2fsprogs unavailable in inspected locations.** `debugfs` is absent from
   PATH and `/opt/homebrew/opt/e2fsprogs/sbin/debugfs` does not exist. Homebrew
   inventory contains no e2fsprogs. The PATH `mke2fs` symlink belongs to Android
   platform-tools 36.0.2; it was not substituted for a reviewed e2fsprogs setup.
3. **ARM64 image unresolved.** Anonymous registry inspection confirms the Fedora
   digest is a single `linux/amd64` manifest. Candidate tags `0.0.116` and
   `v0.0.116` return HTTP 404. No image layers were pulled and no fallback tag,
   emulation, container engine or image was executed. Further ARM64 image
   selection/digest/platform inspection is required before boot.
4. **Development/publication prerequisites absent.** Active Node is 25.2.1,
   not 22.23.2; no Corepack on PATH or pinned Node in the inspected nvm versions.
   All three required Corepack/pnpm check invocations were blocked at executable
   lookup. No dependency install or toolchain replacement was attempted.
   Git has no configured `core.hooksPath`; `.git/hooks` contains samples only,
   with no active attribution `prepare-commit-msg` or `pre-push`. Nothing was
   committed/pushed, and hook installation/identity changes were not attempted.

No Mac launcher was implemented or reviewed. Gateway TLS/mTLS/JWT, guest boot,
Landlock ABI, PID budget, capabilities/seccomp, CPU/memory/overlay enforcement,
host-path denial, network controls, raw-stop persistence, cooperative checkpoint
and strict-policy startup are all **NOT TESTED**. In particular, upstream ARM64
ENOSYS is still a hypothesis, not local evidence. No runtime configuration digest
or executed image can be supplied because no runtime was configured or launched.

## Scoped approval needed to continue

- Review/provision e2fsprogs without replacing the Android `mke2fs` symlink; use
  explicit tool paths in the later isolated launcher. Inspect the exact package
  and dependency transaction before authorizing installation.
- Authorize upstream's documented Hypervisor ad-hoc signing step **only on a
  disposable copy of the verified release driver**, preserving the original and
  recording both hashes plus entitlement/signature verification. This changes
  signing metadata, not OpenShell source/kernel code, but is still a signing
  change requiring explicit approval under the handoff.
- Separately provision the pinned development toolchain and installed upstream
  attribution hooks before checks/publication. Do not replace the running Pi/Node
  or use an unsigned/unattributed commit as a workaround.

After approval and resolved image inputs, implement/review a small Mac-only
helper with short private state paths, clean environment, explicit VM driver,
loopback-only mTLS gateway and separate JWT keys, deadlines and owned-child
cleanup. Then perform the handoff's complete synthetic sequence. No `brew
services`, source build, security-policy change, container fallback or Tier 1 is
included in this proposal.

## Cleanup / residual state

No gateway, VM, listener, synthetic keys or DB was created, so there is no guest
cleanup to claim. Final process/port inspection found no OpenShell/krun/gvproxy/
vfkit process or listener on 18770. Only public artifact caches and evidence
remain under `.local/macos-preflight/`, plus these documentation edits. Existing
host installations and workloads were not changed.
