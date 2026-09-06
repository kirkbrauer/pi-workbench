import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";

const LIMIT = 4 * 1024 * 1024;
const SOURCE = "packages/tooling/src/format-staged.ts";
const FORMATTABLE = /\.(?:[cm]?[jt]sx?|jsonc?|css|graphql|gql)$/;
function git(root: string, args: string[]): Buffer {
  return execFileSync("git", args, {
    cwd: root,
    timeout: 10_000,
    maxBuffer: LIMIT,
  });
}
function records(bytes: Buffer): string[] {
  const value = bytes.toString("utf8");
  assert.ok(
    Buffer.from(value).equals(bytes),
    "non-UTF-8 Git paths are unsupported",
  );
  return value.split("\0").filter(Boolean);
}
function blob(root: string, path: string): Buffer {
  return git(root, ["show", `:${path}`]);
}
function unchangedConfiguration(root: string, path: string): Buffer {
  const staged = blob(root, path);
  assert.ok(
    staged.equals(readFileSync(join(root, path))),
    `${path} differs between index and worktree; stage or restore its intended configuration first`,
  );
  return staged;
}
function pins(root: string) {
  const foundation = JSON.parse(
    unchangedConfiguration(root, "config/foundation.json").toString("utf8"),
  );
  const pkg = JSON.parse(
    unchangedConfiguration(root, "package.json").toString("utf8"),
  );
  assert.equal(
    process.versions.node,
    foundation.node,
    "use the pinned Node for formatting hooks",
  );
  assert.equal(pkg.engines.node, foundation.node);
  assert.match(pkg.devDependencies["@biomejs/biome"], /^\d+\.\d+\.\d+$/);
  return { foundation, biome: pkg.devDependencies["@biomejs/biome"] as string };
}

/** Check INDEX blobs only. Never write files, stash, restage, or alter messages. */
export function checkStagedFormatting(root: string): number {
  assert.equal(
    git(root, ["ls-files", "--unmerged", "-z"]).length,
    0,
    "resolve index conflicts first",
  );
  const paths = records(
    git(root, ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]),
  ).filter((path) => FORMATTABLE.test(path));
  if (!paths.length) return 0;
  assert.ok(paths.length <= 500, "formatting hook batch exceeds 500 files");
  const { biome } = pins(root);
  unchangedConfiguration(root, "biome.json");
  unchangedConfiguration(root, "pnpm-lock.yaml");
  const installed = JSON.parse(
    readFileSync(
      join(root, "node_modules/@biomejs/biome/package.json"),
      "utf8",
    ),
  );
  assert.equal(
    installed.version,
    biome,
    "installed Biome differs from the exact pin",
  );
  const executable = join(root, "node_modules/@biomejs/biome/bin/biome");
  const invoke = (args: string[], input?: Buffer) =>
    execFileSync(process.execPath, [executable, ...args], {
      cwd: root,
      stdio: "pipe",
      timeout: 15_000,
      maxBuffer: LIMIT,
      ...(input ? { input } : {}),
    });
  assert.equal(
    invoke(["--version"]).toString("utf8").trim(),
    `Version: ${biome}`,
  );
  const modes = new Map(
    records(git(root, ["ls-files", "--stage", "-z"])).map((record) => {
      const tab = record.indexOf("\t");
      return [record.slice(tab + 1), record.slice(0, 6)];
    }),
  );
  const failures: string[] = [];
  for (const path of paths) {
    assert.ok(
      ["100644", "100755"].includes(modes.get(path) ?? ""),
      `refusing nonregular staged source: ${JSON.stringify(path)}`,
    );
    const input = blob(root, path);
    const formatted = invoke(
      [
        "format",
        `--stdin-file-path=${path}`,
        `--config-path=${join(root, "biome.json")}`,
      ],
      input,
    );
    if (!formatted.equals(input)) failures.push(path);
  }
  assert.equal(
    failures.length,
    0,
    `Staged files need formatting: ${failures.map((path) => JSON.stringify(path)).join(", ")}. ` +
      "Run pinned pnpm exec biome format --write on the intended files, review the diff, then stage deliberately. " +
      "Partially staged work was not changed or restaged.",
  );
  return paths.length;
}

/** Upstream prepare-commit-msg explicitly chains this repo-local hook first. */
export function installFormattingHook(root: string): string {
  const { foundation } = pins(root);
  const hooksPath = git(root, ["config", "--path", "--get", "core.hooksPath"])
    .toString("utf8")
    .trim();
  assert.ok(
    isAbsolute(hooksPath),
    "inspect/install pinned upstream attribution hooks first",
  );
  for (const [name, expected] of Object.entries(foundation.hooks.files)) {
    const path = join(hooksPath, name);
    assert.ok(
      statSync(path).mode & 0o111,
      "attribution hook must be executable",
    );
    assert.equal(
      createHash("sha256").update(readFileSync(path)).digest("hex"),
      expected,
      "attribution hook drift: stop, do not overwrite or bypass it",
    );
  }
  const gitDir = git(root, ["rev-parse", "--absolute-git-dir"])
    .toString("utf8")
    .trim();
  const path = join(gitDir, "hooks", "prepare-commit-msg");
  assert.notEqual(
    join(hooksPath, "prepare-commit-msg"),
    path,
    "would replace attribution hook",
  );
  assert.ok(existsSync(join(root, SOURCE)), "formatter source is absent");
  const quote = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;
  const shim = `#!/bin/sh\n# pi-workbench: staged-format-check v1\nset -eu\nroot="$(git rev-parse --show-toplevel)"\nexec ${quote(process.execPath)} --experimental-strip-types "$root/${SOURCE}" check\n`;
  mkdirSync(join(gitDir, "hooks"), { recursive: true });
  if (existsSync(path)) {
    assert.equal(
      readFileSync(path, "utf8"),
      shim,
      "repo-local prepare-commit-msg already exists; preserve it and review composition separately",
    );
    assert.ok(
      statSync(path).mode & 0o111,
      "existing formatting hook is not executable",
    );
  } else {
    // Exclusive creation: never displace a hook, including a dangling symlink.
    writeFileSync(path, shim, { flag: "wx", mode: 0o755 });
  }
  return path;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    assert.equal(
      process.argv.length,
      3,
      "usage: format-staged.ts check|install",
    );
    const root = git(process.cwd(), ["rev-parse", "--show-toplevel"])
      .toString("utf8")
      .trim();
    if (process.argv[2] === "install")
      console.log(
        `Installed ${installFormattingHook(root)}; attribution hooksPath unchanged.`,
      );
    else {
      assert.equal(process.argv[2], "check");
      const count = checkStagedFormatting(root);
      if (count)
        console.log(
          `Staged formatting pass: ${count} files; index/worktree unchanged.`,
        );
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "formatting hook failed",
    );
    process.exitCode = 1;
  }
}
