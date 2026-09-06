# Offline bundle dependency plan — builder prerequisite

**Implemented:** a deterministic projection of the pinned pnpm package graph for
`darwin-arm64` and `linux-x64-gnu`. **Not implemented:** artifact collection,
bundle assembly, a complete runtime SBOM, installation or runtime qualification.
This is the next primitive after [content inventory](BUNDLE-INVENTORY.md), not a
claim that a self-contained Pi/Workbench release already exists.

## Narrow seed profile

`pi-and-foundation-tools` selects exactly:

- The root's explicitly pinned `@earendil-works/pi-coding-agent` dependency, even
  though it is a development dependency of this repository.
- The declared runtime dependencies of the existing `@pi-workbench/tooling`
  workspace (currently YAML), cross-checked against its lock importer.

Other root/workspace development dependencies are not seeds. The compiler,
ESLint and Biome are build inputs, not silently shipped runtime tools. This is a
**provisional planning profile**, not a host enrollment or an approved release.
There is no Workbench remote extension package yet. Some foundation tools inspect
checkouts or invoke development tooling; selecting their declared dependencies
**does not make every compiled tooling command standalone**. Distributable
entrypoints and their actual executable/data requirements still need selection.

The repository wrapper checks Node/Pi/pnpm pins and the package-manager integrity
pin's shape/version, validates the existing workspace supply-chain policy, compares
lock overrides with that policy, and binds all five input files by SHA-256. These
checks supplement—not replace—`pnpm check`, frozen installation, provenance/age
policy and audit. A caller-provided `sourceRevision` is an assertion; the planner
does not verify Git cleanliness or establish that the input files came from that
commit. Exact candidate test evidence is recorded separately in the PR.

## Graph contract

`planLockedDependencies(lockBytes, roots, platform)` accepts exact pnpm 9.0-format
snapshot IDs. `planRepositoryBundle(inputs, platform, sourceRevision)` selects the
narrow repository seeds. The planner:

- Preserves each peer-context snapshot ID and resolved edge; it does not flatten
  different peer environments into a single package or resolve semver ranges.
- Traverses required and platform-compatible optional dependencies iteratively,
  including cycles. An incompatible **required** edge fails. Every compatible
  optional edge remains selected, even if another package looks like a substitute.
- Evaluates declared `os`/`cpu`/`libc` selectors, including negation and `any`.
  Linux uses x64/glibc; Darwin uses arm64 and a non-libc sentinel. This checks
  package declarations, not ELF/Mach-O headers, Node ABI or actual OS compatibility.
- Records excluded optional edges with a platform-constraint reason. Missing
  snapshots/packages or invalid integrity cannot hide behind an optional exclusion.
- Records peer requirements and explicit unbound optional peers. A required peer
  without a selected edge fails. `transitivePeerDependencies` names remain metadata,
  not invented packages or instructions to search ambient modules. Peer ranges,
  suffix-to-binding semantic consistency and engine ranges are **not validated**;
  that requires manifest/pnpm/runtime evidence in the next increment.
- Binds exact package identities to canonical SHA-512 SRI. Registry tarball URLs
  are constructed public-registry locators, **not verified origin or publisher
  attestations**. No network request is made and no tarball bytes are inspected.
- Rejects aliases, local/Git/URL/range references, unknown lock/package/snapshot
  fields, malformed peer contexts, YAML aliases/custom tags/duplicate keys and
  invalid UTF-8. New lock semantics need deliberate support, not silent omission.

Limits: 16 MiB per metadata input, 10,000 package records and snapshots each,
100,000 graph edges, 100,000 projected peer/engine/selector fields, 512 roots and
32 nested peer contexts. Graph JSON and CLI output are capped at 16 MiB. The CLI
reuses the inventory verifier's bounded regular-file reader; final-component
symlinks, hardlinks, special files and observed read changes fail. Parsing and
serialization allocate before some budget checks; these are **not wall-clock or
process-memory limits**, and trusted stationary repository inputs/ancestors remain
required. This is not an archive parser or hostile-filesystem boundary.

## Reproduce

From an approved, pinned development checkout:

```sh
pnpm build
pnpm --silent bundle:plan darwin-arm64 SOURCE_SHA > NEW_MAC_PLAN.json
pnpm --silent bundle:plan linux-x64-gnu SOURCE_SHA > NEW_LINUX_PLAN.json
```

Use a new intended output file outside the metadata inputs. The only tool write is
stdout; redirection is an ordinary shell write, not atomic release publication.
Success means `locked-package-graph-only` and
`not-a-runtime-sbom-not-built-not-approved`. No download, install, lifecycle hook,
payload execution, SSH, credential or approval operation is performed.

With lock SHA-256 `d24a9852d761c05bd0a7f4ec4fced3c98cd9b65052dc6c05a3c0a2523e84373a`:

| Target | Selected snapshots | Selected edges | Excluded optional edges |
|---|---:|---:|---:|
| Darwin arm64 | 129 | 279 | 33 |
| Linux x64/glibc | 128 | 278 | 34 |

Both include platform esbuild and clipboard packages. Darwin includes **both** its
arm64 and universal clipboard packages; dropping one requires runtime inspection,
not guessing from filenames. Optional unbound peers include
`@modelcontextprotocol/sdk`, `bufferutil`, `supports-color`, `utf-8-validate`, and
`zod`. Their absence is explicit, not permission for ambient fallback.

## Next implementation boundary

Before assembly or a complete SBOM claim, collect and verify exact archive bytes,
inspect package manifests/license files and bundled dependencies, preserve resolved
module layout without copying arbitrary pnpm-store links, and identify every
helper executable/data asset/native library. The lock does not reveal all of these
or reliably enumerate lifecycle scripts. Ignored install scripts do not make a
package usable automatically. No lifecycle-script exception is granted here.

Node archive identity/provenance, exact supported OS/kernel/libc/library baseline
and approved distributable tooling entrypoints remain missing inputs. Host SSH and
platform security facilities remain external prerequisites, not bundled private
implementations. Then build twice and compare inventories, run bounded offline
no-model smoke tests, and prove missing/corrupt dependencies cannot fall back to
ambient tools/modules/libraries. These are pending tests, not planner successes.

Thirteen new tests cover deterministic graph selection, peer contexts/cycles,
required/optional failures, parsing/source/budget rejection, actual locked platform
payloads, pin/importer drift and CLI operation under an unusable PATH/isolated HOME,
including FIFO rejection. Ordinary `pnpm check` includes them and retains the
existing inventory tests. No dependency, lock, CI policy or runtime policy change.
