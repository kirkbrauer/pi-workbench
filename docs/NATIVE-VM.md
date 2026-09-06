# Native Fedora OpenShell probe — NOT qualified for workers

## Observed run (2026-09-05)

Native libkrun/KVM OpenShell **0.0.116** booted and executed a diagnostic through
an authenticated, loopback-only gateway. No Kind/KubeVirt/cluster was created.
Host is Fedora kernel `7.1.13-200.fc44.x86_64`, boot ID
`0a8ce080-11da-4d49-9517-4e1cad219026`. Guest was **6.12.76**, initially boot ID
`6c69bceb-10cf-412e-bb95-c1d7c63373c5`, UID/GID **998**, 2 online vCPUs and
`MemTotal: 2075496 kB`. Distinct guest identity and OpenShell execution are real.

**Mandatory failures prevent qualification:**

- Supervisor emitted **Landlock Filesystem Sandbox Unavailable** (HIGH).
- Guest `pids.max` was unavailable; the boundary script exited **1**, not pass.
  Host TasksMax=512 bounds host tasks, NOT the guest process count.
- `/sandbox/t0-marker` was written/read successfully but **absent after stop/start**.
  The restarted boot ID was `60a0573c-a2eb-4a20-87e3-c16ad8a32f34`. The original
  restart diagnostic returned 0 because its final `cat boot_id` succeeded; that
  exit code is NOT persistence success. The captured missing-marker error is the
  failing predicate. Future lifecycle probes must assert each operation explicitly.
- Full credential/network denial, resource exhaustion, gateway reconnect, image
  promotion and corporate-CA/egress conformance remain untested. No real worker
  or model credentials were supplied. Do not infer these predicates from guest boot.

Allowed workspace write/read and absence of a real **synthetic** host fixture,
host-home pathname and engine-socket paths passed. These narrow checks are not
complete isolation conformance, especially with the Landlock failure.

## Configuration and evidence binding

- Foundation source during probe: `acda42805f3633c2de7fd10a9900a16b7420db3d`,
  subsequently merged (same tree) as `6969178d25bb5078da66d688668758a672869a03`.
  Probe scripts were temporary at execution; their exact bytes are now versioned.
- `scripts/native-probe.sh` SHA256:
  `cdc1f37ced530e22a631a7ae2045d46b16bd8ffa7bed0810265c6ef5e42d39f4`.
- `scripts/guest-boundary.sh` SHA256:
  `b54ef10ff62637d390e30aada92f3dc5fd8f4721c06b82ff11409e207625214c`.
- Effective local gateway TOML SHA256:
  `3e0fc7723d588988abf9e743e9e2ac6bfaf2559a4a8bebc9356d62cdb2d7503b`.
- Pinned release source `NVIDIA/OpenShell@d1155aa70042d3e2ee49dbfa15346b108b7c1d92`.
  CLI/gateway/VM-driver tarball SHA256s are in `scripts/inspect-runtime.sh`, checked
  before extraction/execution. All three reported 0.0.116.
- Sandbox/bootstrap image:
  `ghcr.io/nvidia/openshell-community/sandboxes/base@sha256:c2a43bb0d765774e2790b3babfb20997bb2eac7b4bf4c6d7d8661e99817bf904`,
  linux/amd64; local image ID `sha256:65fa5d3d598a07d385ddbea41bf593be15af306337b76255b40705287cebcbbf`.
  Resolved from upstream `latest` before execution, then pinned by digest; attempted
  tag `0.0.116` does not exist. This is a probe userspace, NOT the Workbench dev image.
- `docs/evidence/native-guest-boundary.txt` SHA256
  `977016a46cc38060022dc271e89cdc6cd77667104fedef67dab7765b437738ff`.
- `docs/evidence/native-guest-restart.txt` SHA256
  `8e933d34aa81bfadbbaf5ce77ad259b2f322e7e9742aa7e67de9689d7a671aaf`.

Driver selection was explicitly `["vm"]`, with vcpus=2, mem_mib=2048,
overlay_disk_mib=4096. The transient user service had observed MemoryMax=6 GiB,
CPUQuotaPerSecUSec=2s and TasksMax=512; RuntimeMaxSec=1800 bounds unattended probes.
These are not substituted for missing guest protections. No GPU/TAP setup, sudo,
firewall changes, SELinux changes or host-wide package installation occurred.

First launch failed closed because gateway JWT signing was not configured:
`no sandbox token source available`. The pinned gateway's `generate-certs` already
creates `tls/jwt/{signing.pem,public.pem,kid}`. Adding the documented gateway_jwt
block with ttl_secs=900 supplied sandbox authentication; mTLS user auth and TLS
verification stayed enabled. Guest startup still emitted `/etc/hosts` read-only
and endpoint-preflight warnings, but authenticated supervisor execution succeeded.
Record those warnings, not a generic assertion that networking is fully verified.

## Setup/recovery for further authorized diagnostics

The scripts are ordinary trusted diagnostic helpers, **not a broker or a supported
worker launcher**. Do not run candidates/model workers in this failed profile.

```sh
bash scripts/inspect-runtime.sh     # exact verified user-local artifacts; no RPM install
bash scripts/native-probe.sh start # synthetic PKI, isolated HOME/state, bounded user service
bash scripts/native-probe.sh register
bash scripts/native-probe.sh status
bash scripts/native-probe.sh create # sleep-only diagnostic sandbox, no providers
bash scripts/native-probe.sh logs
# For real boundary reruns, create ONLY a synthetic host-denied fixture first.
# Expected boundary result remains failure until required controls are fixed.
bash scripts/native-probe.sh cli sandbox exec --name workbench-t0-probe --no-tty --timeout 20 -- sh -s < scripts/guest-boundary.sh
```

Before starting, verify the supplied KVM access and port 18770 availability; do not
modify device ACLs or bind over an existing gateway. Kirk supplied a temporary
KVM ACL for this experiment; persistent device ownership/access remains a human
host-policy decision. Downloaded artifact checksums are transport integrity, not
independent release-provenance attestation. Runtime attestation remains a gap.

On failure, save bounded console evidence BEFORE deletion (no credentials/tokens),
then stop/delete only `workbench-t0-probe` through this isolated gateway and stop
`pi-workbench-t0-vm` with `scripts/native-probe.sh stop`. Never use blanket deletion
or alter existing Podman workloads. Preserve unpublished workspace files before
intentional deletion. Restart/reconnect must be reverified after any fix.

At checkpoint the probe sandbox and overlay directory were deleted and the
transient service was stopped. Rootless image caches/binaries can remain. Synthetic
PKI/client state is removed after evidence capture; recreate it for a new run.
Do not attach private keys, JWTs, raw sandbox.pb or gateway DBs to the review.
