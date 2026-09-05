# Pi Workbench implementation handoff

Design baseline 1.27 • September 5, 2026

## Quick start

Give Pi PI-START-PROMPT.md in the selected implementation repository. Read CURRENT-STATE.md and FIRST-MILESTONE.md first; use REVIEW-HANDOFF.md when submitting a tier for review. Native Fedora VM testing is pending.

## Contents

- [DESIGN.md](DESIGN.md): authoritative architecture, D01–D31, contracts, examples, roadmap and validation gates.
- [mockup/index.html](mockup/index.html): open directly in a browser; standalone terminal interaction study.
- [mockup-source/](mockup-source/): editable source and dependency lockfile.
- [KATA-SPIKE.md](KATA-SPIKE.md): actual Fedora/Kind/OpenShell/Kata results, startup fixes and remaining gates.
- [IMPLEMENTATION-TIERS.md](IMPLEMENTATION-TIERS.md): GitHub review gates, beginning with hooks, CI, toolchains and sandbox setup.
- [BOOTSTRAP.md](BOOTSTRAP.md): dependency-ordered Pi build plan, bounded workflows and self-hosting gates.
- [PI-START-PROMPT.md](PI-START-PROMPT.md): initial implementation prompt.

The design is newer than the mockup. Later runtime, delegation, host permission, image catalog and team distribution decisions are specified in the design but are not all represented in mockup controls. The HTML uses real Pi components to generate ANSI frames, displayed with xterm; it is not a functioning Pi extension. All conversations, integrations, sessions, models and goals are simulated. No browser interaction QA has been performed. Original build/frame-width checks are documented in the source README.

## Start

Extract the ZIP into a new implementation directory. Open DESIGN.md and the mockup, then give Pi PI-START-PROMPT.md. Read §3, §4, §10–12 and §15–17 first. Keep this handoff as reference material; create production code in a separate source directory/repository. No credentials or internal endpoints are provided.

For mockup development, enter mockup-source and run `npm ci`, `npm run build`, then `npm run dev` (Node/npm and Python 3 required). Package installation executes dependency code; use the selected development environment. `node export.mjs` writes `dist/standalone.html`. The exported source adjusts the original exporter to write within its own directory so it is portable.

## First milestone

Validate pinned Pi extension/SDK/RPC APIs and the broker isolation boundary, then build the local vertical slice in §15. Prefer composable packages and a team launcher before a fork. Do not implement every provider at once. Private Belt contracts, exact corporate identities, runtime versions and device protocols still require validation. Latest upstream documents cited in the design may differ from the mockup's Pi 0.85.1 pin.

SHA256SUMS records every deliverable in this folder except itself. The archive contains no node_modules, Git metadata, live state or authentication material.
