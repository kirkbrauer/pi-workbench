import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { simpleGit } from "simple-git";
import { inspectCheckout } from "../src/checkout.js";
import { Registry } from "../src/registry.js";

const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));

async function fixture(t: TestContext) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "workbench-core-")));
  const opened = new Set<Registry>();
  t.after(() => {
    for (const registry of opened) registry.close();
    rmSync(root, { recursive: true, force: true });
  });
  const checkout = join(root, "checkout"),
    second = join(root, "second");
  const state = join(root, "state");
  mkdirSync(checkout);
  const git = simpleGit({ baseDir: checkout, binary: "/usr/bin/git" }).env({
    PATH: "/usr/bin:/bin",
    GIT_CONFIG_NOSYSTEM: "1",
    HOME: "/dev/null",
    XDG_CONFIG_HOME: "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
  });
  await git.init(false, ["--initial-branch=main"]);
  const empty = join(root, "empty");
  writeFileSync(empty, "");
  const tree = (
    await git.raw(["hash-object", "-t", "tree", "-w", empty])
  ).trim();
  // Raw synthetic objects only: no git commit/push, identity override or attribution claim.
  const commitFile = join(root, "synthetic-commit");
  const commit = async (message: string, parent?: string) => {
    writeFileSync(
      commitFile,
      `tree ${tree}\n${parent ? `parent ${parent}\n` : ""}author Synthetic Fixture <fixture@example.invalid> 1 +0000\ncommitter Synthetic Fixture <fixture@example.invalid> 1 +0000\n\n${message}\n`,
    );
    return (
      await git.raw(["hash-object", "-t", "commit", "-w", commitFile])
    ).trim();
  };
  const first = await commit("first"),
    next = await commit("next", first);
  await git.raw(["update-ref", "refs/heads/main", first]);
  await git.raw(["worktree", "add", "--detach", second, first]);
  const open = (
    directory = state,
    profile: "personal" | "work" = "personal",
    create = true,
  ) => {
    const registry = new Registry(directory, profile, create);
    opened.add(registry);
    return registry;
  };
  const close = (registry: Registry) => {
    registry.close();
    opened.delete(registry);
  };
  return { root, checkout, second, state, git, first, next, open, close };
}

function invoke(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    env: { PATH: "/usr/bin:/bin", ...env },
    encoding: "utf8",
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });
}

test("two independent Git worktrees share repository identity and reopen with stable IDs", async (t) => {
  const f = await fixture(t),
    registry = f.open();
  const work = registry.createWork(
    "Implement registry",
    "Resume development without reconstructing context",
  );
  const one = await registry.adopt(work.id, f.checkout),
    two = await registry.adopt(work.id, f.second);
  assert.notEqual(one.id, two.id);
  assert.equal(one.repositoryId, two.repositoryId);
  assert.equal(one.branch, "refs/heads/main");
  assert.equal(two.branch, null);
  writeFileSync(join(f.checkout, "dirty.txt"), "first workspace");
  writeFileSync(join(f.second, "dirty.txt"), "second workspace");
  const selected = await registry.select(two.id, 0);
  f.close(registry);
  const reopened = f.open(f.state, "personal", false);
  assert.deepEqual(await reopened.context(), selected);
  assert.equal(reopened.list().works[0]?.id, work.id);
  assert.equal(reopened.list().repositories.length, 1);
  assert.equal(
    readFileSync(join(f.checkout, "dirty.txt"), "utf8"),
    "first workspace",
  );
  assert.equal(
    readFileSync(join(f.second, "dirty.txt"), "utf8"),
    "second workspace",
  );
});

test("adoption is idempotent but cannot silently reassign a checkout or invent a Work", async (t) => {
  const f = await fixture(t),
    registry = f.open();
  const work = registry.createWork("One", "First objective"),
    other = registry.createWork("Two", "Second objective");
  const workspace = await registry.adopt(work.id, f.checkout);
  assert.equal((await registry.adopt(work.id, f.checkout)).id, workspace.id);
  await assert.rejects(registry.adopt(other.id, f.checkout), /another Work/);
  await assert.rejects(
    registry.adopt("work_00000000-0000-0000-0000-000000000000", "/nonexistent"),
    /unknown Work/,
  );
  assert.equal(registry.list().workspaces.length, 1);
});

test("profile stores reject mismatched reopening and foreign IDs without relabeling", async (t) => {
  const f = await fixture(t),
    personal = f.open(),
    work = f.open(join(f.root, "work-state"), "work");
  const objective = personal.createWork("Personal", "Not corporate context");
  const workspace = await personal.adopt(objective.id, f.checkout);
  assert.throws(() => new Registry(f.state, "work"), /profile mismatch/);
  await assert.rejects(work.adopt(objective.id, f.checkout), /unknown Work/);
  await assert.rejects(work.select(workspace.id, 0), /unknown workspace/);
  assert.deepEqual(work.list().works, []);
  assert.notEqual(personal.environmentId, work.environmentId);
  assert.equal((await personal.context()).generation, 0);
});

test("concurrent clients use compare-and-swap context generations", async (t) => {
  const f = await fixture(t),
    registry = f.open(),
    other = f.open();
  const work = registry.createWork(
    "Concurrent",
    "Only one selected context transition wins",
  );
  const one = await registry.adopt(work.id, f.checkout),
    two = await registry.adopt(work.id, f.second);
  const results = await Promise.allSettled([
    registry.select(one.id, 0),
    other.select(two.id, 0),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const failure = results.find((result) => result.status === "rejected");
  assert.ok(failure?.status === "rejected");
  assert.match(String(failure.reason), /stale context/);
  assert.equal((await registry.context()).generation, 1);
  await assert.rejects(other.select(one.id, 0), /stale context/);
});

test("HEAD drift blocks context restoration; explicit refresh preserves dirty source and IDs", async (t) => {
  const f = await fixture(t),
    registry = f.open();
  const work = registry.createWork(
    "Drift",
    "Explicitly accept new observations",
  );
  const workspace = await registry.adopt(work.id, f.checkout);
  await registry.select(workspace.id, 0);
  writeFileSync(join(f.checkout, "unpublished"), "preserve me");
  await f.git.raw(["update-ref", "refs/heads/main", f.next]);
  await assert.rejects(registry.context(), /checkout drift: revision/);
  await assert.rejects(registry.select(workspace.id, 1), /checkout drift/);
  const stored = registry.list();
  assert.equal(stored.context.generation, 1);
  assert.equal(stored.workspaces[0]?.revision, f.first);
  const refreshed = await registry.refresh(workspace.id, 1);
  assert.equal(refreshed.id, workspace.id);
  assert.equal(refreshed.revision, f.next);
  assert.equal((await registry.context()).generation, 2);
  await assert.rejects(registry.refresh(workspace.id, 1), /stale context/);
  assert.equal(
    readFileSync(join(f.checkout, "unpublished"), "utf8"),
    "preserve me",
  );
});

test("same-commit branch drift and replacement Git storage are not silently adopted", async (t) => {
  const f = await fixture(t),
    registry = f.open();
  const work = registry.createWork("Identity", "Reject checkout replacement");
  const workspace = await registry.adopt(work.id, f.checkout);
  await registry.select(workspace.id, 0);
  await f.git.raw(["update-ref", "refs/heads/other", f.first]);
  await f.git.raw(["symbolic-ref", "HEAD", "refs/heads/other"]);
  await assert.rejects(registry.context(), /checkout drift: branch/);
  await registry.refresh(workspace.id, 1);
  const before = statSync(join(f.checkout, ".git"), { bigint: true });
  const backup = join(f.root, "git-copy");
  cpSync(join(f.checkout, ".git"), backup, { recursive: true });
  rmSync(join(f.checkout, ".git"), { recursive: true });
  cpSync(backup, join(f.checkout, ".git"), { recursive: true });
  const after = statSync(join(f.checkout, ".git"), { bigint: true });
  t.diagnostic(
    JSON.stringify({
      inodeReused: before.dev === after.dev && before.ino === after.ino,
      birthtimeBefore: String(before.birthtimeNs),
      birthtimeAfter: String(after.birthtimeNs),
    }),
  );
  await assert.rejects(
    registry.refresh(workspace.id, 2),
    /checkout drift: commonIdentity/,
  );
  assert.equal(registry.list().context.generation, 2);
});

test("non-repositories, unborn and bare repositories and non-root paths fail", async (t) => {
  const f = await fixture(t);
  await assert.rejects(inspectCheckout(f.root), /Git inspection failed/);
  await assert.rejects(inspectCheckout("relative"), /absolute/);
  const subdirectory = join(f.checkout, "subdir");
  mkdirSync(subdirectory);
  await assert.rejects(inspectCheckout(subdirectory), /checkout root/);
  const unborn = join(f.root, "unborn"),
    bare = join(f.root, "bare");
  mkdirSync(unborn);
  mkdirSync(bare);
  await f.git.cwd(unborn).init();
  await f.git.cwd(bare).init(true);
  await assert.rejects(inspectCheckout(unborn), /Git inspection failed/);
  await assert.rejects(inspectCheckout(bare), /Git inspection failed/);
});

test("schema initialization/reopening is explicit; future and unrelated databases are retained", async (t) => {
  const f = await fixture(t);
  assert.throws(() => new Registry(f.state, "personal"), /ENOENT/);
  const registry = f.open();
  f.close(registry);
  const file = join(f.state, "registry.sqlite");
  const db = new DatabaseSync(file);
  db.exec("PRAGMA user_version=99");
  db.close();
  const before = readFileSync(file);
  assert.throws(
    () => new Registry(f.state, "personal", true),
    /unsupported registry schema/,
  );
  assert.deepEqual(readFileSync(file), before);
  const unrelated = join(f.root, "unrelated");
  mkdirSync(unrelated, { mode: 0o700 });
  const unrelatedFile = join(unrelated, "registry.sqlite"),
    foreign = new DatabaseSync(unrelatedFile);
  foreign.exec("CREATE TABLE unrelated (id INTEGER)");
  foreign.close();
  chmodSync(unrelatedFile, 0o600);
  assert.throws(
    () => new Registry(unrelated, "personal", true),
    /unrelated database/,
  );
  const empty = join(f.root, "empty-state");
  mkdirSync(empty, { mode: 0o700 });
  writeFileSync(join(empty, "registry.sqlite"), "", { mode: 0o600 });
  assert.throws(() => new Registry(empty, "personal"), /uninitialized/);
  const initialized = f.open(empty);
  assert.equal(initialized.list().context.generation, 0);
});

test("private storage modes, non-linked state and validated input are required", async (t) => {
  const f = await fixture(t),
    registry = f.open();
  assert.equal(statSync(f.state).mode & 0o777, 0o700);
  const file = join(f.state, "registry.sqlite");
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.throws(() => registry.createWork("", "objective"), /invalid text/);
  assert.throws(
    () => registry.createWork("name", "x".repeat(4001)),
    /invalid text/,
  );
  await assert.rejects(registry.select("not-an-id", 0), /invalid ID/);
  await assert.rejects(
    registry.select(
      "ws_00000000-0000-0000-0000-000000000000",
      Number.MAX_SAFE_INTEGER,
    ),
    /generation/,
  );
  const alias = join(f.root, "alias");
  symlinkSync(f.state, alias);
  assert.throws(() => new Registry(`${alias}/`, "personal"), /invalid state/);
  chmodSync(f.state, 0o755);
  assert.throws(() => new Registry(f.state, "personal"), /private state mode/);
  chmodSync(f.state, 0o700);
  const linked = join(f.root, "linked");
  mkdirSync(linked, { mode: 0o700 });
  linkSync(file, join(linked, "registry.sqlite"));
  assert.throws(() => new Registry(linked, "personal"), /invalid state/);
});

test("Commander supplies help, required options, choices and strict argument parsing", () => {
  const help = invoke(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /workspace/);
  assert.match(help.stdout, /--profile/);
  for (const args of [
    ["list"],
    ["--state", "/missing", "--profile", "invalid", "list"],
    ["--state", "/missing", "--profile", "personal", "list", "extra"],
    ["--wat"],
  ]) {
    const result = invoke(args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /error:/);
  }
});

test("CLI restores context across processes and ignores ambient Git/PATH redirection", async (t) => {
  const f = await fixture(t);
  const state = join(f.root, "cli-state"),
    args = ["--state", state, "--profile", "personal"];
  const bin = join(f.root, "bin"),
    sentinel = join(f.root, "executed");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "git"),
    `#!/bin/sh\n/usr/bin/touch '${sentinel}'\nexit 1\n`,
    { mode: 0o700 },
  );
  const env = {
    PATH: bin,
    GIT_DIR: "/nonexistent",
    GIT_WORK_TREE: f.second,
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "core.bare",
    GIT_CONFIG_VALUE_0: "true",
  };
  const call = (...command: string[]) => {
    const result = invoke([...args, ...command], env);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout).result;
  };
  call("init");
  const work = call(
    "work",
    "create",
    "CLI task",
    "Restore my selected checkout",
  );
  const workspace = call("workspace", "adopt", work.id, f.checkout);
  const selected = call("context", "select", workspace.id, "0");
  assert.deepEqual(call("context", "show"), selected);
  assert.equal(selected.workspace.root, f.checkout);
  assert.equal(existsSync(sentinel), false);
  const stale = invoke([...args, "context", "select", workspace.id, "0"]);
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /stale context generation/);
});
