# Staged formatting without replacing attribution hooks

The repository uses the pinned **Biome 2.5.12** and **Node 22.23.2** to check the
exact staged source before a commit. This is a local convenience gate, not a
security boundary or a replacement for `pnpm check` / hosted CI.

## Install explicitly on a trusted checkout

Use the approved **host-native** pinned Node/Corepack/pnpm, not a container's Node
path and not the running host Pi's unrelated Node version:

```sh
pnpm install:format-hook
pnpm format:staged
pnpm test:format-hook  # actual agent session; preserves identity/policy metadata
pnpm check:hooks
pnpm test:hooks
```

The installer verifies the existing attribution hook hashes against
`config/foundation.json` first. It adds only the repository-local
`$(git rev-parse --absolute-git-dir)/hooks/prepare-commit-msg`. The installed upstream
`prepare-commit-msg` explicitly chains this hook **before** assistance/DCO handling
and propagates its refusal. Global `core.hooksPath`, upstream hook bytes and Git
identity remain unchanged. No Husky, new hook manager or lifecycle install script.

The shim records the absolute approved Node executable and invokes the versioned
TypeScript source with Node's supported type stripping; it does not download tools,
need a prior Workbench build, or fall back to another Node/Biome. Fresh hosts need
explicit toolchain/hook setup first. Install separately in each linked worktree:
upstream chaining follows that worktree's actual Git directory.

Repeated installation with the identical shim is a no-op. An existing different
repo-local hook is **not overwritten, backed out or bypassed**; stop and review
composition separately. A Node path upgrade similarly needs deliberate review.
Never respond to a hook refusal by skipping verification or changing attribution.

## What happens at commit time

- Inspect added/copied/modified/renamed **index blobs**, not working-tree contents.
  Deletions need no formatting. Reject conflicts and symlink/nonregular code entries.
- Check TypeScript/JavaScript variants, JSON/JSONC, CSS and GraphQL with Biome's
  formatter. This does not introduce Python, shell, Markdown or YAML formatters.
- Verify Node and installed Biome versions, using the exact package pin. Require
  the staged and working copies of `package.json`, `config/foundation.json`,
  `biome.json` and `pnpm-lock.yaml` to agree before using their configuration/tools.
- Refuse unformatted or syntactically invalid staged source. Provide a correction
  instruction and preserve the index and worktree, including partial staging.
- Never run `git add`, stash, rewrite source or touch the commit message. Automatic
  whole-file restaging would accidentally include unstaged work; formatting is
  therefore deliberately **check-only** in the hook.

To correct a refusal, use the pinned toolchain:

```sh
pnpm exec biome format --write path/to/intended-file.ts
# Review changes and stage the intended hunks; do not blindly add every file.
git diff -- path/to/intended-file.ts
git add -p -- path/to/intended-file.ts
```

Restore or stage the intended configuration first if configuration itself is
partially staged. Missing/stale tools block formatting rather than install silently.
The initial helper caps batches at 500 supported files, individual command output
at 4 MiB, Git operations at 10 seconds and formatter operations at 15 seconds.
These are per-operation limits, not aggregate host quotas.

## Declaration spacing

Use a blank line between top-level interface/type declarations and neighboring
logical declarations. Biome 2.5.12 **preserves** such blank lines but does not insert
missing ones; its configuration schema has no declaration-padding option. The
configured two-space indentation is unrelated. A direct formatter probe confirmed
that both adjacent interfaces and blank-line-separated interfaces remain unchanged.

This convention currently needs source review. The staged Biome check does **not**
enforce it; automatic enforcement would require a separately tested lint rule.
Do not assume that a green formatter establishes every readability convention.

## Verification and recovery

Six ordinary fixture tests run with `pnpm check`. The seventh test deliberately
requires `pnpm test:format-hook` in the real session: a disposable repository checks
rejection, correction, attributed commit, idempotent install, unchanged upstream
hooks and preservation of an existing refusing hook. It never sets a fake identity
or fabricates assistance/sign-off trailers. Existing `pnpm test:hooks` separately
exercises attributed commit/push, agent-deny and chained-hook rejection.

A formatting gate cannot make candidate code trusted or prove human review. Tool
version checks do not attest an installed binary; frozen dependency integrity,
source policy, cache trust and audit remain separate foundation requirements.

For removal, identify the installed repo-local shim and inspect that it still
matches this installer before explicitly removing **only that file**. Leave global
attribution hooks/settings and any unrelated local hooks intact. Do not remove a
refusing hook as a workaround. Changing branches to code without the formatter
source may block commits until the intended reviewed setup is restored.
