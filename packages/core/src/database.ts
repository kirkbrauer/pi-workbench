import assert from "node:assert/strict";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { type AsyncRemoteCallback, drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema.js";

/** Serialize async ORM transactions sharing a file within this JS process.
 * Cross-process exclusion remains SQLite BEGIN IMMEDIATE / busy_timeout.
 */
const queues = new Map<string, Promise<void>>();

export async function serialized<T>(
  file: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = queues.get(file) ?? Promise.resolve();
  let release = () => {};
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  queues.set(file, next);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (queues.get(file) === next) queues.delete(file);
  }
}

function parameter(value: unknown): SQLInputValue {
  if (ArrayBuffer.isView(value))
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  assert.ok(
    value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "bigint",
    "unsupported SQLite parameter",
  );
  return value;
}

/** Official Drizzle proxy callback, executed entirely in-process; no remote SQL. */
export function connectDatabase(sqlite: DatabaseSync) {
  const callback: AsyncRemoteCallback = async (
    query,
    params: unknown[],
    method,
  ) => {
    const statement = sqlite.prepare(query);
    const bindings = params.map(parameter);
    if (method === "run") {
      statement.run(...bindings);
      return { rows: [] };
    }
    statement.setReturnArrays(true);
    const rows =
      method === "get"
        ? statement.get(...bindings)
        : statement.all(...bindings);
    assert.ok(
      rows === undefined || Array.isArray(rows),
      "SQLite array result required",
    );
    // node:sqlite's typings don't model setReturnArrays; Drizzle's callback typing
    // also omits undefined for a missing get row, which its runtime mapper expects.
    // Keep the compatibility cast here, never cast application/domain rows.
    return { rows } as Awaited<ReturnType<AsyncRemoteCallback>>;
  };
  return drizzle(callback, { schema });
}

export type StoreDatabase = ReturnType<typeof connectDatabase>;

export type QueryDatabase = Pick<
  StoreDatabase,
  "select" | "insert" | "update" | "delete" | "run" | "values"
>;

function privatePath(path: string, directory: boolean): void {
  const stat = lstatSync(path);
  assert.ok(
    process.getuid && process.geteuid && process.getuid() === process.geteuid(),
    "ordinary POSIX user required",
  );
  assert.equal(stat.uid, process.getuid(), "state must be operator-owned");
  assert.ok(
    directory ? stat.isDirectory() : stat.isFile() && stat.nlink === 1,
    "invalid state file/directory",
  );
  assert.equal(
    stat.mode & 0o7777,
    directory ? 0o700 : 0o600,
    "private state mode required",
  );
}

export function stateFile(directory: string, create: boolean): string {
  assert.ok(isAbsolute(directory), "absolute state directory required");
  if (create && !existsSync(directory))
    mkdirSync(directory, { mode: 0o700, recursive: true });
  privatePath(resolve(directory), true);
  const file = join(realpathSync(directory), "registry.sqlite");
  if (create && !existsSync(file)) closeSync(openSync(file, "wx", 0o600));
  privatePath(file, false);
  for (const suffix of ["-journal", "-wal", "-shm"]) {
    if (lstatSync(file + suffix, { throwIfNoEntry: false }))
      privatePath(file + suffix, false);
  }
  return file;
}
