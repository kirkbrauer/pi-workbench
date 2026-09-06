import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { parseDocument } from "yaml";
import {
  type BundlePlatform,
  bundlePlatform,
  readBundleMetadata,
  sha256,
} from "./bundle-inventory.js";
import { validatePolicy, validateResolution } from "./dependencies.js";

const LIMITS = {
  bytes: 16 * 1024 * 1024,
  nodes: 10_000,
  edges: 100_000,
} as const;
const NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/;
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function record(value: unknown): Record<string, unknown> {
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    "expected mapping",
  );
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  assert.ok(
    typeof value === "string" && value.length > 0 && value.length <= 2048,
    "invalid string",
  );
  assert.ok(
    [...value].every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127),
    "control character",
  );
  return value;
}

function allowed(value: Record<string, unknown>, keys: string[]): void {
  for (const key of Object.keys(value))
    assert.ok(keys.includes(key), `unsupported field: ${key}`);
}

function mapping(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record(value === undefined ? {} : value))
      .sort(([a], [b]) => compare(a, b))
      .map(([key, item]) => [text(key), text(item)]),
  );
}

function identity(id: string): { name: string; version: string } {
  const split = id.lastIndexOf("@");
  const name = id.slice(0, split),
    version = id.slice(split + 1);
  assert.match(name, NAME, "invalid package name");
  assert.match(version, VERSION, "non-registry or non-exact version");
  return { name, version };
}

function packageId(id: string): string {
  text(id);
  const split = id.indexOf("(");
  const base = split < 0 ? id : id.slice(0, split);
  identity(base);
  let depth = 0,
    needsIdentity = false;
  for (const token of split < 0
    ? []
    : (id.slice(split).match(/[()]|[^()]+/g) ?? [])) {
    if (token === "(") {
      assert.ok(!needsIdentity && ++depth <= 32, "invalid peer context");
      needsIdentity = true;
    } else if (token === ")") {
      assert.ok(!needsIdentity && depth > 0, "invalid peer context");
      depth--;
    } else {
      assert.ok(needsIdentity && depth > 0, "invalid peer context");
      identity(token);
      needsIdentity = false;
    }
  }
  assert.ok(depth === 0 && !needsIdentity, "invalid peer context");
  return base;
}

function selectors(value: unknown): string[] {
  if (value === undefined) return [];
  assert.ok(
    Array.isArray(value) && value.length > 0 && value.length <= 100,
    "invalid platform selectors",
  );
  return value
    .map((item) => {
      const selector = text(item);
      assert.match(selector, /^!?[a-z0-9_+-]+$/);
      return selector;
    })
    .sort(compare);
}

function matches(select: string[], target: string): boolean {
  if (select.includes(`!${target}`) || select.includes("!any")) return false;
  const positive = select.filter((item) => !item.startsWith("!"));
  return (
    positive.length === 0 ||
    positive.includes("any") ||
    positive.includes(target)
  );
}

function yaml(bytes: Buffer): Record<string, unknown> {
  assert.ok(bytes.length <= LIMITS.bytes, "input too large");
  const document = parseDocument(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    { uniqueKeys: true },
  );
  assert.equal(
    document.errors.length,
    0,
    document.errors.map((error) => error.message).join("; "),
  );
  assert.equal(document.warnings.length, 0, "unsupported YAML tag or warning");
  return record(document.toJS({ maxAliasCount: 0 }));
}

export interface PlannedEdge {
  from: string;
  name: string;
  to: string;
  optional: boolean;
}

/** Closed lock-graph projection, NOT a complete runtime SBOM or an installer. */
export function planLockedDependencies(
  bytes: Buffer,
  roots: string[],
  platform: BundlePlatform,
) {
  bundlePlatform(platform);
  assert.ok(
    roots.length > 0 &&
      roots.length <= 512 &&
      new Set(roots).size === roots.length,
    "invalid roots",
  );
  const lock = yaml(bytes);
  allowed(lock, [
    "lockfileVersion",
    "settings",
    "overrides",
    "importers",
    "packages",
    "snapshots",
  ]);
  assert.equal(lock.lockfileVersion, "9.0", "unsupported lock version");
  assert.deepEqual(
    lock.settings,
    { autoInstallPeers: false, excludeLinksFromLockfile: false },
    "lock settings drift",
  );
  const packages = record(lock.packages),
    snapshots = record(lock.snapshots);
  assert.ok(
    Object.keys(packages).length <= LIMITS.nodes &&
      Object.keys(snapshots).length <= LIMITS.nodes,
    "too many nodes",
  );
  const metadata = new Map(
    Object.entries(packages).map(([id, value]) => {
      identity(id);
      const item = record(value);
      allowed(item, [
        "resolution",
        "engines",
        "cpu",
        "os",
        "libc",
        "hasBin",
        "deprecated",
        "peerDependencies",
        "peerDependenciesMeta",
      ]);
      validateResolution(item.resolution);
      const integrity = text(record(item.resolution).integrity);
      assert.equal(
        `sha512-${Buffer.from(integrity.slice(7), "base64").toString("base64")}`,
        integrity,
        "noncanonical integrity",
      );
      if (item.hasBin !== undefined)
        assert.equal(typeof item.hasBin, "boolean");
      const peers = mapping(item.peerDependencies);
      const peerMeta = record(
        item.peerDependenciesMeta === undefined
          ? {}
          : item.peerDependenciesMeta,
      );
      for (const [name, value] of Object.entries(peerMeta)) {
        assert.ok(Object.hasOwn(peers, name), "orphan peer metadata");
        const entry = record(value);
        allowed(entry, ["optional"]);
        assert.equal(
          typeof entry.optional,
          "boolean",
          "invalid peer optional flag",
        );
      }
      return [
        id,
        {
          ...identity(id),
          packageId: id,
          integrity,
          selectors: {
            os: selectors(item.os),
            cpu: selectors(item.cpu),
            libc: selectors(item.libc),
          },
          engines: mapping(item.engines),
          hasBin: item.hasBin === true,
          deprecated:
            item.deprecated === undefined ? null : text(item.deprecated),
          peers,
          peerMeta,
        },
      ] as const;
    }),
  );
  const edges = new Map<string, PlannedEdge[]>();
  let edgeCount = 0;
  for (const [id, value] of Object.entries(snapshots)) {
    assert.ok(metadata.has(packageId(id)), `missing package: ${id}`);
    const snapshot = record(value);
    allowed(snapshot, [
      "dependencies",
      "optionalDependencies",
      "optional",
      "transitivePeerDependencies",
    ]);
    if (snapshot.optional !== undefined)
      assert.equal(typeof snapshot.optional, "boolean");
    const outgoing: PlannedEdge[] = [];
    const names = new Set<string>();
    for (const kind of ["dependencies", "optionalDependencies"] as const) {
      for (const [name, ref] of Object.entries(mapping(snapshot[kind]))) {
        assert.match(name, NAME);
        assert.ok(!names.has(name), "duplicate required/optional dependency");
        names.add(name);
        const to = `${name}@${ref}`;
        packageId(to);
        assert.ok(Object.hasOwn(snapshots, to), `missing snapshot: ${to}`);
        assert.ok(++edgeCount <= LIMITS.edges, "too many edges");
        outgoing.push({
          from: id,
          name,
          to,
          optional: kind === "optionalDependencies",
        });
      }
    }
    edges.set(
      id,
      outgoing.sort((a, b) => compare(a.name, b.name)),
    );
  }
  const target =
    platform === "darwin-arm64"
      ? { os: "darwin", cpu: "arm64", libc: "none" }
      : { os: "linux", cpu: "x64", libc: "glibc" };

  function compatible(id: string): boolean {
    const item = metadata.get(packageId(id));
    assert.ok(item, `missing package: ${id}`);
    return (
      matches(item.selectors.os, target.os) &&
      matches(item.selectors.cpu, target.cpu) &&
      matches(item.selectors.libc, target.libc)
    );
  }

  const pending = [...roots].sort(compare),
    selected = new Set<string>();
  const included: PlannedEdge[] = [],
    excluded: PlannedEdge[] = [];
  for (let i = 0; i < pending.length; i++) {
    const id = pending[i];
    assert.ok(id && edges.has(id), `missing root/snapshot: ${id}`);
    assert.ok(compatible(id), `required platform mismatch: ${id}`);
    if (selected.has(id)) continue;
    selected.add(id);
    for (const edge of edges.get(id) ?? []) {
      if (!compatible(edge.to)) {
        assert.ok(edge.optional, `required platform mismatch: ${edge.to}`);
        excluded.push(edge);
      } else {
        included.push(edge);
        pending.push(edge.to);
      }
    }
  }
  let projectedFields = 0;
  const nodes = [...selected].sort(compare).map((id) => {
    const item = metadata.get(packageId(id));
    assert.ok(item);
    const { peers, peerMeta, ...info } = item;
    const transitiveValue = record(snapshots[id]).transitivePeerDependencies;
    const transitivePeers =
      transitiveValue === undefined ? [] : transitiveValue;
    assert.ok(Array.isArray(transitivePeers), "invalid transitive peers");
    projectedFields +=
      Object.keys(peers).length +
      Object.keys(info.engines).length +
      transitivePeers.length +
      Object.values(info.selectors).reduce(
        (sum, values) => sum + values.length,
        0,
      );
    assert.ok(
      projectedFields <= LIMITS.edges,
      "too many projected metadata fields",
    );
    const peerRequirements = Object.entries(peers).map(([name, range]) => {
      assert.match(name, NAME);
      const optional = record(peerMeta[name] ?? {}).optional === true;
      const binding = edges.get(id)?.find((edge) => edge.name === name);
      const resolved = binding && selected.has(binding.to) ? binding.to : null;
      assert.ok(
        optional || resolved !== null,
        `unbound required peer: ${id} -> ${name}`,
      );
      return { name, range, optional, resolved };
    });
    return {
      snapshotId: id,
      ...info,
      sourceUrl: `https://registry.npmjs.org/${item.name}/-/${item.name.split("/").at(-1)}-${item.version}.tgz`,
      peerRequirements,
      transitivePeerNames: transitivePeers
        .map((value) => {
          const name = text(value);
          assert.match(name, NAME);
          return name;
        })
        .sort(compare),
    };
  });
  const order = (a: PlannedEdge, b: PlannedEdge) =>
    compare(a.from, b.from) || compare(a.name, b.name);
  const result = {
    schema: 1 as const,
    status: "locked-package-graph-only" as const,
    platform,
    lockSha256: sha256(bytes),
    roots: [...roots].sort(compare),
    nodes,
    edges: included.sort(order),
    excludedOptionalEdges: excluded.sort(order).map((edge) => ({
      ...edge,
      reason: "platform-constraint-mismatch" as const,
    })),
    qualification: "not-a-runtime-sbom-not-built-not-approved" as const,
  };
  assert.ok(
    Buffer.byteLength(JSON.stringify(result, null, 2)) <= LIMITS.bytes,
    "plan too large",
  );
  return result;
}

/** Narrow seed profile: upstream Pi and the existing foundation tooling workspace. */
export function planRepositoryBundle(
  inputs: Record<
    "lock" | "manifest" | "tooling" | "foundation" | "policy",
    Buffer
  >,
  platform: BundlePlatform,
  sourceRevision: string,
) {
  assert.match(sourceRevision, /^[a-f0-9]{40}$/);
  for (const bytes of Object.values(inputs))
    assert.ok(bytes.length <= LIMITS.bytes, "input too large");
  const manifest = record(JSON.parse(inputs.manifest.toString("utf8")));
  const tooling = record(JSON.parse(inputs.tooling.toString("utf8")));
  const foundation = record(JSON.parse(inputs.foundation.toString("utf8")));
  const policy = yaml(inputs.policy);
  validatePolicy(policy);
  assert.equal(manifest.private, true);
  assert.equal(tooling.private, true);
  assert.equal(tooling.name, "@pi-workbench/tooling");
  for (const name of ["node", "pi", "pnpm", "corepack"])
    assert.match(text(foundation[name]), /^\d+\.\d+\.\d+$/);
  assert.equal(record(manifest.engines).node, foundation.node);
  assert.equal(record(manifest.engines).pnpm, foundation.pnpm);
  assert.match(
    text(manifest.packageManager),
    /^pnpm@\d+\.\d+\.\d+\+sha512\.[a-f0-9]{128}$/,
  );
  assert.ok(
    text(manifest.packageManager).startsWith(
      `pnpm@${text(foundation.pnpm)}+sha512.`,
    ),
    "package manager pin drift",
  );
  assert.match(text(tooling.version), /^\d+\.\d+\.\d+$/);
  for (const key of ["bundledDependencies", "bundleDependencies"])
    assert.equal(tooling[key], undefined, "unsupported bundled dependencies");
  const pi = "@earendil-works/pi-coding-agent";
  assert.equal(
    record(manifest.devDependencies)[pi],
    foundation.pi,
    "Pi pin drift",
  );
  for (const key of ["optionalDependencies", "peerDependencies"])
    assert.equal(
      tooling[key],
      undefined,
      "unsupported tooling dependency kind",
    );
  const lock = yaml(inputs.lock),
    importers = record(lock.importers);
  assert.deepEqual(lock.overrides, policy.overrides, "lock override drift");
  const roots: string[] = [];

  function add(
    importer: string,
    kind: string,
    name: string,
    version: unknown,
  ): void {
    assert.match(name, NAME);
    assert.match(
      text(version),
      /^\d+\.\d+\.\d+$/,
      "exact registry seed required",
    );
    const entry = record(record(record(importers[importer])[kind])[name]);
    assert.equal(entry.specifier, version, "importer specifier drift");
    const id = `${name}@${text(entry.version)}`;
    assert.equal(
      packageId(id),
      `${name}@${version}`,
      "importer resolution drift",
    );
    roots.push(id);
  }

  add(".", "devDependencies", pi, foundation.pi);
  const deps = mapping(tooling.dependencies);
  assert.deepEqual(
    Object.keys(
      record(record(importers["packages/tooling"]).dependencies),
    ).sort(),
    Object.keys(deps),
    "tooling importer drift",
  );
  for (const [name, version] of Object.entries(deps))
    add("packages/tooling", "dependencies", name, version);
  return {
    ...planLockedDependencies(inputs.lock, [...new Set(roots)], platform),
    profile: "pi-and-foundation-tools" as const,
    sourceRevision,
    inputs: Object.fromEntries(
      Object.entries(inputs)
        .sort(([a], [b]) => compare(a, b))
        .map(([name, bytes]) => [name, sha256(bytes)]),
    ),
    workbench: {
      name: text(tooling.name),
      version: text(tooling.version),
      scope: "compiled-foundation-tools-only" as const,
    },
    buildToolchain: {
      node: text(foundation.node),
      corepack: text(foundation.corepack),
      pnpm: text(foundation.pnpm),
      packageManager: text(manifest.packageManager),
    },
    remainingRequirements: [
      "verified platform Node archive, digest and provenance",
      "tarball bytes, package manifests, licenses, bundled dependencies and peer/engine range validation",
      "native executables/shared libraries and exact OS baseline",
      "select distributable tooling entrypoints; checkout-oriented checks are not standalone runtime commands",
      "clean materialization and deterministic bundle assembly",
      "offline runtime smoke tests and missing-dependency/ambient-fallback rejection",
    ],
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [platform, revision, ...extra] = process.argv.slice(2);
  assert.ok(
    platform && revision && extra.length === 0,
    "usage: bundle-plan PLATFORM SOURCE_SHA (trusted repository cwd)",
  );
  const plan = planRepositoryBundle(
    {
      lock: readBundleMetadata("pnpm-lock.yaml"),
      manifest: readBundleMetadata("package.json"),
      tooling: readBundleMetadata("packages/tooling/package.json"),
      foundation: readBundleMetadata("config/foundation.json"),
      policy: readBundleMetadata("pnpm-workspace.yaml"),
    },
    bundlePlatform(platform),
    revision,
  );
  const output = `${JSON.stringify(plan, null, 2)}\n`;
  assert.ok(Buffer.byteLength(output) <= LIMITS.bytes, "plan too large");
  process.stdout.write(output);
}
