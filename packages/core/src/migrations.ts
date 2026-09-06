import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { connectDatabase } from "./database.js";
import { metadata } from "./schema.js";

export const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL("../../migrations", import.meta.url),
);

export const SCHEMA_VERSION = 2;

function schemaSignature(db: DatabaseSync) {
  return db
    .prepare(
      "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' AND name != '__drizzle_migrations' ORDER BY name",
    )
    .all()
    .map((row) => ({
      ...row,
      sql:
        typeof row.sql === "string"
          ? row.sql.replace(/\s+/g, " ").trim()
          : row.sql,
    }));
}

/** Must run inside the caller's IMMEDIATE transaction and per-file queue. */
export async function migrateRegistry(
  sqlite: DatabaseSync,
  profile: "personal" | "work",
  create: boolean,
  directory = MIGRATIONS_DIRECTORY,
): Promise<string> {
  const db = connectDatabase(sqlite);
  const migrations = readMigrationFiles({ migrationsFolder: directory });
  assert.equal(
    migrations.length,
    SCHEMA_VERSION,
    "migration/schema version mismatch",
  );
  let previousTime = -1;
  for (const migration of migrations) {
    assert.ok(
      Number.isSafeInteger(migration.folderMillis) &&
        migration.folderMillis > previousTime,
      "invalid migration order",
    );
    previousTime = migration.folderMillis;
  }
  const version = sqlite.prepare("PRAGMA user_version").get()?.user_version;
  assert.ok(
    typeof version === "number" &&
      Number.isInteger(version) &&
      version >= 0 &&
      version <= SCHEMA_VERSION,
    "unsupported registry schema; no automatic downgrade/reset",
  );
  const ledgerExists =
    sqlite
      .prepare(
        "SELECT name FROM sqlite_schema WHERE name='__drizzle_migrations'",
      )
      .get() !== undefined;
  let environmentId: string;
  if (version === 0) {
    assert.ok(create, "uninitialized registry; run init");
    assert.equal(
      sqlite.prepare("SELECT count(*) AS n FROM sqlite_schema").get()?.n,
      0,
      "refusing to initialize an unrelated database",
    );
    environmentId = `env_${randomUUID()}`;
  } else {
    // Reject wrong-profile opens before any migration or journal write.
    const row = await db
      .select()
      .from(metadata)
      .where(eq(metadata.singleton, 1))
      .get();
    assert.equal(row?.profile, profile, "registry profile mismatch");
    assert.ok(
      row &&
        /^env_[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(
          row.environmentId,
        ),
      "invalid environment ID",
    );
    environmentId = row.environmentId;
    const reference = new DatabaseSync(":memory:");
    try {
      for (const migration of migrations.slice(0, version))
        for (const statement of migration.sql) reference.exec(statement);
      assert.deepEqual(
        schemaSignature(sqlite),
        schemaSignature(reference),
        "registry schema drift",
      );
    } finally {
      reference.close();
    }
    assert.deepEqual(
      sqlite.prepare("PRAGMA foreign_key_check").all(),
      [],
      "registry foreign key violation",
    );
    if (version === 1)
      assert.equal(ledgerExists, false, "unexpected legacy migration journal");
    else {
      assert.ok(ledgerExists, "missing migration journal");
      const applied = sqlite
        .prepare(
          "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at",
        )
        .all();
      assert.equal(applied.length, version, "invalid migration journal length");
      for (const [index, row] of applied.entries()) {
        assert.equal(
          row.hash,
          migrations[index]?.hash,
          "migration hash mismatch",
        );
        assert.equal(
          row.created_at,
          migrations[index]?.folderMillis,
          "migration order mismatch",
        );
      }
    }
  }
  if (version === 1) {
    // Adopt the exact already-applied historical schema without replaying CREATE/INSERT.
    // Same journal shape as the pinned official proxy migrator below.
    await db.run(
      sql`CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
    );
    const baseline = migrations[0];
    assert.ok(baseline);
    await db.run(
      sql`INSERT INTO __drizzle_migrations (hash, created_at) VALUES (${baseline.hash}, ${baseline.folderMillis})`,
    );
  }
  await migrate(
    db,
    async (statements) => {
      for (const statement of statements) sqlite.exec(statement);
    },
    { migrationsFolder: directory },
  );
  if (version === 0)
    await db
      .insert(metadata)
      .values({ singleton: 1, profile, environmentId })
      .run();
  assert.equal(
    sqlite.prepare("PRAGMA user_version").get()?.user_version,
    SCHEMA_VERSION,
  );
  assert.deepEqual(
    sqlite.prepare("PRAGMA foreign_key_check").all(),
    [],
    "registry foreign key violation",
  );
  return environmentId;
}
