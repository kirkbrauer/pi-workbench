# Fedora / Kind / Kata / OpenShell spike

September 5, 2026 • Actual execution results

## Decision

**Updated after the second experiment:** OpenShell 0.0.116 successfully creates and executes commands in Kata 4.1.0 guests on a disposable **rootful Podman Kind** cluster, using both Go and Rust QEMU runtimes. The guest-startup failure was resolved by increasing the node's exhausted shared-memory mount from approximately 63 MiB to 8 GiB; the minimal Ubuntu image also needed `iproute2` for OpenShell's network isolation. Native OpenShell MicroVM remains a documented, untested-on-this-host alternative without Kind. The first rootless experiment below is historical evidence, not a claim that Kata cannot work here.

This proves startup and remote command execution, not production security conformance or credentialed Pi/Codex operation. Rootless Kind was not rerun after discovering the shared-memory problem; its separate Go-runtime cgroup failure remains unvalidated.

## Environment and scope

- Host kernel: `7.1.13-200.fc44.x86_64`; about 61 GiB RAM total, 50 GiB available at inspection.
- KVM: `/dev/kvm` available outside the app sandbox; `KVM_GET_API_VERSION` returned 12 and `KVM_CREATE_VM` succeeded. This proves basic device/API access, not a complete guest boot.
- Kind: v0.32.0, explicitly using the current user's Podman provider.
- Saved `kind-belt-dev` endpoint refused connections. Current-user Podman inventory contained no Kind clusters; this does not establish the absence of rootful or other-user clusters.
- Created a separate disposable cluster `pi-kata-spike`, using a separate kubeconfig and a `/dev/kvm` mount. No existing Belt workload, host runtime configuration or normal kubeconfig context was changed.
- Kubernetes: v1.36.1, node image `docker.io/kindest/node@sha256:3489c7674813ba5d8b1a9977baea8a6e553784dab7b84759d1014dbd78f7ebd5`.
- Kata chart: 4.1.0, OCI chart digest `sha256:33f102f6db70083de4fc8238af4439c4245a601bcb6a72e49bc80529098aefc0`.

## Test results

| Check | Result |
|---|---|
| Host KVM API and empty VM creation | Passed; handles closed immediately. |
| Rootless Podman Kind control plane | Ready, system pods running. |
| KVM/vsock devices visible in Kind node | Present; presence alone does not prove functional guest communication. |
| Kata installer and RuntimeClass registration | Passed; node containerd configured and installer became Ready. |
| Minimal pod with `kata-qemu-runtime-rs` | Failed before a working container; see below. |
| Minimal pod with `kata-qemu` | Failed before a working container; see below. |
| OpenShell worker under Kata | Not run because the prerequisite pod could not boot. |
| Native OpenShell VM driver | Not tested. |

The probe was an Alpine 3.22 pod with no mounted service-account token, a bounded sleep, and CPU/memory limits. It requested the exact Kata RuntimeClass. No model or corporate credentials were used.

### Rust/QEMU handler

Initial error: systemd D-Bus socket missing during sandbox cgroup setup. The Kind node image lacked the D-Bus service. Installed Debian D-Bus packages and started the service **only inside the disposable node**. This removed the initial error.

The next attempts failed while connecting to the guest agent. Node runtime logs contained:

```
qemu stderr: "error: kvm run failed Bad address"
vsock: failed to connect ... within 10s
```

This is evidence of a guest execution failure followed by an agent-connection timeout. Its root cause was not established; the timeout alone must not be diagnosed as a networking failure. No successful guest kernel/boot-ID comparison was obtained.

### Go/QEMU handler

Enabled the alternate handler from the same Kata release and ran a separate probe. It failed during cgroup setup:

```
Could not create the sandbox resource controller
failed to write subtree controllers [cpu cpuset]
to "/sys/fs/cgroup/cgroup.subtree_control": ... no such file or directory
```

No cgroup protections, host security policy or isolation requirements were disabled to make the probe pass. Rootful Kind, another node image, another Kata release and a host-native containerd/Kata setup were not tested. The result is specific to this tested combination, not a claim that Kata cannot run on Fedora or Kind in general.

## Reproduction inputs

The separate evidence archive contains the Kind configuration, both probe manifests, Kata values, runtime classes and captured events/logs. It excludes kubeconfig, certificates and credential material. The Kata Helm upgrade enabled `shims.qemu.enabled=true` in addition to the initial Rust handler.

Consult the pinned release's chart rather than assuming main-branch defaults: the tested 4.1.0 chart defaults to DaemonSet installation, whereas the current main-branch installation guide described job mode. Reproducing this experiment mutates the disposable node's runtime; use an isolated cluster and review the configuration first.

## Cleanup and remaining effects

The disposable cluster was removed after evidence capture; its in-node Kata installation, D-Bus packages and probe workloads were disposable. Downloaded chart/reference files remain under the task's work directory. The cached Kind node image may remain in the user's Podman image store. No OpenShell/Agent Sandbox installation or credential enrollment was performed. Release metadata and charts for OpenShell 0.0.116 and Agent Sandbox v1.0.1 were downloaded for the conditional next step but were not deployed.

## Next bounded experiment

Test native OpenShell VM execution on Fedora with synthetic inputs: boot one sandbox, prove its guest boundary, run a deterministic job, test artifact persistence and disconnect behavior, then add a pinned Pi worker. If that fails too, investigate the common virtualization failure before expanding orchestration. Keep rootless Kind for ordinary Kubernetes contract tests meanwhile. A separate Kata investigation can compare node/runtime configuration and cgroup support without delaying the first working path.


## Second experiment: OpenShell on rootful Kind — passed

Created a separate `pi-openshell-kata` cluster using the same Kind/node/Kata versions, an isolated kubeconfig, and the rootful Podman provider. Installed D-Bus inside the disposable node, Kata handlers, Agent Sandbox controller v1.0.1 and OpenShell chart/CLI v0.0.116.

Complete recorded OpenShell chart digest: `sha256:df55cd1538bdfb7836834c30dfcf8373b85ffea83bbfd70d50dbe69407a0d2b3`.

The gateway used TLS/mTLS with isolated local client credentials and a loopback-only port forward. API user authentication used the chart's explicit `allowUnauthenticatedUsers: true` local development mode. This is not a production identity test. Telemetry was disabled; sandbox creation used `--no-auto-providers`. No model, forge, or corporate credentials were passed.

### Diagnosis and fixes

1. Both runtime paths initially failed before guest-agent connection. QEMU logged `kvm run failed Bad address`; the later vsock timeout was a symptom.
2. The node's `/dev/shm` was 63 MiB and 100% full. QEMU's arguments backed approximately 2 GiB of guest memory with `/dev/shm`.
3. Increased **only the disposable node's** existing shared-memory mount to 8 GiB with `mount -o remount,size=8G /dev/shm`. No host security settings were disabled. Fresh guests booted under both QEMU runtimes. The original Rust probe later progressed as well. This mount change is transient and must become a reproducible node provisioning setting before reuse; concurrency needs a bounded memory budget.
4. OpenShell then correctly failed closed because the plain Ubuntu 22.04 probe image lacked the trusted `ip` helper. Built a local image adding `iproute2` and `ca-certificates`, imported it into the test node, and repeated creation. No isolation checks were bypassed.

### Verified results

| Sandbox | Actual runtimeClassName | OpenShell exec result |
|---|---|---|
| kata-fixed-probe | kata-qemu | Success, kernel 6.18.35, uid 1000 |
| kata-rust-fixed | kata-qemu-runtime-rs | Success, kernel 6.18.35, uid 1000 |

Both printed `workbench-probe-ok`. Guest boot IDs were distinct from each other and the Fedora host, whose kernel is 7.1.13-200.fc44.x86_64. Execution used the OpenShell gateway's exec API, not just Kubernetes exec. The created pods had the requested Kata runtime class, and runtime logs showed QEMU with KVM.

The supervisor warned that `pids.max` is unlimited. A development-ready profile must establish a PID budget and test exhaustion behavior. Also validate filesystem/network policy, bypass denial, workspace persistence, stop/start/delete, user namespace/capability boundaries, provenance, resource exhaustion and the new Codex credential contract in design §14.3 before autonomous credentialed work. Test-image dependencies were fetched during the spike; a production template needs version/digest locking and rebuild verification.

### Deterministic checks to carry into Tier 0

- Reject node provisioning when shared-memory capacity is below the sum of concurrently admitted guest allocations plus headroom; report actual capacity/free space before guest launch.
- Verify KVM access and an actual guest boot, not device presence alone.
- Validate image prerequisites, including the trusted `ip` helper, before admitting a template.
- Assert runtimeClassName, guest identity, successful gateway execution and bounded process/memory resources.
- Keep credentials out of test logs and artifacts; use synthetic provider tests before real enrollment.

### Native host option

OpenShell documents an opt-in `vm` compute driver using libkrun/KVM on Linux and Hypervisor.framework on macOS, with QEMU for Linux GPU guests. It runs without Kind or Kubernetes. Select `compute_drivers = ["vm"]` explicitly; current docs say one driver per gateway. Host firewall/TAP networking, packaged VM dependencies and actual resource sizing need a dedicated Fedora smoke test. Keep separate gateway profiles for native VM and cluster execution. Do not infer direct-host success from this Kata result. [Compute driver documentation](https://docs.nvidia.com/openshell/latest/reference/sandbox-compute-drivers), [installation](https://docs.nvidia.com/openshell/latest/about/installation).


## Final placement decision and cleanup

Kirk selected **native OpenShell MicroVM for local Linux/macOS**, reserving the cluster adapter for remote Kubernetes/OpenShift/OKD. Kind remains only the completed experiment. The disposable `pi-openshell-kata` cluster was deleted after capturing successful execution evidence. Its ephemeral shared-memory change and in-cluster D-Bus/Kata/OpenShell installation disappeared with the node. Host security policy and existing Belt workloads were not changed. Test image caches may remain. Isolated local test client credentials and kubeconfigs are removed, and are excluded from exported artifacts. Native-host installation/testing is still pending.
