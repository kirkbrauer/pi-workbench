import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";
import {
  planLockedDependencies,
  planRepositoryBundle,
} from "../src/bundle-plan.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const revision = "a".repeat(40);
const integrity = `sha512-${Buffer.alloc(64, 1).toString("base64")}`;

function fixture() {
  const packages: Record<string, Record<string, unknown>> = {};
  const snapshots: Record<string, Record<string, unknown>> = {};
  for (const name of [
    "app",
    "common",
    "mac",
    "linux",
    "musl",
    "universal",
    "dev-only",
  ]) {
    packages[`${name}@1.0.0`] = { resolution: { integrity } };
    snapshots[`${name}@1.0.0`] = {};
  }
  Object.assign(packages["mac@1.0.0"] ?? {}, {
    os: ["darwin"],
    cpu: ["arm64"],
  });
  Object.assign(packages["universal@1.0.0"] ?? {}, { os: ["darwin"] });
  Object.assign(packages["linux@1.0.0"] ?? {}, {
    os: ["linux"],
    cpu: ["x64"],
    libc: ["glibc"],
  });
  Object.assign(packages["musl@1.0.0"] ?? {}, {
    os: ["linux"],
    cpu: ["x64"],
    libc: ["musl"],
  });
  snapshots["app@1.0.0"] = {
    dependencies: { common: "1.0.0" },
    optionalDependencies: {
      mac: "1.0.0",
      linux: "1.0.0",
      musl: "1.0.0",
      universal: "1.0.0",
    },
  };
  return {
    lockfileVersion: "9.0",
    settings: { autoInstallPeers: false, excludeLinksFromLockfile: false },
    packages,
    snapshots,
  };
}

const bytes = (lock: unknown) => Buffer.from(stringify(lock));
const ids = (plan: ReturnType<typeof planLockedDependencies>) =>
  plan.nodes.map((node) => node.snapshotId);

function repositoryInputs() {
  return {
    lock: readFileSync(join(root, "pnpm-lock.yaml")),
    manifest: readFileSync(join(root, "package.json")),
    tooling: readFileSync(join(root, "packages/tooling/package.json")),
    foundation: readFileSync(join(root, "config/foundation.json")),
    policy: readFileSync(join(root, "pnpm-workspace.yaml")),
  };
}

test("deterministic platform closure keeps compatible optionals, not development-only nodes", () => {
  const lock = fixture();
  const mac = planLockedDependencies(
    bytes(lock),
    ["app@1.0.0"],
    "darwin-arm64",
  );
  assert.deepEqual(ids(mac), [
    "app@1.0.0",
    "common@1.0.0",
    "mac@1.0.0",
    "universal@1.0.0",
  ]);
  assert.deepEqual(
    mac.excludedOptionalEdges.map((edge) => edge.to),
    ["linux@1.0.0", "musl@1.0.0"],
  );
  const linux = planLockedDependencies(
    bytes(lock),
    ["app@1.0.0"],
    "linux-x64-gnu",
  );
  assert.deepEqual(ids(linux), ["app@1.0.0", "common@1.0.0", "linux@1.0.0"]);
  assert.equal(linux.nodes[0]?.integrity, integrity);
  assert.equal(linux.status, "locked-package-graph-only");
  assert.equal(
    linux.qualification,
    "not-a-runtime-sbom-not-built-not-approved",
  );
  assert.deepEqual(
    planLockedDependencies(bytes(lock), ["app@1.0.0"], "darwin-arm64"),
    mac,
  );
  const reordered = {
    ...lock,
    packages: Object.fromEntries(Object.entries(lock.packages).reverse()),
    snapshots: Object.fromEntries(Object.entries(lock.snapshots).reverse()),
  };
  const again = planLockedDependencies(
    bytes(reordered),
    ["app@1.0.0"],
    "darwin-arm64",
  );
  assert.notEqual(again.lockSha256, mac.lockSha256);
  assert.deepEqual({ ...again, lockSha256: mac.lockSha256 }, mac);
});

test("negative selectors and explicit any; incompatible required edges cannot be omitted", () => {
  const lock = fixture();
  lock.packages["common@1.0.0"] = {
    resolution: { integrity },
    os: ["any", "!darwin"],
  };
  assert.throws(
    () => planLockedDependencies(bytes(lock), ["app@1.0.0"], "darwin-arm64"),
    /required platform mismatch/,
  );
  assert.ok(
    ids(
      planLockedDependencies(bytes(lock), ["app@1.0.0"], "linux-x64-gnu"),
    ).includes("common@1.0.0"),
  );
  lock.packages["common@1.0.0"] = { resolution: { integrity }, os: ["!linux"] };
  assert.ok(
    ids(
      planLockedDependencies(bytes(lock), ["app@1.0.0"], "darwin-arm64"),
    ).includes("common@1.0.0"),
  );
  lock.packages["common@1.0.0"] = { resolution: { integrity }, os: [] };
  assert.throws(
    () => planLockedDependencies(bytes(lock), ["app@1.0.0"], "darwin-arm64"),
    /selectors/,
  );
});

test("peer-context snapshots stay distinct; cycles terminate without flattening bindings", () => {
  const lock = fixture();
  lock.packages["host@1.0.0"] = {
    resolution: { integrity },
    peerDependencies: { common: "*" },
  };
  lock.packages["common@2.0.0"] = { resolution: { integrity } };
  lock.snapshots["common@2.0.0"] = {};
  lock.snapshots["host@1.0.0(common@1.0.0)"] = {
    dependencies: { common: "1.0.0" },
  };
  lock.snapshots["host@1.0.0(common@2.0.0)"] = {
    dependencies: { common: "2.0.0" },
  };
  lock.snapshots["common@1.0.0"] = {
    dependencies: { host: "1.0.0(common@1.0.0)" },
  };
  const plan = planLockedDependencies(
    bytes(lock),
    ["host@1.0.0(common@2.0.0)", "host@1.0.0(common@1.0.0)"],
    "darwin-arm64",
  );
  assert.equal(plan.nodes.length, 4);
  assert.deepEqual(
    plan.nodes
      .filter((node) => node.name === "host")
      .map((node) => node.peerRequirements[0]?.resolved),
    ["common@1.0.0", "common@2.0.0"],
  );
  assert.equal(plan.edges.length, 3);
});

test("missing required peers fail; absent optional peers are explicit, not ambient resolutions", () => {
  const lock = fixture();
  lock.packages["common@1.0.0"] = {
    resolution: { integrity },
    peerDependencies: { absent: "^1.0.0" },
  };
  assert.throws(
    () => planLockedDependencies(bytes(lock), ["app@1.0.0"], "darwin-arm64"),
    /unbound required peer/,
  );
  Object.assign(lock.packages["common@1.0.0"] ?? {}, {
    peerDependenciesMeta: { absent: { optional: true } },
  });
  const node = planLockedDependencies(
    bytes(lock),
    ["app@1.0.0"],
    "darwin-arm64",
  ).nodes.find((node) => node.name === "common");
  assert.deepEqual(node?.peerRequirements, [
    { name: "absent", range: "^1.0.0", optional: true, resolved: null },
  ]);
});

test("missing optional snapshots or integrity cannot hide behind platform exclusion", () => {
  for (const kind of ["snapshot", "package", "integrity"]) {
    const lock = fixture();
    if (kind === "snapshot") delete lock.snapshots["linux@1.0.0"];
    else if (kind === "package") delete lock.packages["linux@1.0.0"];
    else
      lock.packages["linux@1.0.0"] = {
        resolution: { integrity: "sha512-invalid" },
      };
    assert.throws(
      () => planLockedDependencies(bytes(lock), ["app@1.0.0"], "darwin-arm64"),
      /missing|integrity/,
    );
  }
});

test("aliases, local/Git/range references and malformed peer contexts are rejected", () => {
  for (const ref of [
    "link:../common",
    "workspace:*",
    "file:/tmp/common",
    "https://example.invalid/common",
    "github:org/repo",
    "^1.0.0",
    "other@1.0.0",
    "1.0.0(common@1.0.0",
    "1.0.0()",
    "1.0.0(common@1.0.0)tail",
  ]) {
    const lock = fixture();
    lock.snapshots["app@1.0.0"] = { dependencies: { common: ref } };
    assert.throws(() =>
      planLockedDependencies(bytes(lock), ["app@1.0.0"], "darwin-arm64"),
    );
  }
  const lock = fixture();
  lock.snapshots["app@1.0.0"] = {
    dependencies: { common: "1.0.0" },
    optionalDependencies: { common: "1.0.0" },
  };
  assert.throws(
    () => planLockedDependencies(bytes(lock), ["app@1.0.0"], "darwin-arm64"),
    /duplicate/,
  );
});

test("unknown graph semantics, duplicate YAML keys, aliases and data budgets fail closed", () => {
  const plan = (value: Buffer) =>
    planLockedDependencies(value, ["app@1.0.0"], "darwin-arm64");
  assert.throws(
    () => plan(Buffer.from("lockfileVersion: '9.0'\nlockfileVersion: '9.0'\n")),
    /unique/,
  );
  assert.throws(() => plan(Buffer.from("a: &a [1]\nb: *a\n")), /alias/i);
  assert.throws(() => plan(Buffer.from("value: !custom 1\n")), /YAML tag/);
  assert.throws(() => plan(Buffer.from([0xff])), /encoded data/);
  assert.throws(() => plan(Buffer.alloc(16 * 1024 * 1024 + 1)), /too large/);
  const lock = fixture();
  assert.throws(
    () => plan(bytes({ ...lock, patchedDependencies: {} })),
    /unsupported field/,
  );
  lock.snapshots["common@1.0.0"] = { buildDependencies: {} };
  assert.throws(() => plan(bytes(lock)), /unsupported field/);
  for (const key of [
    "dependencies",
    "optionalDependencies",
    "transitivePeerDependencies",
  ]) {
    lock.snapshots["common@1.0.0"] = { [key]: null };
    assert.throws(() => plan(bytes(lock)), /mapping|peers/);
  }
  lock.snapshots["common@1.0.0"] = {};
  lock.packages = Object.fromEntries(
    Array.from({ length: 10_001 }, (_, i) => [
      `p${i}@1.0.0`,
      { resolution: { integrity } },
    ]),
  );
  assert.throws(() => plan(bytes(lock)), /too many nodes/);
});

test("edge budget, invalid roots and unsafe package names are rejected", () => {
  const lock = fixture();
  for (const roots of [
    [],
    ["app@1.0.0", "app@1.0.0"],
    ["absent@1.0.0"],
    Array.from({ length: 513 }, (_, i) => `p${i}@1.0.0`),
  ]) {
    assert.throws(
      () => planLockedDependencies(bytes(lock), roots, "darwin-arm64"),
      /root/,
    );
  }
  for (const name of ["..", "../bad", "@../bad"]) {
    const invalid = fixture();
    invalid.snapshots["app@1.0.0"] = { dependencies: { [name]: "1.0.0" } };
    assert.throws(() =>
      planLockedDependencies(bytes(invalid), ["app@1.0.0"], "darwin-arm64"),
    );
  }
  const deps = Object.fromEntries(
    Array.from({ length: 1000 }, (_, i) => [`p${i}`, "1.0.0"]),
  );
  for (let i = 0; i < 1000; i++) {
    lock.packages[`p${i}@1.0.0`] = { resolution: { integrity } };
    lock.snapshots[`p${i}@1.0.0`] = i < 101 ? { dependencies: deps } : {};
  }
  // JSON is YAML 1.2; avoid stringify introducing aliases for shared fixture maps.
  assert.throws(
    () =>
      planLockedDependencies(
        Buffer.from(JSON.stringify(lock)),
        ["app@1.0.0"],
        "darwin-arm64",
      ),
    /too many edges/,
  );
});

test("repeated snapshot metadata cannot amplify the projected field or output budgets", () => {
  const lock = fixture();
  const roots = Array.from(
    { length: 101 },
    (_, i) => `app@1.0.0(context${i}@1.0.0)`,
  );
  for (const id of roots) lock.snapshots[id] = {};
  lock.packages["app@1.0.0"] = {
    resolution: { integrity },
    peerDependencies: Object.fromEntries(
      Array.from({ length: 1000 }, (_, i) => [`peer${i}`, "*"]),
    ),
    peerDependenciesMeta: Object.fromEntries(
      Array.from({ length: 1000 }, (_, i) => [`peer${i}`, { optional: true }]),
    ),
  };
  assert.throws(
    () =>
      planLockedDependencies(
        Buffer.from(JSON.stringify(lock)),
        roots,
        "darwin-arm64",
      ),
    /projected metadata fields/,
  );
  lock.packages["app@1.0.0"] = {
    resolution: { integrity },
    engines: Object.fromEntries(
      Array.from({ length: 1000 }, (_, i) => [`engine${i}`, "x".repeat(2048)]),
    ),
  };
  assert.throws(
    () =>
      planLockedDependencies(
        Buffer.from(JSON.stringify(lock)),
        roots.slice(0, 9),
        "darwin-arm64",
      ),
    /plan too large/,
  );
});

test("real pinned profile includes esbuild/clipboard platform payloads and tooling YAML, not ESLint/compiler", () => {
  const input = repositoryInputs();
  for (const platform of ["darwin-arm64", "linux-x64-gnu"] as const) {
    const plan = planRepositoryBundle(input, platform, revision);
    const names = plan.nodes.map((node) => node.name);
    assert.ok(names.includes("yaml"));
    assert.ok(names.includes("@earendil-works/pi-coding-agent"));
    assert.ok(
      names.includes(
        platform === "darwin-arm64"
          ? "@esbuild/darwin-arm64"
          : "@esbuild/linux-x64",
      ),
    );
    assert.ok(names.includes(`@mariozechner/clipboard-${platform}`));
    assert.equal(
      names.includes("@mariozechner/clipboard-darwin-universal"),
      platform === "darwin-arm64",
    );
    for (const excluded of [
      "eslint",
      "typescript",
      "typescript-eslint",
      "@biomejs/biome",
      "@mariozechner/clipboard-linux-x64-musl",
    ])
      assert.equal(names.includes(excluded), false);
    assert.equal(plan.sourceRevision, revision);
    assert.equal(plan.profile, "pi-and-foundation-tools");
    assert.equal(Object.keys(plan.inputs).length, 5);
    assert.ok(plan.remainingRequirements.length > 0);
  }
});

test("repository seed rejects changed pins, importer resolution, overrides and unsupported workspace sources", () => {
  const original = repositoryInputs();
  for (const mutate of [
    (input: typeof original) => {
      const value = JSON.parse(input.foundation.toString());
      value.pi = "1.0.0";
      input.foundation = Buffer.from(JSON.stringify(value));
    },
    (input: typeof original) => {
      const value = parse(input.lock.toString());
      value.importers["."].devDependencies[
        "@earendil-works/pi-coding-agent"
      ].version = "0.84.0";
      input.lock = bytes(value);
    },
    (input: typeof original) => {
      const value = parse(input.lock.toString());
      value.overrides = {};
      input.lock = bytes(value);
    },
    (input: typeof original) => {
      const value = JSON.parse(input.tooling.toString());
      value.dependencies.yaml = "workspace:*";
      input.tooling = Buffer.from(JSON.stringify(value));
    },
    (input: typeof original) => {
      const value = JSON.parse(input.tooling.toString());
      value.optionalDependencies = {};
      input.tooling = Buffer.from(JSON.stringify(value));
    },
  ]) {
    const input = { ...original };
    mutate(input);
    assert.throws(() => planRepositoryBundle(input, "darwin-arm64", revision));
  }
});

test("CLI only reads repository metadata with unusable ambient PATH and isolated HOME", (t) => {
  const home = mkdtempSync(join(tmpdir(), "wb-plan-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const cli = fileURLToPath(new URL("../src/bundle-plan.js", import.meta.url));
  const result = spawnSync(process.execPath, [cli, "darwin-arm64", revision], {
    cwd: root,
    env: { HOME: home, PATH: "/nonexistent", NODE_PATH: "/nonexistent" },
    encoding: "utf8",
    timeout: 5000,
    killSignal: "SIGKILL",
    maxBuffer: 2 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "locked-package-graph-only");
});

test("CLI shares the bounded metadata reader and rejects FIFO input without hanging", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "wb-plan-fifo-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const fifo = spawnSync(
    "/usr/bin/mkfifo",
    [join(directory, "pnpm-lock.yaml")],
    { timeout: 5000 },
  );
  assert.ifError(fifo.error);
  assert.equal(fifo.status, 0);
  const cli = fileURLToPath(new URL("../src/bundle-plan.js", import.meta.url));
  const result = spawnSync(process.execPath, [cli, "darwin-arm64", revision], {
    cwd: directory,
    env: { HOME: directory, PATH: "/nonexistent" },
    encoding: "utf8",
    timeout: 5000,
    killSignal: "SIGKILL",
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /invalid metadata file/);
});
