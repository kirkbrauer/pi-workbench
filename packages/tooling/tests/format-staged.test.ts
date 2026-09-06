import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateTrailers } from "../src/commits.js";
import {
  checkStagedFormatting,
  installFormattingHook,
} from "../src/format-staged.js";

const checkout = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

function fixture(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(), "wb-format-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 15_000 });
  git("init", "-q");
  mkdirSync(join(root, "config"));
  for (const path of [
    "config/foundation.json",
    "package.json",
    "biome.json",
    "pnpm-lock.yaml",
  ]) {
    copyFileSync(join(checkout, path), join(root, path));
    git("add", "--", path);
  }
  symlinkSync(join(checkout, "node_modules"), join(root, "node_modules"));
  const stage = (path: string, value: string) => {
    writeFileSync(join(root, path), value);
    git("add", "--", path);
  };
  return { root, git, stage };
}

test("format hook checks staged code without changing index or worktree", (t) => {
  const { root, git, stage } = fixture(t);
  stage("example.ts", "const answer = 42;\n");
  const before = git("write-tree");
  assert.ok(checkStagedFormatting(root) >= 1);
  assert.equal(git("write-tree"), before);
  assert.equal(
    readFileSync(join(root, "example.ts"), "utf8"),
    "const answer = 42;\n",
  );
});

test("unformatted index is refused even when worktree is formatted; partial staging survives", (t) => {
  const { root, git, stage } = fixture(t);
  stage("partial.ts", "const answer=42;\n");
  writeFileSync(
    join(root, "partial.ts"),
    "const answer = 42;\n// unstaged work\n",
  );
  const beforeIndex = git("write-tree");
  const beforeWork = readFileSync(join(root, "partial.ts"));
  assert.throws(
    () => checkStagedFormatting(root),
    /Staged files need formatting/,
  );
  assert.equal(git("write-tree"), beforeIndex);
  assert.ok(readFileSync(join(root, "partial.ts")).equals(beforeWork));
});

test("formatted index is accepted independently of unstaged source edits", (t) => {
  const { root, git, stage } = fixture(t);
  stage("partial.ts", "const answer = 42;\n");
  writeFileSync(join(root, "partial.ts"), "const answer=43;\n");
  const before = git("write-tree");
  assert.ok(checkStagedFormatting(root) > 0);
  assert.equal(git("write-tree"), before);
  assert.equal(
    readFileSync(join(root, "partial.ts"), "utf8"),
    "const answer=43;\n",
  );
});

test("staged configuration must match worktree; pinned tools cannot silently drift", (t) => {
  for (const path of [
    "biome.json",
    "package.json",
    "config/foundation.json",
    "pnpm-lock.yaml",
  ]) {
    const { root, stage } = fixture(t);
    stage("example.ts", "const answer = 42;\n");
    writeFileSync(
      join(root, path),
      `${readFileSync(join(root, path), "utf8")}\n`,
    );
    assert.throws(
      () => checkStagedFormatting(root),
      /differs between index and worktree/,
    );
  }
  const { root, stage } = fixture(t);
  stage("example.ts", "const answer = 42;\n");
  // Remove only the fixture's symlink, never mutate the shared tool installation.
  rmSync(join(root, "node_modules"));
  mkdirSync(join(root, "node_modules/@biomejs/biome"), { recursive: true });
  writeFileSync(
    join(root, "node_modules/@biomejs/biome/package.json"),
    '{"version":"0.0.0"}',
  );
  assert.throws(() => checkStagedFormatting(root), /installed Biome differs/);
});

test("syntax errors and symlinks cannot pass as formatted code; spaces in paths are safe", (t) => {
  const { root, git, stage } = fixture(t);
  stage("space name.ts", "const answer = 42;\n");
  assert.ok(checkStagedFormatting(root) > 0);
  stage("bad.ts", "const = ;\n");
  assert.throws(() => checkStagedFormatting(root));
  git("rm", "-f", "--", "bad.ts");
  symlinkSync("space name.ts", join(root, "alias.ts"));
  git("add", "--", "alias.ts");
  assert.throws(() => checkStagedFormatting(root), /nonregular staged source/);
});

test("deletions and unsupported file types need no formatter and do not invoke installers", (t) => {
  const { root, git, stage } = fixture(t);
  git("read-tree", "--empty");
  stage("note.md", "# synthetic markdown\n");
  stage("script.py", "print( 'unchanged' )\n");
  assert.equal(checkStagedFormatting(root), 0);
});

test("actual-session formatting hook chains through untouched upstream attribution", {
  skip: process.env.WORKBENCH_EXERCISE_FORMAT_HOOK !== "1",
}, (t) => {
  const { root, git, stage } = fixture(t);
  const source = "packages/tooling/src/format-staged.ts";
  mkdirSync(dirname(join(root, source)), { recursive: true });
  copyFileSync(join(checkout, source), join(root, source));
  const hooksPath = git("config", "--path", "--get", "core.hooksPath").trim();
  const upstreamBefore = ["prepare-commit-msg", "pre-push"].map((name) =>
    readFileSync(join(hooksPath, name)),
  );
  const installed = installFormattingHook(root);
  assert.equal(installFormattingHook(root), installed);
  stage("example.ts", "const answer=42;\n");
  const before = git("write-tree");
  const commit = () =>
    spawnSync(
      "git",
      ["commit", "-q", "-m", "format hook integration fixture"],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 30_000,
      },
    );
  const rejected = commit();
  assert.equal(rejected.error, undefined);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /Staged files need formatting/);
  assert.equal(git("write-tree"), before);
  stage("example.ts", "const answer = 42;\n");
  const accepted = commit();
  assert.equal(accepted.status, 0, accepted.stderr);
  const message = git("log", "-1", "--format=%B");
  assert.match(message, /^Assisted-by:/m);
  const author = git("log", "-1", "--format=%an <%ae>").trim();
  const trailers = execFileSync("git", ["interpret-trailers", "--parse"], {
    input: message,
    encoding: "utf8",
  });
  assert.deepEqual(validateTrailers(author, trailers), []);
  assert.equal(
    git("config", "--path", "--get", "core.hooksPath").trim(),
    hooksPath,
  );
  for (const [index, name] of ["prepare-commit-msg", "pre-push"].entries())
    assert.ok(
      readFileSync(join(hooksPath, name)).equals(upstreamBefore[index]!),
    );
  // A pre-existing repository hook is never displaced, even if it refuses commits.
  const refusal = "#!/bin/sh\necho existing-project-refusal >&2\nexit 49\n";
  writeFileSync(installed, refusal, { mode: 0o755 });
  assert.throws(() => installFormattingHook(root), /already exists/);
  assert.equal(readFileSync(installed, "utf8"), refusal);
  stage("example.ts", "const answer = 43;\n");
  const refused = commit();
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /existing-project-refusal/);
});
