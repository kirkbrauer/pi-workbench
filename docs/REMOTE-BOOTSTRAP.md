# Remote bootstrap requirements — approval first, managed updates thereafter

**Status: requirements for the next increment, not an implemented remote service.**
Development continues on macOS. Native diagnostic execution works on Fedora and
macOS. [Landlock absence and raw-stop issues are accepted limitations](ACCEPTED-RUNTIME-LIMITATIONS.md);
other worker qualification remains blocked. The present Tier 0 work may inspect
prerequisites and prepare a bootstrap plan, not introduce a broker, remote worker
or workflow engine. See [BOARD.md](BOARD.md) and [MACOS-E2E.md](MACOS-E2E.md).

## User decisions

Kirk requested a VS Code Remote-like experience: seed an explicitly selected SSH
host with the Pi harness and Workbench components needed for remote access.
**New hosts require explicit approval. Already enrolled hosts should automatically
receive updates when we upgrade their approved Workbench extensions.**

SSH authentication, a known_hosts entry, a previous diagnostic run, repository
access and an agent's recommendation do not constitute bootstrap approval.

## Enrollment boundary

Before any installation on a new host, present a concrete plan for approval:

- SSH destination, remote account, and host-key identity verified through the
  trusted SSH trust store/channel. Unknown or changed keys stop the operation;
  never disable host-key checking or silently accept a replacement.
- Trust profile and ownership of the destination. Approval for one host/account
  does not enroll another host/account or carry across personal/work profiles.
- User-owned install prefix, exact platform and initial component versions,
  artifact digests/provenance, download sources and anticipated disk use.
- Commands/effects, capabilities, persistence, update policy, and removal/recovery
  behavior. Any service, privileged action or credential enrollment is separate
  unless explicitly included in the reviewed plan.

Record approval bound to this identity and plan. A materially changed plan needs
fresh approval. A model-generated approval record is not human authorization;
Tier 0 scripts do not become a trusted approval service by recording a response.

## Passwordless SSH prerequisite and optional key bootstrap

Kirk requires **key-based, noninteractive SSH** for managed remote access and wants
an optional user-controlled flow to establish it. This is credential enrollment,
not an automatic consequence of discovering a host. Tier 0 can specify/test this
with fixtures; no real key/account enrollment has been authorized or performed.

1. Select the destination/account/trust profile and verify the host key through
   a trusted channel. An unauthenticated key scan is not identity verification.
2. Offer reuse of an explicitly approved client key or creation of a dedicated,
   profile-scoped key using the approved cryptographic/tool policy. Do not overwrite
   existing keys or mix personal/work identities. Prefer protected private keys or
   supported hardware-backed keys; never require an empty passphrase.
3. Obtain explicit approval for the public-key enrollment and exact destination
   mutation. Where initial password/MFA authentication is needed, the user completes
   it in a trusted terminal or OS authentication surface outside model input,
   tool arguments, environment exports and transcript/log capture. Do not implement
   password automation through `sshpass`, command-line passwords or secret piping.
4. Install only the public key using the host's authorized enrollment mechanism.
   Preserve existing authorized keys/access and respect central SSH policy. Make
   the addition idempotent; propose necessary ownership/permission repairs rather
   than changing unrelated files. Apply compatible forwarding restrictions. Those
   restrictions do not turn a login key into a broker-enforced command allowlist.
5. Verify the selected identity with strict host-key checking and `BatchMode=yes`,
   without agent/X11/port forwarding or password fallback. Only then may the
   separately approved host-seeding plan proceed. Unknown host identity, failed
   authentication, unavailable key unlock or required MFA produces a clear blocked
   state, not permission to weaken authentication or generate another key silently.

“Passwordless” means no account-password prompt during managed connections. A
passphrase-protected key unlocked by a trusted client-side agent/keychain can
satisfy this; a user-presence requirement must be reported rather than bypassed.
Private keys and approval/agent sockets never leave the trusted client or enter
remote worker contexts. No copying Mac auth caches to Fedora. The profile must
select its approved identity rather than trying every ambient agent identity.

Provide a reviewed rotation/revocation path identifying the enrolled public-key
fingerprint. Removing Workbench must not delete unrelated SSH access; rollback of
an enrollment may remove only its identified managed entry under explicit authority.
Enrollment records contain references/fingerprints, never private-key material,
passwords or passphrases. A verified login does not grant blanket host execution.

## Self-contained distribution

Kirk additionally requested a **self-contained installer, like VS Code Remote**.
The destination must not need preinstalled Node, npm/pnpm, Pi, a Workbench checkout
or access to package registries. Ship a platform-specific, immutable bundle with
Node, upstream Pi, the published Workbench components and all runtime dependencies.
Build that bundle with the pinned Corepack/pnpm and frozen lock; include development
tools only when they are explicitly part of the approved seed profile.

The Mac can obtain and verify the public bundle, then transfer that exact artifact
over verified SSH. Target-side registry downloads or package resolution must not be
necessary for installation. Never bootstrap with `curl | sh`, unpinned installers,
remote `npm install`, a global toolchain replacement or implicit sudo.

A small bootstrap routine must inspect the destination platform, stage the bundle
inside a private user-owned version directory, verify its manifest and contents,
run bounded offline/no-model smoke tests, and atomically activate the verified
version. Installation/verification and activation must recover from interruption;
keep the prior permitted version for rollback. Use the same artifact format and
activation rules for initial seeding and subsequent approved updates.

Self-contained does not mean an entire OS: SSH, a documented shell/unpacking
baseline, sufficient disk and compatible OS/libc/architecture remain explicit
prerequisites. Package any native runtime dependencies that can be distributed;
report missing external libraries rather than silently installing host packages.
No installer/framework or remote bundle has been implemented yet. The first
[offline content inventory/verifier](BUNDLE-INVENTORY.md) now checks staged bytes
and modes against an external expected digest/platform. It does not build a bundle,
prove dependency closure/publisher trust or authorize extraction/activation.

### Own the complete application/tooling dependency set

Kirk requires **our own versions of all dependencies for security**, not just a
bundled Node executable that discovers arbitrary tools elsewhere on the host.

- Pin and ship every runtime/application/tooling dependency the approved component
  set uses, including transitive packages, native modules, helper executables and
  distributable shared libraries. Lock build inputs too. Never silently resolve a
  missing dependency through the host package manager, global modules or ambient
  PATH; a missing required bundled dependency blocks activation.
- Produce a per-platform dependency inventory/SBOM with exact versions, content
  digests, origin/provenance and relevant license information. Verify the complete
  bundle against the approved publisher/trust policy, not just its launcher.
- Keep dependency source, integrity, age and vulnerability checks in the release
  pipeline. Bundling improves reproducibility and update control; it is not proof
  of safety and can preserve vulnerabilities unless updates/revocations are enforced.
- Resolve executables/modules/libraries from the version-bound bundle, with a
  controlled environment and explicit paths. Test missing/corrupt dependencies and
  hostile ambient PATH/module-search settings to prove no implicit substitution.
- Document the irreducible host trust boundary separately: host kernel, SSH service,
  platform security facilities and any non-redistributable OS libraries. Check the
  supported platform baseline and reject unsupported configurations. Do not claim
  these are privately bundled or install/replace them without separate authority.
  Minimize and explicitly verify any bootstrap utility used before the bundle can
  run; a future installer must not conceal reliance on arbitrary host utilities.

The current build pins remain Node 22.23.2, Corepack 0.34.6, pnpm 11.25.0 and Pi
0.85.0; authoritative inputs are `config/foundation.json`, `package.json` and
`pnpm-lock.yaml`. Native OpenShell installation/qualification is a distinct
prerequisite, not an implicit install side effect. Preserve existing attribution
hooks and identity; any hook installation/drift needs the established reviewed
integration path. Credentials and runtime state are never bundled.

## Automatic extension updates on enrolled hosts

Enrollment grants an explicit ongoing update policy, not unrestricted host access.
The policy identifies the approved extension set, publisher/source and release
channel, compatibility envelope, verification requirements and activation behavior.

1. On a subsequent managed connection, compare the remote installed manifest with
   the approved published release. Later background reconciliation would require
   an explicitly authorized destination-side lifecycle owner; none exists today.
2. Resolve a channel to an immutable release and verify its exact content and
   provenance against the enrolled trust policy. Never execute a mutable Git ref,
   arbitrary package name or an extension-provided update URL blindly. A content
   hash identifies bytes; it does not by itself establish publisher trust.
3. Stage the self-contained bundle into a separate version directory without
   modifying the active version. Bundle builds use pinned pnpm through Corepack,
   frozen integrity-bound dependencies and no lifecycle scripts; installation on
   the destination does not resolve packages. Existing dependency age/advisory/source
   gates remain in force; automation must not bypass them for a newer release.
4. Verify compatibility and the candidate's bounded health tests before activation.
   Preserve an installation receipt identifying exact component/artifact versions.
5. Activate only at a safe session boundary. Keep active runs bound to their existing
   version; do not hot-reload code beneath a running task or replay an uncertain
   task on connection loss. Explicitly requested live promotion would need its own
   reviewed protocol and verification, not merely Pi's `/reload` command.
6. On failure, leave the current approved version active or roll back to a still
   permitted verified version. Never roll back to a revoked/vulnerable release
   just to regain a green health check. Report blocked/stale state honestly.

Updates within this approved extension policy need no new prompt for each release.
**New extensions, additional permissions, new credential access, trust/source
changes, runtime upgrades, services or privileged effects require fresh approval.**
An extension cannot expand its own update authority or approve its own promotion.
Offline hosts remain visibly stale until a later verified update; SSH reconnect
alone is not evidence that an update completed.

## Pi/Workbench connection boundary

Upstream Pi supplies `pi --mode rpc`: a subprocess protocol over LF-delimited
JSONL stdin/stdout, not a network server or a durable remote job service. SSH may
carry that byte stream later, without a PTY and with stderr separate, but transport
does not supply destination authorization, deduplication, output bounds, durable
supervision or safe reconnect. These require later-tier implementation and evidence.

The pinned Pi documentation and examples were inspected before proposing this
shape. There is no Workbench remote bridge/extension release yet. Do not invent a
server package or claim VS Code-equivalent behavior from a successful SSH command.

- Keep SSH credentials and connection/control sockets on the trusted client;
  disable agent/X11/port forwarding for bootstrap diagnostics.
- Do not copy `.local/`, real HOME, Pi auth/session caches, signing material,
  engine sockets or gateway DBs between hosts or into workers.
- Remote Pi configuration/state must be profile-scoped and separate from ambient
  host Pi configuration. Real provider/account enrollment is a separate trusted
  flow, not a seed payload. Synthetic/no-model smoke tests come first.
- Installing Pi does not authorize running a host-native implementation agent.
  Current VM qualification failures remain blockers for untrusted workers.

## Required tests when these behaviors are implemented

- New/unapproved host cannot install; matching host/account/profile approval can.
- Key enrollment requires explicit approval, preserves unrelated keys, installs
  only public material and never exposes secret prompts to model/log capture.
- Noninteractive verification fails without the selected usable key; password,
  unexpected identity and agent-forwarding fallbacks cannot satisfy readiness.
- Duplicate enrollment is idempotent; approved rotation/revocation affects only
  the identified managed key, preserving other access and profile separation.
- Unknown/changed host key or altered plan is rejected before mutation.
- Installation works without destination Node/pnpm/Pi or registry access; wrong
  platform, missing OS prerequisites and corrupted bundles fail before activation.
- Complete dependency inventory matches shipped bytes; missing bundled dependencies
  and hostile ambient PATH/module/library settings cannot select host substitutes.
- Repeated approved seeding is idempotent; unrelated installations are preserved.
- Matching-policy extension update can proceed without another prompt; permission,
  component, runtime or publisher expansion cannot.
- Corrupt/untrusted artifacts, revoked releases, failed checks and incompatible
  versions never replace the active installation.
- Interrupted transfer/activation is recoverable; duplicate connection does not
  duplicate installation or task effects. Active sessions remain version-bound.
- Rollback preserves user work and uses only a still-approved version.
- No auth/config/socket inheritance; no real enrollment or model request during
  smoke tests. Exact source/config/runtime/artifact bindings accompany evidence.

## Observation so far

On 2026-09-06, the explicitly authorized read-only SSH command from the Mac to
Kirk's Fedora PC succeeded with strict host-key checking, batch mode, forwarding
and connection multiplexing disabled. The host reported
`Linux 7.1.13-200.fc44.x86_64 x86_64`, UID 1000. No installation, VM/service start,
provider enrollment or Workbench seeding was performed. This demonstrates basic
SSH reachability/execution only, not remote Pi control or reconnect qualification.
