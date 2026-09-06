# macOS upstream review — 2026-09-06 UTC

Read-only upstream review after the native diagnostic at
`703a453330d2aff32d727018bc14e2bbf611fcd4`. No runtime, image, package or policy
was upgraded during this review. Native evidence remains bound to its tested
revision in [evidence/macos-native.txt](evidence/macos-native.txt).

## Versions and documentation

- Latest stable release remains **v0.0.116**, published 2026-08-28 09:10:23 UTC,
  source `d1155aa70042d3e2ee49dbfa15346b108b7c1d92`. Its Darwin CLI/gateway/driver
  archives and Homebrew formula have **the same hashes we verified and used**.
- Rolling Darwin runtime remains SHA256
  `04349e6395c60e8cda059cc74e24105fdd23cec49ceac84966ce7377396e757d`, asset last
  updated 2026-08-27 00:25:33 UTC. There is no newer runtime at that release URL.
- Current main is `320d4ef79dd572c642133f175f12bafc20d89fd9`, 83 commits ahead of
  the release source. Main and the release have identical `openshell.kconfig`,
  `runtime/pins.env` and `tasks/scripts/vm/build-libkrun.sh`. Main is not a released
  fix for the missing kernel security configuration.
- A newer rolling **dev prerelease** exists, with Darwin assets updated September
  5. It was not downloaded, attested or executed. Its source provenance and
  compatibility would require a separate pinned comparison; newer is not proof
  of fixing our startup failure. Do not replace the stable pins silently.
- NVIDIA's [compute-driver reference](https://docs.nvidia.com/openshell/reference/sandbox-compute-drivers#microvm-driver)
  explicitly documents libkrun + Hypervisor.framework on macOS; the
  [support matrix](https://docs.nvidia.com/openshell/reference/support-matrix)
  calls MicroVM supported. The same native-platform description exists in the
  v0.0.116 docs. The maintainer runtime README's Experimental label is a separate
  qualification, not evidence that the documented native Mac path is unsupported.
- Our explicit VM selection, private driver socket, gateway config keys and
  registry-sourced ARM64 image follow that documented path. The reference's
  nftables/TAP host-firewall guidance is not a reason to modify the Mac firewall
  or start Docker/Podman. Mac libkrun uses gvproxy user-mode networking here.

Retrieved public markdown SHA256:

```text
0800e91f01cce9e7edd34e06ec78a6e5b4a7b39166ac23e2c598504c64795a2c sandbox-compute-drivers.md
a71240f3df3d779830c4fe7b63c1b4f5e0be050f8fe0d2003e1f5a1dceafc0d1 support-matrix.md
```

The rolling dev Darwin asset digests observed (metadata only):

```text
b0988d9ecb754a4e230a3af019f89ad155729201df0b0146b0b589eb5e7f608e CLI archive
5c141500908c23ed107aea792a5c29655109d816b430a19c07974a01264a72a5 gateway archive
57ccbec1d5b91cdfc420ed996b5f84f066f5ced64156a46360506f7fc5db5153 driver archive
```

## Relevant issues and PRs

GitHub API merge fields were checked: **closed does not mean merged**. Contributor
claims and upstream test results below are context, not our own acceptance evidence.

| Reference | Observed state | Relevance |
|---|---|---|
| [#2940](https://github.com/NVIDIA/OpenShell/issues/2940#issuecomment-5532490554) | Issue open; maintainer response September 3 | Maintainer reports successful **v0.0.116 native VM command execution on macOS 26.6.2 (25G83)** after official Homebrew installation. The harmless HTTP request was policy-denied. Confirms the failure is not universal to native Mac v0.0.116. Our Mac is 26.6.1 (25G76); no OS upgrade is implied. |
| [#3095](https://github.com/NVIDIA/OpenShell/issues/3095) | Open; acceptance boxes unchecked | Exact release/runtime ARM64 Landlock ABI problem. Reporter observed ENOSYS; we observed only the supervisor finding, not direct errno. Maintainer's informal investigation comment is not a merged/released fix. No fix PR was linked in the inspected timeline. |
| [#2658](https://github.com/NVIDIA/OpenShell/pull/2658) | **Closed, NOT merged** | Describes fork-safe process startup and, critically, **host umask/UID leaking into the overlay upper root as mode 0700, causing non-root exec EACCES**. Proposed fix mirrors the lower-root mode/owner before overlay mount. Our helper uses umask 077. This is a concrete configuration-interaction hypothesis, not yet a diagnosis of our deleted overlay. The proposed root-metadata lines are absent from the release and inspected main init scripts. PR was closed by the first-contributor vouch gate, not accepted as a fix. |
| [#2587](https://github.com/NVIDIA/OpenShell/issues/2587) | Open | Older WSL2 VM relay/startup report referenced by #2658. Different release/platform; cannot label our failure the same bug. Logs also demonstrate that Landlock/PID warnings can coexist with supervisor/SSH startup. |
| [#1585](https://github.com/NVIDIA/OpenShell/pull/1585) | Merged May 27, predates release | Confirms `best_effort` emits an unavailable finding and returns `Ok(None)`; `hard_requirement` errors. Therefore our best-effort failure must not be attributed solely to unavailable Landlock. |
| [#3147](https://github.com/NVIDIA/OpenShell/pull/3147) | Merged September 3; after stable release | Detects available default login shell and improves the opaque ENOENT spawn error. Relevant to diagnosis, but explicitly does not rewrite caller-supplied commands; our workload explicitly uses `sh`, on the community base image. Not an established fix for our run. |
| [#3040](https://github.com/NVIDIA/OpenShell/pull/3040) | Merged August 31; after release | Protects embedded VM inputs against CI cache restoration. Our runtime libraries extracted successfully, matched the attested archive, and guest supervisor started. No evidence of missing embedded inputs locally. |
| [#3134](https://github.com/NVIDIA/OpenShell/pull/3134) | Merged September 2; after release | Retries transient registry failures. Our image pull/format succeeded, so not the observed failure stage. |
| [#2884](https://github.com/NVIDIA/OpenShell/pull/2884), [#3101](https://github.com/NVIDIA/OpenShell/pull/3101) | Merged after release | Successful canonical-process completion and early-container-exit reconciliation. Important lifecycle changes; neither establishes a fix for our long-running command failing before readiness. |
| [#3090](https://github.com/NVIDIA/OpenShell/pull/3090) | Merged September 2; after release | Corporate proxy feature with author-reported Mac VM E2E observations. Notes e2fsprogs and short canonical commands. We installed e2fsprogs and use short commands, not the reported ~1000-character libkrun command-line overflow. No corporate proxy is configured. |
| [#2800](https://github.com/NVIDIA/OpenShell/pull/2800) | Merged September 4 | Corrects stale image paths and semver examples: community images publish `latest`/Git-SHA tags, not release semver. Explains our initial 404 lookups; our final registry namespace/index/child pin already matches the corrected guidance. |
| [#2636](https://github.com/NVIDIA/OpenShell/pull/2636) | Merged September 4 | Removes development scripts' hard-coded JWT TTL to handle long sleeps. Our intentional 900-second synthetic tokens were newly minted and policy fetch succeeded well before expiry; not the observed startup failure. Do not switch to non-expiring tokens to hide it. |
| [#2945](https://github.com/NVIDIA/OpenShell/pull/2945), [#3151](https://github.com/NVIDIA/OpenShell/pull/3151) | Open, unmerged | Substantial control/boundary supervisor split, moving policy/network/credentials outside the guest. These are architectural proposals/implementations, **not shipped fixes** and not authorization to adopt a different boundary. |
| [#3116](https://github.com/NVIDIA/OpenShell/issues/3116) | Open proposal | Retire community images in favor of Alpine; not implemented acceptance. Comments report stock-Alpine prerequisites still missing. No reason to replace our inspected image with unqualified Alpine. |
| [#1809](https://github.com/NVIDIA/OpenShell/issues/1809) | Open older report | v0.0.40 boot path materially predates ext4 redesign. Upstream asks for current reproduction; not proof that current Mac MicroVMs cannot work. |

## Next bounded diagnostic, not a repair claim

First inspect **actual generated overlay `/upper` mode/UID/GID** and obtain the
supervisor's structured spawn error before deleting another probe. Compare with
#2658's concrete EACCES hypothesis. Our private outer host state directory must
remain mode 0700; do not make host HOME/keys accessible or patch the guest kernel.
Any experiment separating host-state permissions from guest filesystem creation
must be separately reviewed and tested, preserving original failure evidence.

Do not upgrade macOS, switch to rolling dev, apply an unmerged PR, remove policy
checks or call Landlock the sole startup cause based on this review. Native Mac
support is documented and independently reported; our configuration-specific
startup failure remains unresolved. Worker qualification is independently blocked
by missing Landlock/PID evidence and the untested boundary/lifecycle predicates.

Review used public docs, release metadata, selected issue bodies/comments,
PR merge fields/files, issue #3095 timeline, targeted searches (macOS, VM,
Provisioning, Landlock, seccomp, PID, umask, libkrunfw/Hypervisor) and pinned-source
comparisons. Broad searches were bounded to 100 results each; this is not an
exhaustive audit of every upstream issue. Private nonsecret response caches are
under `.local/macos-preflight/evidence/upstream-review/`.
