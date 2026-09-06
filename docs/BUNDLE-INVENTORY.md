# Offline bundle content inventory — first distribution primitive

**Implemented:** a host-side TypeScript inventory/verification tool for a stationary
staging directory. **Not implemented:** a release builder, complete dependency
SBOM, archive extraction, installer, publisher verification, approval, activation,
rollback, remote transfer or Pi execution. See [REMOTE-BOOTSTRAP.md](REMOTE-BOOTSTRAP.md)
for the larger requirements; those remain separate increments. The
[locked dependency planner](BUNDLE-PLAN.md) now provides the first builder input,
not a complete SBOM or materialized bundle.

## Contract

A schema-1 description declares:

- `platform`: `linux-x64-gnu` or `darwin-arm64`;
- `sourceRevision`: exact 40-character lower-case Git SHA;
- `lockSha256` and `foundationSha256`: exact SHA-256 input identities;
- `components`: unique IDs, exact version strings, credential/query/fragment-free
  HTTPS source URLs, source SHA-256 and license labels. `node`, `pi` and `workbench`
  are required; additional declared component roots are permitted.

Each component is a top-level directory containing at least one file. Inventory
entries bind every relative file/directory path, kind and mode, plus file size and
SHA-256. Empty directories also affect identity. The staging root itself is not an
entry: its mode is checked against the allowed set, not bound into the inventory.
UID is checked for local ownership; UID/GID changes during file reads are rejected,
but neither is portable artifact identity. Timestamps,
absolute staging location and traversal order are not inventory identity.

Metadata uses one exact UTF-8 JSON encoding: validated fields in fixed order,
components/entries sorted by ID/path, two-space indentation and a final newline.
The parser rejects alternate/duplicate keys, noncanonical ordering/encoding,
unknown fields, invalid sizes/modes and missing parents/components. Generation
normalizes a validated description; the description itself need not be canonical.
`serializeInventory` is an encoder, not a validation API; use `parseInventory` to
validate independently supplied inventory bytes.

Verification requires **external expected inventory SHA-256 and platform**. Metadata
size, digest, schema and platform are checked before scanning the payload tree.
It then regenerates and compares all entries: extra/missing/changed files,
permissions or directories cannot be silently ignored.

The digest binds the claimed build/component information, but does **not** prove it
is true. No source URL is fetched, license claim validated, executable header
inspected or installed runtime version executed. Cross-platform content checking
is allowed; a matching platform label is not host compatibility or executable
qualification. This is not yet a complete transitive/native dependency SBOM.

## Staging preconditions and limits

Use only an **operator-owned, stationary tree on a local POSIX filesystem**, with
trusted ancestors and no concurrent writers. Do not point at host HOME, a live
checkout, a pnpm store or a concurrently extracted archive. A future builder must
materialize the selected verified files into a fresh staging tree deliberately;
this scanner does not dereference arbitrary package-store links to create a bundle.

- Root, directories and files must be owned by the current process's real UID
  (`getuid`); do not invoke this tool under sudo/setuid.
- Directory modes: 0700 or 0755. File modes: 0600, 0644, 0700 or 0755. Group/world
  writes, setuid/setgid and sticky modes are rejected, not repaired.
- No symlinks, hard-linked payload files, sockets, devices or FIFOs. The root itself
  cannot be a symlink. Metadata input files must be regular, single-link and not
  final-component symlinks.
- Paths: bounded portable ASCII characters, at most 512 characters and 32 segments;
  no absolute paths, backslashes, dot/dot-dot/empty segments or case collisions.
- Maximum 16 MiB metadata, 50,000 entries, 512 MiB per file and 2 GiB total payload.
  VM images are not the intended payload of this application-bundle format.
- Directory iteration is incremental so the entry budget applies before allocating
  an entire directory listing. Hashing uses 64 KiB chunks. Metadata reads are bounded
  even if a file grows. Observed file identity/size/mode/owner/time/link changes
  fail verification rather than producing a successful result.
- `O_NOFOLLOW` prevents following the final file component. `O_NONBLOCK` prevents
  a FIFO substitution from blocking `open` before `fstat` can reject it. Parent-path
  replacement remains a race: this is **not a filesystem sandbox or atomic snapshot**.

The bounds limit data processed, not elapsed filesystem operation time or total
process memory to 16 MiB. Stalled storage needs an external process deadline.
This tool does not inspect ACLs, extended attributes, resource forks, file flags,
mount boundaries or filesystem-specific aliases. Those need a reviewed clean-stage/
activation contract; a content match alone is insufficient to execute an archive's
extracted output safely. Copying/changing the tree after verification invalidates
that observation; there is no secure verification-to-use handoff yet.

## Commands

Use the already approved, pinned host toolchain. The following commands neither
install dependencies nor invoke any staged payload:

```sh
pnpm build
# DESCRIPTION and INVENTORY must live outside ROOT.
pnpm --silent bundle:inventory ROOT DESCRIPTION.json > INVENTORY.json
pnpm --silent bundle:verify ROOT INVENTORY.json EXPECTED_SHA256 darwin-arm64
```

Equivalent built CLI: `node packages/tooling/dist/src/bundle-inventory.js` followed
by `inventory ROOT DESCRIPTION` or `verify ROOT INVENTORY EXPECTED_SHA256 PLATFORM`.
Do not derive `EXPECTED_SHA256` from the candidate and call it publisher approval;
the trusted caller/release policy must supply that expected identity separately.
The redirect is an ordinary shell write: use a new intended output path, not an
existing artifact or an input file. This command is not an atomic artifact writer.

Success prints JSON with `status: "content-verified-only"` and
`qualification: "not-installed-not-approved-not-runtime-qualified"`. Invalid input
exits nonzero; there is no `install`, `execute`, network, repair or fallback mode.
The library returns a validated inventory, not a capability or admission token.
No receipt or approval is persisted by this tool.

## Tests / review

Fifteen synthetic tests are included in ordinary `pnpm check`:

- Deterministic inventory, source/mode/content bindings and external digest/platform
  rejection before payload access.
- Missing/extra/tampered content, path escape/collision, malformed metadata,
  excessive count/depth/aggregate sizes, modes and links.
- CLI operation with deliberately unusable ambient PATH/module lookup and a staged
  executable sentinel that must **never run**. This proves no payload execution by
  the verifier, not that a future Pi bundle has no ambient runtime dependencies.
- FIFO/directory/link/oversized metadata rejection, including a late payload FIFO
  substitution in a deadline-bounded child process. Timeout is test failure, not
  an acceptable rejection. Test-only `/usr/bin/mkfifo` creates disposable fixtures.
- Injected UID and before/after file-stat changes, without privileged ownership
  changes or attempts to race real user files.

All fixture trees are disposable and cleaned up. No model, SSH, registry, credential,
VM or candidate binary is used by these tests. Source/configuration/runtime bindings
and actual check results belong to the exact PR candidate, not the synthetic
versions/hashes used as fixture data. Existing lockfile and checks are unchanged.
