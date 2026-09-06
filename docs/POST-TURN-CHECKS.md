# Lightweight post-turn development checks

Requested by Kirk, 2026-09-06. **Proposed next tooling increment; not installed or
active in this session.** Keep implementation separate from the ORM/schema PR.
This is a developer feedback loop, not Workbench's worker or workflow engine.

## Reuse Pi lifecycle events

[Claude Code hooks](https://code.claude.com/docs/en/hooks.md) distinguish post-tool
feedback, a post-tool-batch boundary, and Stop feedback that can continue a response.
We need that small subset, not a general clone of its hooks system.

Pi already exposes public extension events and model-visible custom messages:

- `tool_result`: record attempted mutation paths. Preserve the original tool result,
  including errors; a failed command may still have changed files. Do not run a
  compiler once per edit or while parallel sibling edits are unfinished.
- `turn_end`: after the response and its tool batch, coalesce changed paths and await
  selected checks. Send a compact custom message with `pi.sendMessage`, not an
  impersonated user message, a UI-only notification, or raw session-file writes.
- A natural next model turn should receive the diagnostics. If the agent is otherwise
  finishing with unresolved failures, allow a bounded repair continuation. Pi's
  `agent_end` is not a literal Claude Stop veto: automatic retries/follow-ups may still
  remain. `agent_settled` is useful for final status, not the primary edit-check trigger.
- `session_shutdown`, abort, reload and session replacement cancel owned work and
  invalidate pending delivery. Never publish old-session results into a new context.

Inspected installed Pi 0.85.1 documentation and pinned 0.85.0 implementation; the
extension/package/session-format documents match between them. The pinned session
implementation awaits turn-end extension dispatch and flushes queued context-only
custom messages after tool results. This is source inspection, **not live extension
qualification**. Test actual CLI event ordering and feedback with a fixture provider
before enabling it. The known 0.85.0 public-SDK import failure remains recorded; do
not infer either extension failure or success from that separate import path.

## Small initial scope

Two cooperating opt-in plugins: LSP diagnostics and post-turn checks. Keep the LSP
adapter usable independently; the post-turn plugin consumes its diagnostic reports
alongside a testable CLI scope planner/check runner and versioned repository configuration. No standalone daemon, watcher service, new broker, automatic
installation or worktree management. Optional language servers are session-owned
processes, not globally installed services. Initial command registrations can provide status, rerun and pause;
no new TUI component is needed.

| Changed inputs | Checks |
|---|---|
| Supported JS/TS/JSON files | Biome check for those files; ESLint for applicable JS/TS |
| Package source/tests/types | Whole-project TypeScript check, including affected dependents—not standalone `tsc file.ts` |
| Core schema, migrations or Drizzle config | Migration-history check plus relevant generator/schema/upgrade regression tests against fixtures |
| Root lint/format/TS config or package graph | Broaden to affected workspace checks; report changed check definitions explicitly |
| No relevant changes | No command; do not report unchecked scopes as passing |

Reuse the pinned Corepack/pnpm commands and root lint policy. Do not start Drizzle
Studio, run `push`/migrations against the user's registry, install dependencies, access
credentials, commit, stage or push as a check hook. Dependency/audit and full CI gates
remain in their existing explicit workflow, not after every keystroke.

Track content changes, not just whether a path was dirty versus HEAD: already-dirty
files can change again. Include creates/deletes/renames and a bounded reconciliation
of configured source scopes for Bash/custom-tool/external-editor changes; parsing shell
text or listening only to Edit/Write is insufficient. If discovery is incomplete,
report incomplete scope rather than green. Keep the tracker independent of commit or
review identity so a future JJ adapter is not blocked by Git-only dirty detection.

## Language-server feedback

Kirk also requested TypeScript LSP integration, with room for other languages.
Use one diagnostic pipeline with two complementary sources:

1. **Language server:** low-latency syntax/semantic diagnostics with exact ranges,
   diagnostic codes, related locations and project context after an edit batch.
2. **CLI checks:** authoritative project typechecking, lint/format policy and fixture
   DB/migration checks. LSP diagnostics are not a replacement for these gates.

Start with TypeScript; keep a small language-adapter boundary for other approved
servers rather than special-case the feedback loop around `.ts` files. Inspect
existing Pi integrations and maintained LSP clients before selecting dependencies;
do not handwrite JSON-RPC/LSP framing. TypeScript's `tsserver` protocol is not itself
LSP: verify a maintained bridge or compatible native server against compiler **7.0.2**.
Pin the chosen server and its actual compiler/project configuration. The isolated
TypeScript 6.0.3 ESLint parser dependency is not an acceptable silent LSP fallback.
No language-server package or compatibility claim is introduced by this document.

Required behavior:

- Start only explicitly configured servers, lazily, for the correct workspace root
  and language. Keep profile/root identities separate; no automatic plugin downloads,
  global installs, IDE socket discovery or attaching to arbitrary existing servers.
- Synchronize the content actually edited using the server's negotiated document-sync
  capabilities. Track document versions, open/change/close and file create/delete/
  rename notifications. A disk-backed client cannot claim knowledge of unsaved IDE
  buffers; do not overwrite them or confuse their diagnostics with disk-based checks.
- Support negotiated push/pull diagnostics, position encoding and project scope.
  Dependency edits can change diagnostics in untouched files. Open-file-only results
  must not be represented as whole-workspace validation.
- Preserve provenance: server/compiler version, workspace/project, document URI and
  version/content observation, code, severity, range and related information. Normalize
  these into the same model-facing report as CLI failures, while retaining the source
  when reports are deduplicated. Do not silently promote/demote severity or drop errors.
- Reject obsolete document versions and discard results after workspace/session changes.
  Versionless push diagnostics have weaker freshness guarantees; a debounce delay does
  not prove completion. Report pending/unknown/stale explicitly. An empty diagnostic
  list, an uninitialized server or a timed-out request is **not a typecheck pass**.
- Let configuration distinguish required checks from supplementary LSP coverage.
  Required diagnostics/checks that are unavailable remain unresolved, not successful;
  failures use the same bounded repair loop. Final completion still requires the CLI
  gates over current inputs. Hook exhaustion returns an unresolved result to the user.
- Bound requests, message/output sizes and restarts; cancellation/shutdown closes only
  owned resources. Language servers and plugins execute host code, not sandboxed
  workers. Treat their diagnostics as data, not permission to execute a suggested command.

Diagnostics first. Hover/definition/reference tools can follow using the same adapter.
Do not automatically apply LSP code actions, `workspace/applyEdit`, formatting or
`workspace/executeCommand`: those are mutations/execution requiring separate explicit
scope, version checks and coordination with existing file writers.

## Feedback and bounds

- Check-only by default. An explicitly enabled formatter/fixer must be separately
  identified as a writer, avoid concurrent edits, recheck afterward and never restage
  partially staged files. Preserve pre-existing dirty work.
- Coalesce duplicate edits; one check batch per relevant turn. Serialize overlapping
  project checks. Bound process time, output capture and model-visible diagnostics;
  distinguish failure, timeout, cancellation, missing tool, stale result and skip.
- Bind results to the observed input set, check/config digest and toolchain, not HEAD
  alone. Compare before/after input observations; invalidate results when inputs move.
  Such observations are not an atomic snapshot or execution approval.
- Quiet, compact success; failures include check ID, scope, command, exit status,
  actionable diagnostics and a private bounded log reference when needed. Treat command
  output as untrusted diagnostic data, not fresh instructions or authorization.
- Deduplicate identical reports. Allow at most two hook-triggered repair continuations
  per genuine user request; don't reset the allowance on `agent_start` or every edit.
  No automatic retry after user abort or provider failure. Exhaustion leaves a visible
  unresolved status and returns control to the user, never a fabricated pass.
- Review/opt in to the command configuration. A model edit to hook/check definitions
  must not silently authorize new commands or turn disabled checks into success.
  Loading an extension executes host code: these controls are workflow safeguards,
  **not confinement** of candidate scripts or a substitute for project trust.

## Acceptance

Fixture tests should prove correct scope/dependent selection, read-only no-op turns,
parallel edit coalescing, repeated edits to already-dirty files, Bash-created and
untracked files, deletion/rename handling, limits/cancellation, stale-result rejection,
configuration-change detection, loop-budget exhaustion, and preserved tool failures.
For LSP, add out-of-order/versionless diagnostics, empty/pending responses, unsaved-
buffer versus disk separation, cross-file errors, position encodings, server crash/
restart and workspace-switch fixtures. Qualify the actual TypeScript server/compiler
pair on a real fixture project; protocol mocks alone cannot prove compatibility.
A no-network/no-paid-model CLI fixture must demonstrate that failure reaches the next
model request, a repair is rechecked, success does not start another turn, and an abort
or session change prevents stale feedback. Mock handler tests alone are insufficient.

Ship a package README and opt-in task guidance. Do not reload the running host Pi or
change global settings as part of implementation. Retain `pnpm check`, audit,
attribution hooks and hosted review gates unchanged in authority.
