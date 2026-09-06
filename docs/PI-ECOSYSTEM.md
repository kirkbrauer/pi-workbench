# Pi ecosystem choices for Workbench

Inspected on 2026-09-06 against the repository-pinned
`@earendil-works/pi-coding-agent` **0.85.0** package, its published unbundled
implementation and sibling package manifests. Also read installed Pi's full
README, development and skills documentation. No model/provider session,
third-party extension installation or global configuration change was needed.

| Concern | Observed Pi choice | Workbench decision |
|---|---|---|
| Tool/config schemas | `typebox` 1.3.7; `core/tools/*.js`, `core/model-config.js` use `Type` and compilation | Prefer the same TypeBox package for the next shared-action contracts; do not introduce another validator without a reason |
| Interactive terminal UI | `@earendil-works/pi-tui` 0.85.0, Chalk 5.6.2 | Reuse public Pi TUI/extension APIs when the UI tier arrives; no React/Ink dashboard now |
| CLI argument parsing | Custom parser in `dist/cli/args.js` | Commander 15.0.0 for Workbench's standalone subcommands/help/choices; Pi has no public reusable CLI parser to adopt |
| Git observations | Footer reads `.git`/HEAD and calls Git using Node process APIs | simple-git 3.36.0 around installed Git; avoid copying private footer internals or writing another process queue |
| Git URL parsing | `hosted-git-info` 9.0.3 in `dist/utils/git.js` | Reuse if a URL consumer is introduced; current registry never reads remote URLs or credentials |
| Process execution | `cross-spawn` 7.0.6 in child-process utility, Node `spawn` in `core/exec.js` | No general execution API in this slice; simple-git owns Git subprocesses; future broker execution needs its own reviewed contract |
| Text/config utilities | `diff` 8.0.4, `ignore` 7.0.5, `yaml` 2.9.0, `semver` 7.8.0 | Prefer the pinned existing choices as consumers appear; YAML already used by foundation tooling |
| Persistence | JSONL session trees; JSON settings/auth/trust with `proper-lockfile` 4.1.2 | Keep Pi's session manager authoritative for Pi sessions. Workbench's relational Work/Workspace registry uses SQLite as specified in DESIGN §9 |
| Tests | Coding-agent uses Vitest; pi-tui uses Node's test runner | Keep the existing Workbench Node tests; consistency does not require replacing working checks |
| Agent guidance | Agent Skills-standard frontmatter and on-demand `SKILL.md`, `/skill:name` | Add opt-in repository `skills/workbench/SKILL.md`; no global install or implied tool grants |

These are observed tools, not blanket endorsements or promises that private APIs
are stable. Commander/simple-git are deliberate Workbench choices, **not claims
about Pi's dependencies**. Both releases predate the 24-hour quarantine and are
exactly pinned; the install adds six registry records (285 total), without install
scripts or changes to source/peer/audit policy.

The published development guide describes remote client/protocol packages as
excluded development-only pieces, while the inspected 0.85.0 manifest includes
runtime dependencies and client/plugin exports. Treat that documentation/package
mismatch as unresolved; do not build on an assumed stable remote harness API.
Production core uses neither those exports nor private Pi imports.

A fresh isolated Node 22.23.2 probe of the public SDK **failed**:

```sh
# Run only from the trusted pinned checkout, with an empty HOME and no credentials:
node --input-type=module -e 'await import("@earendil-works/pi-coding-agent")'
```

`dist/experimental/server.js` imports undeclared `@earendil-works/pi-server`, causing
`ERR_MODULE_NOT_FOUND`. The initial full-check log retains this failed SDK attempt;
no missing dependency is injected, package patched, or successful SDK integration
claimed. Public SDK use remains blocked pending a separately reviewed upstream fix.

The skill test therefore inspects only `dist/core/skills.js` in the pinned package,
in an isolated child process. It still requires the real Workbench skill to load
without diagnostics and the malformed fixture to be rejected. This is explicitly a
**private, pin-bound test inspection**, not a reusable production dependency or proof
of CLI/session/SDK integration. Review this test boundary separately from product
code; a passing loader test does not erase the failed public-SDK probe.

No library permission UI or skill replaces Workbench's eventual broker authority
boundary. Library reuse should remove plumbing, not import host credentials,
mutable global state, unsafe-operation overrides or unreviewed execution behavior.
Full bundle assembly and ecosystem-wide package selection are deferred.
