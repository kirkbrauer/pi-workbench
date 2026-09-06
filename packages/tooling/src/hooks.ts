import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  accessSync,
  constants,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const pins = JSON.parse(
  readFileSync(
    new URL("../../../../config/foundation.json", import.meta.url),
    "utf8",
  ),
);

function git(args: string[], cwd = process.cwd(), expected = 0): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 15000,
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    expected,
    `git ${args.join(" ")}: ${result.stderr}`,
  );
  return result.stdout.trim();
}

const hooks = resolve(git(["config", "--path", "--get", "core.hooksPath"]));
for (const [name, digest] of Object.entries(pins.hooks.files)) {
  const path = join(hooks, name);
  accessSync(path, constants.X_OK);
  assert.equal(
    createHash("sha256").update(readFileSync(path)).digest("hex"),
    digest,
    `${name}: installed hook drift; review, do not replace automatically`,
  );
}
console.log(`installed hook hashes match ${pins.hooks.revision}`);
if (process.argv.includes("--exercise")) {
  const root = mkdtempSync(join(tmpdir(), "pi-workbench-hooks-"));
  try {
    // Inherit real identity, attribution environment and policy. No overrides or bypasses.
    git(["init", "-b", "feat/hook-probe", root]);
    assert.equal(
      resolve(git(["config", "--path", "--get", "core.hooksPath"], root)),
      hooks,
    );
    const repo = join(root, "remote.git");
    git(["init", "--bare", repo]);
    git(
      [
        "commit",
        "--allow-empty",
        "-m",
        "test: disposable Workbench hook probe",
      ],
      root,
    );
    const message = git(["log", "-1", "--format=%B"], root);
    const author = git(["show", "-s", "--format=%an <%ae>"], root);
    assert.ok(
      message.includes(`Signed-off-by: ${author}`),
      "hook did not supply DCO; hand back for human certification",
    );
    assert.match(
      message,
      /^Assisted-by: \S+/m,
      "run exercise inside the actual agent session; no invented metadata",
    );
    git(["remote", "add", "origin", repo], root);
    git(["push", "origin", "HEAD:refs/heads/feat/hook-probe"], root);
    // Tighten ONLY this disposable repository to test the intended push rejection.
    git(["config", "--local", "attribution.push.agent", "deny"], root);
    const denied = spawnSync(
      "git",
      ["push", "origin", "HEAD:refs/heads/feat/denied"],
      { cwd: root, encoding: "utf8", timeout: 15000 },
    );
    assert.equal(denied.status, 1);
    assert.match(
      denied.stderr,
      /push refused: attribution.push.agent is 'deny'/,
    );
    assert.equal(
      git(
        [
          "--git-dir",
          repo,
          "for-each-ref",
          "--format=%(refname)",
          "refs/heads/feat/denied",
        ],
        root,
      ),
      "",
    );
    // Verify the installed prepare hook preserves a project's rejecting hook.
    writeFileSync(
      join(root, ".git/hooks/prepare-commit-msg"),
      "#!/bin/sh\necho workbench-fixture-denial >&2\nexit 1\n",
      { mode: 0o700 },
    );
    const before = git(["rev-parse", "HEAD"], root);
    const rejected = spawnSync(
      "git",
      ["commit", "--allow-empty", "-m", "test: expected local hook denial"],
      { cwd: root, encoding: "utf8", timeout: 15000 },
    );
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /workbench-fixture-denial/);
    assert.equal(git(["rev-parse", "HEAD"], root), before);
    console.log(
      "hook exercise pass: attributed commit, local feature push, agent-deny push, chained commit rejection; fixtures removed",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
