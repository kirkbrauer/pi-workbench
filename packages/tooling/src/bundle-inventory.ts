import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Stats } from "node:fs";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  opendirSync,
  openSync,
  readSync,
  realpathSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const INVENTORY_LIMITS = Object.freeze({
  metadataBytes: 16 * 1024 * 1024,
  entries: 50_000,
  fileBytes: 512 * 1024 * 1024,
  totalBytes: 2 * 1024 * 1024 * 1024,
} as const);

const PLATFORMS = ["linux-x64-gnu", "darwin-arm64"] as const;

export type BundlePlatform = (typeof PLATFORMS)[number];

export interface BundleComponent {
  id: string;
  version: string;
  sourceUrl: string;
  sourceSha256: string;
  license: string;
}

export interface BundleDescription {
  schema: 1;
  platform: BundlePlatform;
  sourceRevision: string;
  lockSha256: string;
  foundationSha256: string;
  components: BundleComponent[];
}

export type BundleEntry =
  | { path: string; kind: "directory"; mode: number }
  | { path: string; kind: "file"; mode: number; size: number; sha256: string };

export interface BundleInventory extends BundleDescription {
  entries: BundleEntry[];
}

export const sha256 = (bytes: string | Buffer): string =>
  createHash("sha256").update(bytes).digest("hex");

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function object(value: unknown, keys: string[]): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  const record = value as Record<string, unknown>;
  assert.deepEqual(
    Object.keys(record).sort(),
    [...keys].sort(),
    "unexpected fields",
  );
  return record;
}

function text(value: unknown, pattern: RegExp, limit = 512): string {
  assert.ok(
    typeof value === "string" && value.length <= limit,
    "invalid string",
  );
  assert.ok(
    [...value].every((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    }),
    "control characters are forbidden",
  );
  assert.match(value, pattern);
  return value;
}

function hash(value: unknown): string {
  return text(value, /^[a-f0-9]{64}$/);
}

function integer(value: unknown, max: number): number {
  assert.ok(typeof value === "number" && Number.isSafeInteger(value));
  assert.ok(value >= 0 && value <= max, "integer exceeds bounds");
  return value;
}

export function bundlePlatform(value: unknown): BundlePlatform {
  assert.ok(
    PLATFORMS.some((platform) => value === platform),
    "unsupported platform",
  );
  return value as BundlePlatform;
}

function portablePath(value: unknown): string {
  const path = text(value, /^[A-Za-z0-9@_.+\-/]+$/);
  const segments = path.split("/");
  assert.ok(segments.length <= 32, "path too deep");
  assert.ok(
    segments.every((part) => part !== "" && part !== "." && part !== ".."),
    "path escape or ambiguous path",
  );
  return path;
}

function component(value: unknown): BundleComponent {
  const input = object(value, [
    "id",
    "version",
    "sourceUrl",
    "sourceSha256",
    "license",
  ]);
  const sourceUrl = text(input.sourceUrl, /^https:\/\//, 2048);
  const url = new URL(sourceUrl);
  assert.ok(
    !url.username && !url.password && !url.search && !url.hash,
    "source URL must not contain credentials/query/fragment",
  );
  return {
    id: text(input.id, /^[a-z][a-z0-9-]{0,63}$/),
    version: text(
      input.version,
      /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?$/,
      128,
    ),
    sourceUrl,
    sourceSha256: hash(input.sourceSha256),
    license: text(input.license, /^[A-Za-z0-9 ().:+-]+$/, 128),
  };
}

const DESCRIPTION_KEYS = [
  "schema",
  "platform",
  "sourceRevision",
  "lockSha256",
  "foundationSha256",
  "components",
];

export function validateBundleDescription(value: unknown): BundleDescription {
  const input = object(value, DESCRIPTION_KEYS);
  assert.equal(input.schema, 1, "unsupported schema");
  assert.ok(Array.isArray(input.components) && input.components.length <= 512);
  const components = input.components
    .map(component)
    .sort((a, b) => compare(a.id, b.id));
  const ids = new Set(components.map((item) => item.id));
  assert.equal(ids.size, components.length, "duplicate component");
  for (const id of ["node", "pi", "workbench"])
    assert.ok(ids.has(id), `missing required component: ${id}`);
  return {
    schema: 1,
    platform: bundlePlatform(input.platform),
    sourceRevision: text(input.sourceRevision, /^[a-f0-9]{40}$/),
    lockSha256: hash(input.lockSha256),
    foundationSha256: hash(input.foundationSha256),
    components,
  };
}

function entry(value: unknown): BundleEntry {
  assert.ok(value && typeof value === "object");
  const kind = (value as Record<string, unknown>).kind;
  assert.ok(kind === "file" || kind === "directory", "invalid entry kind");
  const input = object(
    value,
    kind === "file"
      ? ["path", "kind", "mode", "size", "sha256"]
      : ["path", "kind", "mode"],
  );
  const mode = integer(input.mode, 0o7777);
  assert.ok(
    (kind === "file" ? [0o600, 0o644, 0o700, 0o755] : [0o700, 0o755]).includes(
      mode,
    ),
    "unsafe mode",
  );
  const base = { path: portablePath(input.path), kind, mode };
  return kind === "file"
    ? {
        ...base,
        kind,
        size: integer(input.size, INVENTORY_LIMITS.fileBytes),
        sha256: hash(input.sha256),
      }
    : { ...base, kind };
}

export function serializeInventory(inventory: BundleInventory): string {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

/** Metadata only. This does not execute, fetch, install, attest or authorize a payload. */
export function parseInventory(bytes: Buffer): BundleInventory {
  assert.ok(
    bytes.length <= INVENTORY_LIMITS.metadataBytes,
    "metadata too large",
  );
  const input = object(JSON.parse(bytes.toString("utf8")), [
    ...DESCRIPTION_KEYS,
    "entries",
  ]);
  const { entries: rawEntries, ...rawDescription } = input;
  const description = validateBundleDescription(rawDescription);
  assert.ok(
    Array.isArray(rawEntries) && rawEntries.length <= INVENTORY_LIMITS.entries,
    "invalid/too many entries",
  );
  const entries = rawEntries.map(entry).sort((a, b) => compare(a.path, b.path));
  const paths = new Map<string, BundleEntry>();
  const folded = new Set<string>();
  const counts = new Map(description.components.map((item) => [item.id, 0]));
  let total = 0;
  for (const item of entries) {
    const owner = item.path.split("/")[0] ?? "";
    assert.ok(counts.has(owner), "unowned path");
    assert.ok(
      !folded.has(item.path.toLowerCase()),
      "duplicate/case-colliding path",
    );
    folded.add(item.path.toLowerCase());
    const slash = item.path.lastIndexOf("/");
    if (slash < 0)
      assert.equal(
        item.kind,
        "directory",
        "component root must be a directory",
      );
    else
      assert.equal(
        paths.get(item.path.slice(0, slash))?.kind,
        "directory",
        "missing parent directory",
      );
    paths.set(item.path, item);
    if (item.kind === "file") {
      total += item.size;
      counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }
  }
  assert.ok(total <= INVENTORY_LIMITS.totalBytes, "payload too large");
  assert.ok(
    [...counts.values()].every((count) => count > 0),
    "empty component",
  );
  const inventory = { ...description, entries };
  // A single canonical encoding also rejects duplicate JSON keys, alternate ordering,
  // invalid UTF-8 replacement, and ambiguous numeric/string encodings.
  assert.ok(
    Buffer.from(serializeInventory(inventory)).equals(bytes),
    "noncanonical inventory",
  );
  return inventory;
}

function unchangedFile(actual: Stats, expected: Stats): void {
  for (const field of [
    "dev",
    "ino",
    "size",
    "mode",
    "uid",
    "gid",
    "mtimeMs",
    "ctimeMs",
    "nlink",
  ] as const)
    assert.equal(actual[field], expected[field], `file changed: ${field}`);
}

function owned(stat: Stats): void {
  assert.ok(process.getuid, "POSIX ownership checks required");
  assert.equal(
    stat.uid,
    process.getuid(),
    "staging tree must be operator-owned",
  );
}

function openReadOnly(path: string): number {
  // O_NOFOLLOW covers the final component only. O_NONBLOCK prevents a late FIFO
  // substitution from hanging open before fstat can reject it. Neither provides
  // race-free traversal or a wall-clock bound on filesystem operations.
  return openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
}

function hashFile(path: string, expected: Stats): string {
  const fd = openReadOnly(path);
  try {
    const before = fstatSync(fd);
    assert.ok(before.isFile() && before.nlink === 1, "linked/nonregular file");
    unchangedFile(before, expected);
    const digest = createHash("sha256");
    const buffer = Buffer.alloc(64 * 1024);
    let size = 0;
    for (;;) {
      const count = readSync(fd, buffer);
      if (!count) break;
      size += count;
      assert.ok(
        size <= before.size && size <= INVENTORY_LIMITS.fileBytes,
        "file changed/too large",
      );
      digest.update(buffer.subarray(0, count));
    }
    const after = fstatSync(fd);
    assert.equal(size, before.size, "file changed while reading");
    unchangedFile(after, before);
    return digest.digest("hex");
  } finally {
    closeSync(fd);
  }
}

/** Run only on an operator-owned, stationary staging tree; not a filesystem sandbox. */
export function inventoryDirectory(
  root: string,
  value: unknown,
): BundleInventory {
  const description = validateBundleDescription(value);
  const rootStat = lstatSync(root);
  assert.ok(rootStat.isDirectory(), "staging root must not be a symlink");
  owned(rootStat);
  assert.ok(
    [0o700, 0o755].includes(rootStat.mode & 0o7777),
    "unsafe staging root mode",
  );
  const base = realpathSync(root);
  const owners = new Set(description.components.map((item) => item.id));
  const entries: BundleEntry[] = [];
  let total = 0;

  function children(absolute: string, relative: string): void {
    // Read incrementally; readdirSync would allocate the whole directory before
    // the entry budget could reject it. Canonical order is established at the end.
    const directory = opendirSync(absolute);
    try {
      for (;;) {
        const child = directory.readSync();
        if (!child) break;
        walk(relative ? `${relative}/${child.name}` : child.name);
      }
    } finally {
      directory.closeSync();
    }
  }

  function walk(relative: string): void {
    const path = portablePath(relative);
    assert.ok(owners.has(path.split("/")[0] ?? ""), "unowned path");
    assert.ok(entries.length < INVENTORY_LIMITS.entries, "too many entries");
    const absolute = join(base, path);
    const stat = lstatSync(absolute);
    owned(stat);
    assert.ok(
      stat.isDirectory() || stat.isFile(),
      "symlinks/special files are forbidden",
    );
    const mode = stat.mode & 0o7777;
    if (stat.isDirectory()) {
      entries.push(entry({ path, kind: "directory", mode }));
      children(absolute, path);
    } else {
      assert.equal(stat.nlink, 1, "hard links are forbidden");
      integer(stat.size, INVENTORY_LIMITS.fileBytes);
      total += stat.size;
      assert.ok(total <= INVENTORY_LIMITS.totalBytes, "payload too large");
      // Validate mode before reading any payload bytes.
      entry({
        path,
        kind: "file",
        mode,
        size: stat.size,
        sha256: "0".repeat(64),
      });
      entries.push({
        path,
        kind: "file",
        mode,
        size: stat.size,
        sha256: hashFile(absolute, stat),
      });
    }
  }

  children(base, "");
  const inventory = {
    ...description,
    entries: entries.sort((a, b) => compare(a.path, b.path)),
  };
  return parseInventory(Buffer.from(serializeInventory(inventory)));
}

/** The expected digest/platform MUST come from outside the candidate inventory. */
export function verifyBundleDirectory(
  root: string,
  bytes: Buffer,
  expectedSha256: string,
  expectedPlatform: BundlePlatform,
): BundleInventory {
  hash(expectedSha256);
  bundlePlatform(expectedPlatform);
  assert.ok(
    bytes.length <= INVENTORY_LIMITS.metadataBytes,
    "metadata too large",
  );
  assert.equal(sha256(bytes), expectedSha256, "inventory digest mismatch");
  const inventory = parseInventory(bytes);
  assert.equal(inventory.platform, expectedPlatform, "platform mismatch");
  const { entries, ...description } = inventory;
  assert.deepEqual(
    inventoryDirectory(root, description).entries,
    entries,
    "payload mismatch",
  );
  return inventory;
}

function metadata(path: string): Buffer {
  const fd = openReadOnly(path);
  try {
    const stat = fstatSync(fd);
    assert.ok(
      stat.isFile() &&
        stat.nlink === 1 &&
        stat.size <= INVENTORY_LIMITS.metadataBytes,
      "invalid metadata file",
    );
    // Bound the read even if another writer grows the file. The staging-tree
    // precondition still applies; this is not an atomic activation protocol.
    const bytes = Buffer.alloc(INVENTORY_LIMITS.metadataBytes + 1);
    let size = 0;
    while (size < bytes.length) {
      const count = readSync(fd, bytes, size, bytes.length - size, null);
      if (!count) break;
      size += count;
    }
    assert.ok(size <= INVENTORY_LIMITS.metadataBytes, "metadata too large");
    assert.equal(size, stat.size, "metadata changed while reading");
    unchangedFile(fstatSync(fd), stat);
    return bytes.subarray(0, size);
  } finally {
    closeSync(fd);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [action, root, file, digest, platform, ...extra] =
    process.argv.slice(2);
  assert.ok(
    root && file && extra.length === 0,
    "usage: bundle-inventory inventory ROOT DESCRIPTION | verify ROOT INVENTORY EXPECTED_SHA256 PLATFORM",
  );
  if (action === "inventory") {
    assert.ok(digest === undefined && platform === undefined);
    process.stdout.write(
      serializeInventory(
        inventoryDirectory(root, JSON.parse(metadata(file).toString("utf8"))),
      ),
    );
  } else {
    assert.ok(action === "verify" && digest && platform);
    const result = verifyBundleDirectory(
      root,
      metadata(file),
      digest,
      bundlePlatform(platform),
    );
    console.log(
      JSON.stringify({
        status: "content-verified-only",
        inventorySha256: digest,
        platform: result.platform,
        sourceRevision: result.sourceRevision,
        entries: result.entries.length,
        qualification: "not-installed-not-approved-not-runtime-qualified",
      }),
    );
  }
}
