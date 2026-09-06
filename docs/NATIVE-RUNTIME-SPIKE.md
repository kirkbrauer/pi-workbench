# Native runtime spike: documentation and baseline findings

Scope: Tier 0 only. At Kirk's request, keep OpenShell **unmodified** and achieve
best-effort trusted diagnostics, not untrusted-worker admission. No host security
changes or custom runtime build. This spike is stacked on PR #2, source
`ac96b2b96203234908e44d85cb8465b140b57109`; [bounded evidence](evidence/native-spike.txt)
binds that base plus exact helper/policy/config hashes. Final revision and CI
results are attached to the PR. Full Tier 0 acceptance remains blocked.

## Documentation consulted

OpenShell release **v0.0.116**, source
`d1155aa70042d3e2ee49dbfa15346b108b7c1d92`:

- [VM runtime README](https://github.com/NVIDIA/OpenShell/blob/d1155aa70042d3e2ee49dbfa15346b108b7c1d92/crates/openshell-driver-vm/runtime/README.md)
  labels VM support **Experimental**, explains the custom guest kernel, source
  build flow and rolling `vm-runtime` release, and documents artifact attestations.
- [Security best practices: Landlock](https://github.com/NVIDIA/OpenShell/blob/d1155aa70042d3e2ee49dbfa15346b108b7c1d92/docs/security/best-practices.mdx#landlock-lsm)
  and [policy schema](https://github.com/NVIDIA/OpenShell/blob/d1155aa70042d3e2ee49dbfa15346b108b7c1d92/docs/reference/policy-schema.mdx#landlock):
  default `best_effort` can continue without filesystem restrictions. Use
  `landlock.compatibility: hard_requirement` where isolation gaps are unacceptable.
  That is a fail-closed setting, not a repair for an unavailable ABI.
- [Gateway MicroVM configuration](https://github.com/NVIDIA/OpenShell/blob/d1155aa70042d3e2ee49dbfa15346b108b7c1d92/docs/reference/gateway-config.mdx#microvm)
  documents vCPUs, memory and overlay size, but no VM `sandbox_pids_limit`.
  The PID option documented for Docker/Podman must not be transplanted into VM
  config and assumed effective. The [resource RFC](https://github.com/NVIDIA/OpenShell/blob/d1155aa70042d3e2ee49dbfa15346b108b7c1d92/rfc/0004-sandbox-resource-requirements/README.md)
  explicitly excludes PID limits from initial portable compute requirements.
- [VM driver lifecycle](https://github.com/NVIDIA/OpenShell/blob/d1155aa70042d3e2ee49dbfa15346b108b7c1d92/crates/openshell-driver-vm/README.md)
  says stop terminates the launcher while retaining `sandbox.pb` and
  `overlay.ext4`; start reuses the overlay. Retaining a disk is not proof that
  guest dirty buffers were flushed. No documented VM flush/grace-period knob was
  found in these references.

The current main revision consulted was
`320d4ef79dd572c642133f175f12bafc20d89fd9`. Its kernel fragment is unchanged from
v0.0.116; the runtime README changes the Cargo gateway package name. No released
fix is established by that comparison.

Related upstream [issue #3095](https://github.com/NVIDIA/OpenShell/issues/3095)
reports unusable Landlock in the same release on ARM64. It is supporting context,
NOT evidence for this host: ARM64 reports ENOSYS, our x86_64 guest reports
EOPNOTSUPP. The issue's informal collaborator response is not a tested resolution.

## Baseline observations (2026-09-05/06 UTC)

On Fedora, native libkrun guest Linux 6.12.76, UID 998:

- Direct Landlock version syscall returned `-1`, errno **95 / EOPNOTSUPP**.
  Embedded firmware contains Landlock code/disabled-at-boot diagnostics. The pinned
  libkrunfw x86_64 base config omits `landlock` from `CONFIG_LSM`; OpenShell's fragment
  enables `CONFIG_SECURITY_LANDLOCK` but does not amend `CONFIG_LSM`. This strongly
  identifies boot-time LSM activation as the x86_64 fix candidate. Effective final
  build config is not exposed by `/proc/config.gz`; record that visibility gap.
- Cgroup v2 advertises `cpuset cpu io memory hugetlb pids`, but the workload is in
  `0::/`, with empty `cgroup.subtree_control`. No non-root limited worker group
  exists. This is missing placement/enforcement, not missing PID-controller code.
- Reproduced ordinary write/read success followed by missing marker on stop/start
  (assertion exits 1). File fsync + directory fsync + sync before stopping preserved
  the second marker across a different guest boot ID (exit 0). This distinguishes
  retained storage from lost dirty writes; it does not establish which individual
  flush primitive is sufficient or qualify normal stop/start.
- Capabilities were empty, NoNewPrivs=1, seccomp mode=2. These observations cannot
  substitute for missing Landlock/PID enforcement.

`guest-runtime-diagnose.py` is read-only and emits no environment or complete
kernel command line. It reports unavailable inspection paths explicitly rather
than treating missing data as successful enforcement. It is not an acceptance gate.

## Runtime provenance checked using the documented procedure

Downloaded rolling Linux x86_64 runtime, SHA256
`770dcb73b21aa42c8d784ee3e9d9e581dfdbf1873dd7fec83a2dd724e47220b4`, and ran
`gh attestation verify ... -R NVIDIA/OpenShell --format json` successfully.
The archive's firmware and VMM hashes exactly match the libraries used by the
release driver. Fetching the current rolling archive therefore does NOT repair
this guest. Provenance records:

- Build: `2026-08-27T00:22:05Z`, upstream source
  `56088d0811f35d01e5af8f975335c9d0e30524be`, Actions run `33026157021`.
- libkrunfw `463f717bbdd916e1352a025b6fb2456e882b0b39`, kernel 6.12.76.
- gvproxy v0.8.9, umoci v0.6.0.

Attestation authenticates build provenance, not the correctness of its security
configuration. Local detailed evidence is under `.local/evidence/spike/`.
The bounded public extract is `docs/evidence/native-spike.txt`.

## Best-effort profile (unmodified OpenShell)

`config/native-diagnostic-policy.yaml` explicitly uses best_effort, a non-root
identity, narrow requested write paths and **no network allowlist**. Missing
Landlock means the filesystem path list is NOT fully enforced. Do not supply real
credentials, untrusted code or sensitive source. The existing rootless toolchain
image remains the practical trusted build environment, not a qualified worker.

The VM still has 2 vCPUs, 2 GiB RAM and a 4 GiB overlay; mTLS, clean environment,
isolated HOME and host service bounds remain. Guest PID enforcement is missing.
The helper rejects an already-active service/occupied port and bounds CLI calls
at 60 seconds. A timeout is NOT cleanup: the VM may remain and must be deleted.

```sh
bash scripts/native-probe.sh start
bash scripts/native-probe.sh register
bash scripts/native-probe.sh create
bash scripts/native-probe.sh cli sandbox exec --name workbench-t0-probe --no-tty --timeout 20 -- python3 - < scripts/guest-runtime-diagnose.py
# Only after your trusted work has stopped writing:
bash scripts/native-probe.sh checkpoint-stop
bash scripts/native-probe.sh cli sandbox start workbench-t0-probe
# Disposable synthetic persistence diagnostic (not for a real workspace):
bash scripts/native-lifecycle-probe.sh checkpoint
# Raw stop remains an independent mandatory test; failure is expected:
bash scripts/native-lifecycle-probe.sh plain
```

`checkpoint-stop` runs guest `sync` and stops compute only if that command
succeeds. The sync-only variant preserved an exact boot-bound marker across
restart in repeated diagnostics. It is **not atomic quiescing**, does not stop
concurrent writers, and does not cover crashes, service deadlines or raw gateway
shutdown. Keep durable copies of valuable work outside this disposable probe.
Raw stop still loses writes; do not replace its acceptance test with this workaround.

Additional bounded checks:

- Explicit empty allowlist rejected `https://example.com/` via proxy with HTTP 403.
  Direct TCP to 1.1.1.1:443 was refused. These two probes do not establish complete
  egress, rebinding or corporate-CA conformance.
- `hard_requirement` produced the Landlock finding and supervisor cleanup without
  the synthetic canonical command's sentinel appearing. However, the gateway
  remained **Provisioning**, and create hit the helper's 60-second timeout (124).
  Record this as startup blocked with a lifecycle/status defect, NOT a clean
  terminal rejection. Strict policy is not silently downgraded.
- Original host-path/allowed-write probe still fails the guest PID predicate.
- Three stdlib Python tests (fake CLI, no VM) verify sync failure prevents stop,
  successful ordering/clean environment, and invalid lifecycle mode rejection.
  Run `python3 -B -m unittest discover -s scripts/tests -p 'test_*.py' -v`.
  CI runs these alongside the existing 10 TypeScript tests; it does not prove VM
  isolation. Python 3 is host diagnostic/test tooling, not an application package.

## Cleanup and next action

Both disposable sandboxes/overlays were deleted, the transient service stopped,
and synthetic PKI/client config/gateway DB removed after evidence capture.
SELinux remains Enforcing and firewalld active. No sudo, RPM, host kernel, firewall
or KVM ACL changes were made. Runtime/image caches remain local. Kirk's temporary
KVM access remains unchanged; revocation is a human host-policy action.

Next action is human review of this explicitly restricted profile. Full worker
qualification needs upstream/native runtime fixes or a separately approved
architecture change. Source-runtime patching proposed earlier is **superseded by
Kirk's no-OpenShell-changes constraint**. Do not build a custom kernel/driver,
substitute Podman for the VM, or unlock Tier 1 under the name of best effort.
