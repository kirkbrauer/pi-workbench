import assert from "node:assert/strict";
import {
  appendFileSync,
  chmodSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { inspectCheckout } from "../src/checkout.js";
import { connectDatabase, serialized } from "../src/database.js";
import { MIGRATIONS_DIRECTORY, migrateRegistry } from "../src/migrations.js";
import { Registry } from "../src/registry.js";
import * as schema from "../src/schema.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const legacySql = readFileSync(
  new URL("../../tests/fixtures/registry-v1.sql", import.meta.url),
  "utf8",
);
const envId = "env_00000000-0000-0000-0000-000000000001";
const workId = "work_00000000-0000-0000-0000-000000000002";
const repoId = "repo_00000000-0000-0000-0000-000000000003";
const wsId = "ws_00000000-0000-0000-0000-000000000004";

async function legacy(t: TestContext) {
  const directory = realpathSync(
    mkdtempSync(join(tmpdir(), "workbench-migration-")),
  );
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, "registry.sqlite"),
    db = new DatabaseSync(file);
  try {
    db.exec(legacySql);
    db.prepare("INSERT INTO metadata VALUES (1, 'personal', ?)").run(envId);
    db.prepare("INSERT INTO works VALUES (?, ?, ?)").run(
      workId,
      "A 'quoted' Work",
      "Preserve existing state",
    );
    const checkout = await inspectCheckout(realpathSync(root));
    db.prepare("INSERT INTO repositories VALUES (?, ?, ?)").run(
      repoId,
      checkout.commonDir,
      checkout.commonIdentity,
    );
    db.prepare(
      "INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      wsId,
      workId,
      repoId,
      envId,
      checkout.root,
      checkout.gitDir,
      checkout.commonDir,
      checkout.commonIdentity,
      checkout.revision,
      checkout.branch,
    );
    db.prepare("UPDATE context SET generation=7, workspaceId=?").run(wsId);
  } finally {
    db.close();
  }
  chmodSync(file, 0o600);
  return { directory, file };
}

function records(file: string) {
  const db = new DatabaseSync(file);
  try {
    return ["metadata", "works", "repositories", "workspaces", "context"].map(
      (table) => db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all(),
    );
  } finally {
    db.close();
  }
}

async function apply(db: DatabaseSync, folder: string) {
  db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
  try {
    await migrateRegistry(db, "personal", false, folder);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

test("populated merged schema 1 upgrades without losing IDs, context or source observations", async (t) => {
  const f = await legacy(t),
    original = records(f.file),
    registry = await Registry.open(f.directory, "personal");
  try {
    const state = await registry.list();
    assert.equal(registry.environmentId, envId);
    assert.deepEqual(state.works, [
      {
        id: workId,
        name: "A 'quoted' Work",
        objective: "Preserve existing state",
      },
    ]);
    assert.equal(state.repositories[0]?.id, repoId);
    assert.equal(state.workspaces[0]?.id, wsId);
    assert.equal(state.context.generation, 7);
    assert.deepEqual(await registry.context(), state.context);
  } finally {
    registry.close();
  }
  const db = new DatabaseSync(f.file);
  try {
    assert.equal(db.prepare("PRAGMA user_version").get()?.user_version, 2);
    assert.equal(
      db.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get()?.n,
      2,
    );
    assert.ok(
      db
        .prepare(
          "SELECT name FROM sqlite_schema WHERE name='workspaces_work_id_idx'",
        )
        .get(),
    );
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally {
    db.close();
  }
  assert.deepEqual(
    records(f.file),
    original,
    "every legacy row/column must survive",
  );
  const before = readFileSync(f.file),
    reopened = await Registry.open(f.directory, "personal");
  reopened.close();
  assert.deepEqual(
    readFileSync(f.file),
    before,
    "reopening must not reapply migrations",
  );
});

test("legacy wrong-profile and schema-drift failures leave original bytes intact", async (t) => {
  const f = await legacy(t);
  const before = readFileSync(f.file);
  await assert.rejects(Registry.open(f.directory, "work"), /profile mismatch/);
  assert.deepEqual(readFileSync(f.file), before);
  const db = new DatabaseSync(f.file);
  db.exec("ALTER TABLE works ADD COLUMN surprise TEXT");
  db.close();
  const drifted = readFileSync(f.file);
  await assert.rejects(Registry.open(f.directory, "personal"), /schema drift/);
  assert.deepEqual(readFileSync(f.file), drifted);
});

test("failed migration rolls back its DDL, version and journal, then permits a correct retry", async (t) => {
  const f = await legacy(t),
    folder = join(f.directory, "migrations");
  cpSync(MIGRATIONS_DIRECTORY, folder, { recursive: true });
  appendFileSync(
    join(folder, "0001_registry_indexes.sql"),
    "\n--> statement-breakpoint\nINSERT INTO nonexistent_table VALUES (1);\n",
  );
  const before = readFileSync(f.file),
    db = new DatabaseSync(f.file);
  try {
    await assert.rejects(apply(db, folder), /nonexistent_table/);
  } finally {
    db.close();
  }
  assert.deepEqual(readFileSync(f.file), before);
  const restored = await Registry.open(f.directory, "personal");
  try {
    assert.equal((await restored.context()).generation, 7);
  } finally {
    restored.close();
  }
});

test("changed applied migration hashes and malformed journal state are rejected", async (t) => {
  const f = await legacy(t),
    registry = await Registry.open(f.directory, "personal");
  registry.close();
  const folder = join(f.directory, "migrations");
  cpSync(MIGRATIONS_DIRECTORY, folder, { recursive: true });
  appendFileSync(
    join(folder, "0000_registry_v1.sql"),
    "\n-- changed historical bytes\n",
  );
  const before = readFileSync(f.file),
    db = new DatabaseSync(f.file);
  try {
    await assert.rejects(apply(db, folder), /hash mismatch/);
  } finally {
    db.close();
  }
  assert.deepEqual(readFileSync(f.file), before);
  const corrupt = new DatabaseSync(f.file);
  corrupt.exec("DELETE FROM __drizzle_migrations");
  corrupt.close();
  await assert.rejects(
    Registry.open(f.directory, "personal"),
    /journal length/,
  );
});

test("Drizzle proxy maps absent rows, nullable joins, duplicate column names and binary values", async (t) => {
  const f = await legacy(t),
    sqlite = new DatabaseSync(f.file),
    db = connectDatabase(sqlite);
  try {
    assert.equal(
      await db
        .select()
        .from(schema.works)
        .where(eq(schema.works.id, "absent"))
        .get(),
      undefined,
    );
    const pair = await db
      .select({ work: schema.works.id, repository: schema.repositories.id })
      .from(schema.works)
      .innerJoin(schema.repositories, sql`1=1`)
      .get();
    assert.deepEqual(pair, { work: workId, repository: repoId });
    const absent = await db
      .select({ work: schema.works.id, repository: schema.repositories.id })
      .from(schema.works)
      .leftJoin(schema.repositories, sql`1=0`)
      .get();
    assert.deepEqual(absent, { work: workId, repository: null });
    const values = await db.values(
      sql`SELECT ${new Uint8Array([0, 1, 255])}, ${42n}, ${"x' OR 1=1 --"}`,
    );
    assert.deepEqual(values, [
      [new Uint8Array([0, 1, 255]), 42, "x' OR 1=1 --"],
    ]);
  } finally {
    sqlite.close();
  }
});

test("STRICT, uniqueness and foreign key constraints survive migration", async (t) => {
  const f = await legacy(t),
    registry = await Registry.open(f.directory, "personal");
  registry.close();
  const db = new DatabaseSync(f.file, { enableForeignKeyConstraints: true });
  try {
    assert.throws(
      () => db.prepare("UPDATE context SET generation=?").run("not an integer"),
      /INTEGER/,
    );
    assert.throws(() => db.exec("UPDATE context SET generation=-1"), /CHECK/);
    assert.throws(
      () => db.exec("UPDATE metadata SET profile='unknown'"),
      /CHECK/,
    );
    assert.throws(() => db.exec("DELETE FROM works"), /FOREIGN KEY/);
    assert.throws(
      () =>
        db
          .prepare("INSERT INTO works VALUES (?, 'duplicate', 'no')")
          .run(workId),
      /UNIQUE/,
    );
  } finally {
    db.close();
  }
});

test("transaction queue releases after failure and does not admit a second async writer early", async () => {
  const order: number[] = [];
  const first = serialized("fixture-only", async () => {
    order.push(1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    order.push(2);
    throw new Error("expected failure");
  });
  const second = serialized("fixture-only", async () => {
    order.push(3);
  });
  await assert.rejects(first, /expected failure/);
  await second;
  assert.deepEqual(order, [1, 2, 3]);
});
