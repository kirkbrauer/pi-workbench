import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const core = fileURLToPath(new URL("../../", import.meta.url));
const root = fileURLToPath(new URL("../../../../", import.meta.url));

test("Drizzle snapshots match the typed schema and generation detects an actual added table", (t) => {
  mkdirSync(join(root, ".local"), { recursive: true });
  const fixture = mkdtempSync(join(root, ".local/orm-generator-"));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const schema = join(fixture, "schema.ts"),
    migrations = join(fixture, "migrations");
  const config = join(fixture, "drizzle.config.cjs");
  cpSync(join(core, "migrations"), migrations, { recursive: true });
  cpSync(join(core, "src/schema.ts"), schema);
  writeFileSync(
    config,
    // Kit's snapshot loader prefixes './'; use cwd-relative out like production.
    `module.exports = ${JSON.stringify({ dialect: "sqlite", schema, out: relative(root, migrations) })};\n`,
  );
  const generate = () => {
    const result = spawnSync(
      process.execPath,
      [
        join(root, "node_modules/drizzle-kit/bin.cjs"),
        "generate",
        "--config",
        config,
        "--name=fixture",
      ],
      {
        cwd: root,
        env: { HOME: fixture, PATH: "/usr/bin:/bin" },
        encoding: "utf8",
        timeout: 20_000,
        maxBuffer: 128 * 1024,
      },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return result;
  };
  const before = readFileSync(join(migrations, "meta/_journal.json"));
  const unchanged = generate();
  assert.match(
    unchanged.stdout,
    /No schema changes/,
    unchanged.stdout + unchanged.stderr,
  );
  assert.deepEqual(
    readFileSync(join(migrations, "meta/_journal.json")),
    before,
  );
  appendFileSync(
    schema,
    '\nexport const addedFixture = sqliteTable("added_fixture", { id: text().primaryKey() });\n',
  );
  generate();
  assert.ok(
    readdirSync(migrations).some(
      (name) => name.startsWith("0002_") && name.endsWith(".sql"),
    ),
  );
  assert.notDeepEqual(
    readFileSync(join(migrations, "meta/_journal.json")),
    before,
  );
});
