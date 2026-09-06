import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  chownSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { BundleDescription } from "../src/bundle-inventory.js";
import {
  INVENTORY_LIMITS,
  inventoryDirectory,
  parseInventory,
  serializeInventory,
  sha256,
  validateBundleDescription,
  verifyBundleDirectory,
} from "../src/bundle-inventory.js";

function description(): BundleDescription {
  return {
    schema: 1,
    platform: "linux-x64-gnu",
    sourceRevision: "a".repeat(40),
    lockSha256: "b".repeat(64),
    foundationSha256: "c".repeat(64),
    components: ["workbench", "pi", "node"].map((id) => ({
      id,
      version: "1.2.3",
      sourceUrl: `https://example.invalid/${id}-1.2.3.tgz`,
      sourceSha256: "d".repeat(64),
      license: "MIT",
    })),
  };
}

function fixture(t: { after: (fn: () => void) => void }) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "wb-inventory-")));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = join(directory, "payload");
  mkdirSync(root, { mode: 0o700 });
  for (const id of ["workbench", "pi", "node"]) {
    mkdirSync(join(root, id), { mode: 0o700 });
    writeFileSync(join(root, id, "entry"), `synthetic ${id}\n`, {
      mode: 0o600,
    });
  }
  const snapshot = () =>
    Buffer.from(serializeInventory(inventoryDirectory(root, description())));
  return { directory, root, snapshot };
}

test("canonical inventory binds every staged file, component, mode and source input", (t) => {
  const { root, snapshot } = fixture(t);
  const bytes = snapshot();
  const result = verifyBundleDirectory(
    root,
    bytes,
    sha256(bytes),
    "linux-x64-gnu",
  );
  assert.equal(result.entries.length, 6);
  assert.deepEqual(
    result.components.map((item) => item.id),
    ["node", "pi", "workbench"],
  );
  assert.equal(result.sourceRevision, description().sourceRevision);
  assert.equal(result.lockSha256, description().lockSha256);
  assert.equal(result.foundationSha256, description().foundationSha256);
  assert.ok(snapshot().equals(bytes));
  // Timestamps, source directory, traversal order and caller component order
  // are not identities. A second staged tree with the same bytes/modes matches.
  const other = fixture(t);
  assert.ok(other.snapshot().equals(bytes));
});

test("digest and expected platform are external requirements, checked before scanning payload", (t) => {
  const { directory, snapshot } = fixture(t);
  const bytes = snapshot();
  const missing = join(directory, "absent");
  assert.throws(
    () =>
      verifyBundleDirectory(missing, bytes, "0".repeat(64), "linux-x64-gnu"),
    /digest mismatch/,
  );
  assert.throws(
    () => verifyBundleDirectory(missing, bytes, sha256(bytes), "darwin-arm64"),
    /platform mismatch/,
  );
  assert.throws(
    () =>
      verifyBundleDirectory(
        missing,
        Buffer.from("not json"),
        "0".repeat(64),
        "linux-x64-gnu",
      ),
    /digest mismatch/,
  );
});

test("tampered, missing, additional and permission-changed files fail verification", (t) => {
  for (const mutate of [
    (root: string) =>
      writeFileSync(join(root, "node", "entry"), "changed bytes"),
    (root: string) => {
      const path = join(root, "node", "entry");
      const before = readFileSync(path);
      const changed = Buffer.from(before.toString("utf8").toUpperCase());
      assert.equal(changed.length, before.length);
      writeFileSync(path, changed);
    },
    (root: string) => rmSync(join(root, "pi", "entry")),
    (root: string) =>
      writeFileSync(join(root, "pi", "extra"), "unlisted", { mode: 0o600 }),
    (root: string) => chmodSync(join(root, "workbench", "entry"), 0o700),
    (root: string) => chmodSync(join(root, "workbench"), 0o755),
  ]) {
    const { root, snapshot } = fixture(t);
    const bytes = snapshot();
    mutate(root);
    assert.throws(() =>
      verifyBundleDirectory(root, bytes, sha256(bytes), "linux-x64-gnu"),
    );
  }
});

test("symlinked roots/files/directories and hard links are rejected, even internal links", (t) => {
  for (const mutate of [
    (root: string) => symlinkSync("entry", join(root, "node", "link")),
    (root: string) => symlinkSync("../../outside", join(root, "node", "link")),
    (root: string) => symlinkSync("../pi", join(root, "node", "link")),
    (root: string) =>
      linkSync(join(root, "node", "entry"), join(root, "node", "hard")),
  ]) {
    const { root, snapshot } = fixture(t);
    mutate(root);
    assert.throws(snapshot, /links|linked/);
  }
  const { root, directory } = fixture(t);
  symlinkSync(root, join(directory, "alias"));
  assert.throws(
    () => inventoryDirectory(join(directory, "alias"), description()),
    /symlink/,
  );
});

test("writable/special modes, oversized sparse files and undeclared roots fail before hashing", (t) => {
  for (const mode of [0o666, 0o777, 0o4755, 0o2755]) {
    const { root, snapshot } = fixture(t);
    const path = join(root, "node", "entry");
    // macOS /tmp can inherit a group we do not belong to; chmod may then
    // silently clear SGID. Set only this owned fixture to our existing group.
    assert.ok(process.getuid && process.getgid);
    chownSync(path, process.getuid(), process.getgid());
    chmodSync(path, mode);
    assert.equal(lstatSync(path).mode & 0o7777, mode);
    assert.throws(snapshot, /unsafe mode/);
  }
  const { root, snapshot } = fixture(t);
  chmodSync(root, 0o777);
  assert.throws(snapshot, /unsafe staging root mode/);
  chmodSync(root, 0o700);
  chmodSync(join(root, "node"), 0o775);
  assert.throws(snapshot, /unsafe mode/);
  chmodSync(join(root, "node"), 0o700);
  truncateSync(join(root, "node", "entry"), INVENTORY_LIMITS.fileBytes + 1);
  assert.throws(snapshot, /bounds/);
  truncateSync(join(root, "node", "entry"), 0);
  writeFileSync(join(root, "undeclared"), "do not include", { mode: 0o600 });
  assert.throws(snapshot, /unowned/);
});

test("inventory paths cannot escape, collide by case, omit parents or use nonregular entries", (t) => {
  const { snapshot } = fixture(t);
  const original = JSON.parse(snapshot().toString("utf8"));
  for (const path of [
    "../escape",
    "/node/entry",
    "node/./entry",
    "node//entry",
    "node/../entry",
    "node\\entry",
    "node/entry\n",
  ]) {
    const altered = structuredClone(original);
    altered.entries[1].path = path;
    assert.throws(() => parseInventory(Buffer.from(JSON.stringify(altered))));
  }
  for (const mutate of [
    (value: typeof original) =>
      value.entries.push({ ...value.entries[1], path: "node/ENTRY" }),
    (value: typeof original) => value.entries.shift(),
    (value: typeof original) => {
      value.entries[1].kind = "symlink";
    },
    (value: typeof original) => {
      value.entries[1].size = -1;
    },
    (value: typeof original) => {
      value.entries[1].mode = 0o777;
    },
    (value: typeof original) => {
      value.entries[1].sha256 = "not a digest";
    },
  ]) {
    const altered = structuredClone(original);
    mutate(altered);
    assert.throws(() => parseInventory(Buffer.from(JSON.stringify(altered))));
  }
});

test("reject ambiguous encodings, unknown fields, unsupported schema and incomplete inventory", (t) => {
  const { snapshot } = fixture(t);
  const bytes = snapshot();
  const original = JSON.parse(bytes.toString("utf8"));
  for (const value of [
    { ...original, schema: 2 },
    { ...original, approval: "human" },
    { ...original, entries: [] },
    { ...original, entries: original.entries.slice(2) },
  ])
    assert.throws(() => parseInventory(Buffer.from(JSON.stringify(value))));
  assert.throws(
    () => parseInventory(Buffer.from(JSON.stringify(original))),
    /noncanonical/,
  );
  const duplicate = bytes
    .toString("utf8")
    .replace('"schema": 1,', '"schema": 1,\n  "schema": 1,');
  assert.throws(() => parseInventory(Buffer.from(duplicate)), /noncanonical/);
  const oversized = Buffer.alloc(INVENTORY_LIMITS.metadataBytes + 1);
  assert.throws(() => parseInventory(oversized), /too large/);
  assert.throws(
    () =>
      verifyBundleDirectory(
        "/not-scanned",
        oversized,
        "0".repeat(64),
        "linux-x64-gnu",
      ),
    /metadata too large/,
  );
});

test("component versions, origins and build bindings are exact nonsecret metadata, not grants", () => {
  for (const patch of [
    { platform: "linux-arm64" },
    { sourceRevision: "main" },
    { lockSha256: "latest" },
    { foundationSha256: "" },
    { token: "synthetic" },
    { components: [] },
  ])
    assert.throws(() =>
      validateBundleDescription({ ...description(), ...patch }),
    );
  for (const patch of [
    { version: "latest" },
    { version: "^1.2.3" },
    { version: "1.2.3\n" },
    { sourceUrl: "http://example.invalid/a" },
    { sourceUrl: "https://user:secret@example.invalid/a" },
    { sourceUrl: "https://example.invalid/a?token=synthetic" },
    { sourceSha256: "d".repeat(64) + "\n" },
    { id: "../node" },
    { unknown: true },
  ]) {
    const value = description();
    value.components[0] = { ...value.components[0]!, ...patch };
    assert.throws(() => validateBundleDescription(value));
  }
  const value = description();
  value.components.push(value.components[0]!);
  assert.throws(() => validateBundleDescription(value), /duplicate/);
});

test("rename, empty directories and executable metadata remain part of exact content identity", (t) => {
  const { root, snapshot } = fixture(t);
  const before = snapshot();
  mkdirSync(join(root, "pi", "empty"), { mode: 0o700 });
  assert.notEqual(sha256(snapshot()), sha256(before));
  renameSync(join(root, "pi", "empty"), join(root, "pi", "renamed"));
  assert.throws(() =>
    verifyBundleDirectory(root, before, sha256(before), "linux-x64-gnu"),
  );
  chmodSync(join(root, "pi", "entry"), 0o755);
  assert.ok(
    parseInventory(snapshot()).entries.some((item) => item.mode === 0o755),
  );
});

function runNode(directory: string, args: string[]) {
  return spawnSync(process.execPath, args, {
    env: { PATH: directory, HOME: directory, NODE_PATH: directory },
    timeout: 5000,
    killSignal: "SIGKILL",
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
}

function rejectedPromptly(result: ReturnType<typeof runNode>, pattern: RegExp) {
  assert.equal(result.error, undefined, "must reject, not hang until timeout");
  assert.equal(result.signal, null);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, pattern);
}

function fifo(path: string): void {
  // macOS and the Linux CI image provide this POSIX fixture utility. It is not
  // invoked by the inventory tool and never used outside the disposable tree.
  const result = spawnSync("/usr/bin/mkfifo", [path], { timeout: 5000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr.toString());
}

const cli = new URL("../src/bundle-inventory.js", import.meta.url);

test("CLI inventories/verifies offline without running bundled code or ambient tools", (t) => {
  const { root, directory, snapshot } = fixture(t);
  const sentinel = join(directory, "MUST_NOT_EXIST");
  writeFileSync(
    join(root, "node", "entry"),
    `#!/bin/sh\ntouch '${sentinel}'\n`,
  );
  chmodSync(join(root, "node", "entry"), 0o700);
  const descriptor = join(directory, "description.json");
  const manifest = join(directory, "inventory.json");
  writeFileSync(descriptor, JSON.stringify(description()));
  const run = (...args: string[]) =>
    runNode(directory, [cli.pathname, ...args]);
  const generated = run("inventory", root, descriptor);
  assert.equal(generated.status, 0, generated.stderr);
  assert.equal(generated.stdout, snapshot().toString("utf8"));
  writeFileSync(manifest, generated.stdout);
  const verified = run(
    "verify",
    root,
    manifest,
    sha256(generated.stdout),
    "linux-x64-gnu",
  );
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(JSON.parse(verified.stdout).status, "content-verified-only");
  assert.match(JSON.parse(verified.stdout).qualification, /not-approved/);
  assert.throws(() => readFileSync(sentinel), /ENOENT/);
  assert.notEqual(run("install", root, manifest).status, 0);
  assert.notEqual(
    run("verify", root, manifest, "0".repeat(64), "linux-x64-gnu").status,
    0,
  );
  assert.notEqual(run("inventory", root, descriptor, "unexpected").status, 0);
});

test("metadata special files, links and oversized inputs reject without blocking", (t) => {
  const { root, directory } = fixture(t);
  const descriptor = join(directory, "description.json");
  const invoke = () =>
    runNode(directory, [cli.pathname, "inventory", root, descriptor]);
  fifo(descriptor);
  rejectedPromptly(invoke(), /invalid metadata file/);
  rmSync(descriptor);
  mkdirSync(descriptor);
  rejectedPromptly(invoke(), /invalid metadata file/);
  rmSync(descriptor, { recursive: true });
  writeFileSync(descriptor, JSON.stringify(description()));
  linkSync(descriptor, join(directory, "hard"));
  rejectedPromptly(invoke(), /invalid metadata file/);
  rmSync(join(directory, "hard"));
  symlinkSync(descriptor, join(directory, "alias"));
  rejectedPromptly(
    runNode(directory, [
      cli.pathname,
      "inventory",
      root,
      join(directory, "alias"),
    ]),
    /ELOOP/,
  );
  truncateSync(descriptor, INVENTORY_LIMITS.metadataBytes + 1);
  rejectedPromptly(invoke(), /invalid metadata file/);
});

test("payload FIFOs are rejected; late FIFO substitution cannot block the file open", (t) => {
  const { root, directory } = fixture(t);
  const victim = join(root, "node", "entry");
  fifo(join(root, "node", "fifo"));
  assert.throws(() => inventoryDirectory(root, description()), /special files/);
  rmSync(join(root, "node", "fifo"));
  // Deterministic lstat/open substitution in a bounded child; not a claim that
  // path-based traversal is safe against arbitrary concurrent writers.
  const program = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import { spawnSync } from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    const original = fs.openSync;
    fs.openSync = (path, ...args) => {
      if (path === ${JSON.stringify(victim)}) {
        fs.unlinkSync(path);
        assert.equal(spawnSync('/usr/bin/mkfifo', [path], {timeout: 1000}).status, 0);
      }
      return original(path, ...args);
    };
    syncBuiltinESMExports();
    const { inventoryDirectory } = await import(${JSON.stringify(cli.href)});
    inventoryDirectory(${JSON.stringify(root)}, ${JSON.stringify(description())});
  `;
  rejectedPromptly(
    runNode(directory, ["--input-type=module", "--eval", program]),
    /linked\/nonregular file/,
  );
});

test("ownership is checked on staging root, directories and files", (t) => {
  const { root, directory } = fixture(t);
  for (const path of [root, join(root, "node"), join(root, "node", "entry")]) {
    // Inject only the observed UID; no privileges or host ownership changes.
    const program = `
      import fs from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      const original = fs.lstatSync;
      fs.lstatSync = (path, ...args) => {
        const stat = original(path, ...args);
        if (path === ${JSON.stringify(path)}) stat.uid += 1;
        return stat;
      };
      syncBuiltinESMExports();
      const { inventoryDirectory } = await import(${JSON.stringify(cli.href)});
      inventoryDirectory(${JSON.stringify(root)}, ${JSON.stringify(description())});
    `;
    rejectedPromptly(
      runNode(directory, ["--input-type=module", "--eval", program]),
      /operator-owned/,
    );
  }
});

test("changed file observations are rejected before and after hashing", (t) => {
  const { root, directory } = fixture(t);
  for (const observation of [1, 2]) {
    const program = `
      import fs from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      const original = fs.fstatSync;
      let calls = 0;
      fs.fstatSync = (...args) => {
        const stat = original(...args);
        if (++calls === ${observation}) stat.mtimeMs += 1000;
        return stat;
      };
      syncBuiltinESMExports();
      const { inventoryDirectory } = await import(${JSON.stringify(cli.href)});
      inventoryDirectory(${JSON.stringify(root)}, ${JSON.stringify(description())});
    `;
    rejectedPromptly(
      runNode(directory, ["--input-type=module", "--eval", program]),
      /file changed: mtimeMs/,
    );
  }
});

test("entry count, path depth and aggregate byte limits reject metadata without reading payload", (t) => {
  const { snapshot } = fixture(t);
  const original = parseInventory(snapshot());
  const encode = (entries: typeof original.entries) =>
    Buffer.from(serializeInventory({ ...original, entries }));
  assert.throws(
    () =>
      parseInventory(
        encode(
          Array.from({ length: INVENTORY_LIMITS.entries + 1 }, () => ({
            path: "node",
            kind: "directory",
            mode: 0o700,
          })),
        ),
      ),
    /too many entries/,
  );
  assert.throws(
    () =>
      parseInventory(
        encode([
          ...original.entries,
          {
            path: `node/${"a/".repeat(32)}entry`,
            kind: "directory",
            mode: 0o700,
          },
        ]),
      ),
    /too deep/,
  );
  const entries = original.entries.map((item) =>
    item.kind === "file" ? { ...item, size: INVENTORY_LIMITS.fileBytes } : item,
  );
  entries.push({
    path: "node/extra",
    kind: "file",
    mode: 0o600,
    size: INVENTORY_LIMITS.fileBytes,
    sha256: "a".repeat(64),
  });
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  assert.equal(parseInventory(encode(entries)).entries.length, 7);
  entries.push({
    path: "node/over",
    kind: "file",
    mode: 0o600,
    size: 1,
    sha256: "a".repeat(64),
  });
  assert.throws(() => parseInventory(encode(entries)), /payload too large/);
});
