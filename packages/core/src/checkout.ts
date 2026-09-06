import assert from "node:assert/strict";
import { realpathSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";
import { simpleGit } from "simple-git";

export interface Checkout {
  root: string;
  gitDir: string;
  commonDir: string;
  commonIdentity: string;
  revision: string;
  branch: string | null;
}

/** Read-only Git observations, not an atomic snapshot or execution permission. */
export async function inspectCheckout(path: string): Promise<Checkout> {
  assert.ok(isAbsolute(path), "absolute checkout root required");
  assert.ok(!/[\p{Cc}]/u.test(path), "control character in checkout path");
  const root = realpathSync(path);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 5_000);
  let bytes = 0,
    detachedAllowed = false;
  const git = simpleGit({
    baseDir: root,
    binary: "/usr/bin/git",
    maxConcurrentProcesses: 1,
    trimmed: false,
    abort: abort.signal,
    errors: (error, result) =>
      result.exitCode !== 0 && !(detachedAllowed && result.exitCode === 1)
        ? new Error(
            "Git inspection failed (committed, non-bare checkout required)",
          )
        : error,
  })
    .env({
      PATH: "/usr/bin:/bin",
      LC_ALL: "C",
      GIT_CONFIG_NOSYSTEM: "1",
      HOME: "/dev/null",
      XDG_CONFIG_HOME: "/dev/null",
      GIT_TERMINAL_PROMPT: "0",
      GIT_OPTIONAL_LOCKS: "0",
      GIT_NO_REPLACE_OBJECTS: "1",
    })
    .outputHandler((_command, stdout, stderr) => {
      for (const stream of [stdout, stderr])
        stream.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 16 * 1024) abort.abort();
        });
    });
  try {
    const paths = await git.raw([
      "rev-parse",
      "--path-format=absolute",
      "--show-toplevel",
      "--git-dir",
      "--git-common-dir",
    ]);
    assert.ok(paths.endsWith("\n"), "malformed Git paths");
    const parts = paths.slice(0, -1).split("\n");
    assert.equal(parts.length, 3, "malformed Git paths");
    const [top, gitPath, commonPath] = parts;
    assert.ok(top && gitPath && commonPath);
    assert.equal(
      realpathSync(top),
      root,
      "use the checkout root, not a subdirectory",
    );
    const gitDir = realpathSync(gitPath),
      commonDir = realpathSync(commonPath);
    assert.ok(
      !/[\p{Cc}]/u.test(gitDir + commonDir),
      "control character in Git path",
    );
    const common = statSync(commonDir, { bigint: true });
    assert.ok(common.isDirectory(), "Git common directory required");
    const revision = await git.revparse(["--verify", "HEAD^{commit}"]);
    assert.match(
      revision,
      /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/,
      "invalid revision",
    );
    detachedAllowed = true;
    const branch =
      (await git.raw(["symbolic-ref", "--quiet", "HEAD"])).replace(/\n$/, "") ||
      null;
    assert.ok(!abort.signal.aborted, "Git inspection exceeded limits");
    assert.ok(
      branch === null ||
        (branch.startsWith("refs/heads/") && !/[\p{Cc}]/u.test(branch)),
      "invalid branch",
    );
    return {
      root,
      gitDir,
      commonDir,
      commonIdentity: `${common.dev}:${common.ino}`,
      revision,
      branch,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function sameCheckout(
  expected: Checkout,
  actual: Checkout,
  revision = true,
): void {
  const fields: (keyof Checkout)[] = [
    "root",
    "gitDir",
    "commonDir",
    "commonIdentity",
  ];
  if (revision) fields.push("revision", "branch");
  for (const field of fields)
    assert.equal(actual[field], expected[field], `checkout drift: ${field}`);
}
