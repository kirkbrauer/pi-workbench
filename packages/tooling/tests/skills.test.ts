import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

// Pinned implementation inspection only, not a public-SDK integration test.
// Pi 0.85.0's public SDK import fails on undeclared pi-server; see PI-ECOSYSTEM.md.
test("pinned Pi skill implementation accepts Workbench and rejects missing descriptions", (t) => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "workbench-skill-")));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const inspect = (directory: string) => {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      const loader = new URL("./core/skills.js", import.meta.resolve("@earendil-works/pi-coding-agent"));
      const { loadSkillsFromDir, formatSkillsForPrompt } = await import(loader.href);
      const result = loadSkillsFromDir({ dir: process.argv[1], source: "explicit-fixture" });
      console.log(JSON.stringify({ ...result, prompt: formatSkillsForPrompt(result.skills) }));
    `,
        directory,
      ],
      {
        cwd: root,
        env: {
          HOME: home,
          PATH: "/usr/bin:/bin",
          PI_OFFLINE: "1",
          PI_TELEMETRY: "0",
          PI_SKIP_VERSION_CHECK: "1",
        },
        encoding: "utf8",
        timeout: 10_000,
        maxBuffer: 64 * 1024,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const actual = inspect(join(root, "skills"));
  assert.deepEqual(actual.diagnostics, []);
  assert.equal(actual.skills.length, 1);
  assert.equal(actual.skills[0].name, "workbench");
  assert.equal(
    actual.skills[0].filePath,
    realpathSync(join(root, "skills/workbench/SKILL.md")),
  );
  assert.match(actual.prompt, /<name>workbench<\/name>/);
  const invalid = join(home, "invalid");
  mkdirSync(invalid);
  writeFileSync(
    join(invalid, "SKILL.md"),
    "---\nname: invalid\n---\nMissing description fixture\n",
  );
  const rejected = inspect(invalid);
  assert.equal(rejected.skills.length, 0);
  assert.ok(rejected.diagnostics.length > 0);
});
