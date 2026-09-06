# Native macOS synthetic diagnostic

Tier 0 only. Unmodified OpenShell 0.0.116 release code, with upstream's documented
ad-hoc Hypervisor entitlement applied to a disposable driver copy. No custom
kernel, source rebuild, container backend, real credentials or worker admission.
The [initial preflight](MACOS-NATIVE-PREFLIGHT.md) records the earlier blocked
snapshot, not the subsequently authorized setup.

## Authorized setup on this Mac

Kirk approved proceeding after the preflight:

- Homebrew core e2fsprogs 1.47.4, ARM64 Tahoe bottle SHA256
  `f8024861ae8b5a645374d7960a5b5e3c41576c792712925d55deb186a74a1d06`.
  Dry run selected only this keg; installed dependencies were reused. Automatic
  updates, cleanup and dependent upgrades were suppressed to preserve unrelated
  installations. No tap-trust policy changed. No global linking, shell profile
  edits or service starts; Android's `mke2fs` symlink is unchanged.
- Verified Node 22.23.2 Darwin ARM64 archive SHA256
  `61130f394c1630d211dd50aecc4353d379480f36d3ac913cd85dbba1aed585c6`, from
  nodejs.org's HTTPS checksum list. Extracted under `.local/macos-toolchain/`;
  no host Pi/Node replacement. Bundled Corepack 0.34.6 activated the integrity-pin
  pnpm 11.25.0. Clean HOME/environment, frozen no-script install and all
  release-age/provenance/dependency checks passed. Node PGP signature was not
  separately verified; checksum authenticity relies on the official HTTPS origin.
- Installed inspected upstream attribution hooks at the pinned revision via
  `install.sh --copy`, without force, policy or identity overrides. Installer
  smoke test and subsequent actual-session `check:hooks`/`test:hooks` passed.
  The exact historical Git revision required an explicit fetch after clone.
- Original release driver preserved; signed-copy hashes and ARM64 image digest
  are in `config/macos-native-artifacts.json`. `originalDriver` denotes the
  original **ad-hoc signed, no-Hypervisor-entitlement** binary, not an unsigned
  Mach-O file. The three binaries report version 0.0.116.
- Registry `base:latest` was inspected only to resolve its multi-platform index
  to the **linux/arm64 child digest**. Only the child digest is configured for
  execution. Manifest and config digests/platform were checked anonymously;
  no Docker/Podman auth cache or socket was used. Image publisher identity is
  recorded in OCI labels; no independent image signature verification claim.

## Helper review and execution

`scripts/macos-native-probe.py` is a foreground, single-run diagnostic, not a
service or broker. Read it and `scripts/tests/test_macos_native_probe.py` before
use. It requires pre-staged, hash-bound artifacts; it does not download, install
or sign. It refuses non-native hosts, occupied port 18770, insufficient disk,
missing tools and artifact drift. Runtime HOME/state is a fresh mode-0700 short
`/private/tmp/wbm-*` directory; only synthetic PKI enters the VM. No repository
mount/upload or real host credential reads. Mac host/home denial uses path
existence checks only, including an actual generated synthetic host fixture.

The VM is explicitly configured for 2 vCPUs, 2 GiB RAM and a 4 GiB overlay.
The host helper provides operation deadlines, a 20-minute overall alarm and
owned-process-group TERM/KILL cleanup; **there is no aggregate host RAM, CPU or
PID quota**. Controller SIGKILL/crash cleanup is not qualified. Upstream child
parent-death guards were inspected but are not a substitute for observed cleanup.

The helper requires authenticated TLS readiness and a sole gateway listener at
127.0.0.1:18770, registers via mTLS, uses separate JWT keys, and disables automatic
providers. Each lifecycle marker asserts exact contents and changed boot ID.
Raw stop is independent of cooperative sync-stop. A sync failure prevents stop;
cooperative checkpointing is not atomic quiescing. Strict-policy failure/timeout
still triggers explicit deletion. No failure is silently changed into success.

```sh
python3 -B -m unittest discover -s scripts/tests -p 'test_macos_native_probe.py' -v
python3 -B scripts/macos-native-probe.py --evidence .local/macos-run-001
```

Output directory must not already exist. Raw private logs are capped to 128 KiB
per captured stream/tail and **must be inspected/redacted before publication**.
No key, DB, sandbox.pb or overlay is copied as evidence. Config/policy/helper hashes,
checkout SHA, native host and image bindings are in `results.json`. Runtime state
is deleted only after evidence capture and owned-process cleanup. Exit 0 means
completion of the diagnostic sequence, **never worker qualification**.

## Host-only checks before native run

Five Mac helper tests passed (clean environment/config, checkpoint ordering and
sync-failure refusal, bounded stdin/timeout handling, descendant cleanup, invalid
arguments). Initial timeout tests found Darwin's EPERM on zombie-only process
groups; the helper now inspects liveness and never suppresses a refusal affecting
live processes. Repeated tests passed. These checks do not prove VM isolation.

The combined Python suite also ran the old Fedora helper tests: two failed because
GNU `timeout` is unavailable in their hard-coded PATH. Those tests/checks were
not weakened or skipped in CI; their Linux-specific setup remains unchanged.
The Mac-specific suite is run separately here. TypeScript's ten tests, lint,
type/build, exact toolchain/dependency policy and high-level audit passed.
Hook checks used CI=true (matching the install's pnpm virtual-store setting) and
an empty npm user-config, while preserving actual Git identity/policy and Pi
session metadata. Earlier mismatched pnpm invocations refused before hooks ran.

## First launch / strict PKI interoperability finding

Run `.local/macos-run-001` at `c092a40bbaa1afc02a47e8b904293f021cc2b959`
started the explicit VM gateway/driver but failed authenticated TLS readiness;
no sandbox was created. Its config SHA256 was
`aebe126873910c3c24b3d7c9483556f1434953f17b6fa8f13a6d5badf02e9b20`.
Gateway logged `CertificateUnknown`. A separate disposable local TLS fixture
identified Python strict validation error 85, `Missing Authority Key Identifier`,
in OpenShell's generated certificates. All first-run state/children were removed.

The helper now provisions two-day synthetic CA/server/client certificates via
macOS OpenSSL with explicit critical constraints/key usage, AKI/SKI, server/client
EKU and loopback/guest gateway SANs. This is external TLS certificate provisioning,
not an OpenShell patch. Separate upstream-generated synthetic Ed25519 JWT material
is retained. **No TLS verification flags were relaxed.** Certificate errors now
fail immediately instead of repeating until the readiness deadline. A sixth
host test verifies this synthetic PKI with strict mutual TLS; all six passed.

Native execution results follow separately; setup and host tests are not a VM
boot or security acceptance claim.
