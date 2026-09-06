# Native macOS E2E — diagnostic execution works

**Active development continues on macOS.** The [Fedora handoff](FEDORA-HANDOFF.md)
is prepared for later use, not an instruction to move hosts now.

**2026-09-06: native Apple Silicon VM create → authenticated exec → workspace
write → stop/start → cooperative checkpoint/start → delete works with both
stable and rolling OpenShell. Full worker qualification still fails.**

Tested Workbench SHA: `bf4a177bb407642b6e452937d687971a36285d96`.
Host: macOS 26.6.1 (25G76), ARM64, Hypervisor.framework available.
Exact artifacts, configuration hashes and results: [evidence](evidence/macos-e2e.txt).
This supersedes the startup-blocked conclusion in the earlier
[stable run record](evidence/macos-native.txt), without discarding its failures.

## What unlocked startup

The blocker was our launch profile's interaction with OpenShell's filesystem
creation: inherited umask `077` produced an overlay upper root with mode **0700,
UID 501** (host user). The workload runs as UID **998**, so this root was not
traversable. Read-only `debugfs stat /upper` confirmed that metadata on rolling.
Upstream's closed, unmerged [#2658](https://github.com/NVIDIA/OpenShell/pull/2658)
described this exact class of failure; it was a useful lead, not a shipped fix.

A gateway-child-only `umask=022` produces mode **0755** and unlocks startup.
The outer host state, synthetic HOME and PKI directories remain **0700**; TLS/CA
and JWT signing keys remain **0600**. These modes were checked before cleanup.
No global umask, real HOME permissions, host identity, OpenShell code, kernel or
policy was changed. Guest root still retains host UID 501 rather than root;
this ownership issue is **not repaired** and is another reason not to generalize
this diagnostic to arbitrary workload identities.

This is a launcher/environment correction, not a rolling-release fix:

| Profile | Gateway child umask | Diagnostic outcome |
|---|---|---|
| Stable 0.0.116, initial helper | 077 | Supervisor startup followed by stuck Provisioning |
| Rolling 0.0.117-dev.82+gb9c7d5c70 | 077 | Same failure; overlay upper 0700/UID 501 measured |
| Same rolling artifacts | 022 | Ready and authenticated exec; E2E diagnostic sequence ran |
| Stable 0.0.116 control | 022 | Same successful diagnostic sequence |

The precise failed `exec` errno was not captured; the controlled launcher change
and inode observations establish the permission interaction without inventing an
observed EACCES log. Initial TLS readiness also needed standards-compatible
external synthetic PKI; strict verification was never disabled (see
[setup history](MACOS-NATIVE-PROBE.md)).

## Results, separately

Both successful profiles observed:

- Explicit native VM, authenticated mTLS gateway status/exec, and refusal of a
  client lacking a certificate. No provider credentials, container engine or
  host mount. Guest `Linux 6.12.76`, `aarch64`, UID 998, distinct guest boot IDs.
- 2 vCPUs and approximately 2 GiB guest RAM observed; 4 GiB overlay file.
- Synthetic host fixture, real host-home pathname and selected engine sockets
  absent; socket environment variables absent. `/sandbox` write/read succeeded.
  These are narrow probes, not complete host-boundary qualification.
- Empty network allowlist: example.com proxy CONNECT returned 403; direct TCP to
  1.1.1.1:443 was refused. Host example.com HTTPS control returned 200. No complete
  egress, allowed-network policy, DNS/rebinding or corporate-CA qualification.
- **Raw stop failed persistence**: guest rebooted but exact marker disappeared.
- **Cooperative sync-stop passed persistence**: exact boot-bound marker survived
  and boot ID changed. Not atomic quiescing, crash safety or concurrent-writer safety.
- **Landlock failed**: direct ABI query `-1`, errno **38 / ENOSYS**. This is now
  local ARM64 evidence, no longer merely the upstream issue's hypothesis.
- **Guest PID budget failed**: workload cgroup `0::/`, PID controller advertised,
  no `pids.max` budget. All capability sets empty, NoNewPrivs=1, seccomp=2; these
  do not replace missing controls. Kernel config/active LSM paths unavailable.
- **Strict Landlock remained blocked in Provisioning** until the 60-second
  deadline. Policy was not downgraded; no clean terminal rejection claimed.
- Sandboxes/overlays explicitly deleted; owned processes and gateway stopped;
  synthetic keys/DB/state removed. Final port/process inspection was clean.

## Reproduce on this prepared Mac

Only synthetic/trusted diagnostics, not an untrusted agent or a durable workspace:

```sh
# New output directories required. Explicit 022 is important; 077 preserves
# the original failure-reproduction profile and is still the helper default.
python3 -B scripts/macos-native-probe.py --profile stable --gateway-umask 022 \
  --evidence .local/macos-e2e-stable-next
python3 -B scripts/macos-native-probe.py --profile rolling --gateway-umask 022 \
  --evidence .local/macos-e2e-rolling-next
```

The helper does not install/download/sign or leave a gateway running. It uses
separately pre-staged hash-bound artifacts and fresh synthetic state each time.
It supplies operation/overall deadlines and process cleanup, **not aggregate
host RAM/CPU/PID limits**. The running host Pi/Node remains unchanged.

Stable is sufficient for the demonstrated diagnostic; there is no demonstrated
benefit from rolling for the failed isolation/persistence predicates. Rolling
has a weaker provenance surface: the driver archive is attested, but its release
workflow does not attest CLI/gateway archives (GitHub asset hashes verified).
All three stable archives were attestation-verified. No host upgrade to rolling
or production deployment is implied. The [upstream review](MACOS-UPSTREAM-REVIEW.md)
records release/PR state and limitations.

Nine Mac helper tests and ten TypeScript tests/checks passed, along with audit
and actual-session hook verification. Older Fedora helper tests remain
Linux-specific; two fail on Mac because GNU timeout is absent. They were not
weakened to pass. No hosted CI, independent human review or tier acceptance is
claimed for these local commits. Tier 0 remains blocked for untrusted workers.
