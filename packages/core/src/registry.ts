import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { type Checkout, inspectCheckout, sameCheckout } from "./checkout.js";

export type Profile = "personal" | "work";

export interface Work {
  id: string;
  name: string;
  objective: string;
}

export interface Repository {
  id: string;
  commonDir: string;
  commonIdentity: string;
}

export interface Workspace extends Checkout {
  id: string;
  workId: string;
  repositoryId: string;
  environmentId: string;
}

export interface Context {
  generation: number;
  workspace: Workspace | null;
}

export function profile(value: string): Profile {
  assert.ok(value === "personal" || value === "work", "unknown profile");
  return value;
}

function text(value: string, max: number): void {
  assert.equal(typeof value, "string");
  assert.ok(
    value.trim().length > 0 && value.length <= max && !/[\p{Cc}]/u.test(value),
    "invalid text",
  );
}

function id(value: string, kind: string): void {
  assert.match(
    value,
    new RegExp(`^${kind}_[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$`),
    "invalid ID",
  );
}

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

/** Operator-owned local metadata only. Not a broker, grant store or worker API. */
export class Registry {
  readonly #db: DatabaseSync;
  readonly environmentId: string;
  readonly profile: Profile;

  constructor(directory: string, selectedProfile: Profile, create = false) {
    this.profile = profile(selectedProfile);
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
    this.#db = new DatabaseSync(file, {
      enableForeignKeyConstraints: true,
      enableDoubleQuotedStringLiterals: false,
      allowExtension: false,
    });
    try {
      this.#db.exec("PRAGMA busy_timeout=1000; PRAGMA trusted_schema=OFF;");
      this.environmentId = this.#transaction(() => {
        const version = this.#db
          .prepare("PRAGMA user_version")
          .get()?.user_version;
        if (version === 0) {
          assert.ok(create, "uninitialized registry; run init");
          assert.equal(
            this.#db.prepare("SELECT count(*) AS n FROM sqlite_schema").get()
              ?.n,
            0,
            "refusing to initialize an unrelated database",
          );
          this.#db.exec(`
            CREATE TABLE metadata (singleton INTEGER PRIMARY KEY CHECK(singleton=1), profile TEXT NOT NULL CHECK(profile IN ('personal','work')), environmentId TEXT NOT NULL) STRICT;
            CREATE TABLE works (id TEXT PRIMARY KEY, name TEXT NOT NULL, objective TEXT NOT NULL) STRICT;
            CREATE TABLE repositories (id TEXT PRIMARY KEY, commonDir TEXT NOT NULL UNIQUE, commonIdentity TEXT NOT NULL) STRICT;
            CREATE TABLE workspaces (
              id TEXT PRIMARY KEY, workId TEXT NOT NULL REFERENCES works(id),
              repositoryId TEXT NOT NULL REFERENCES repositories(id), environmentId TEXT NOT NULL,
              root TEXT NOT NULL UNIQUE, gitDir TEXT NOT NULL UNIQUE, commonDir TEXT NOT NULL,
              commonIdentity TEXT NOT NULL, revision TEXT NOT NULL, branch TEXT
            ) STRICT;
            CREATE TABLE context (singleton INTEGER PRIMARY KEY CHECK(singleton=1), generation INTEGER NOT NULL CHECK(generation>=0), workspaceId TEXT REFERENCES workspaces(id)) STRICT;
            INSERT INTO context VALUES (1, 0, NULL);
            PRAGMA user_version=1;
          `);
          this.#db
            .prepare("INSERT INTO metadata VALUES (1, ?, ?)")
            .run(this.profile, `env_${randomUUID()}`);
        } else {
          assert.equal(
            version,
            1,
            "unsupported registry schema; no automatic downgrade/reset",
          );
        }
        const metadata = this.#db
          .prepare("SELECT * FROM metadata WHERE singleton=1")
          .get();
        assert.equal(
          metadata?.profile,
          this.profile,
          "registry profile mismatch",
        );
        assert.equal(typeof metadata?.environmentId, "string");
        const environmentId = String(metadata?.environmentId);
        id(environmentId, "env");
        return environmentId;
      });
    } catch (error) {
      this.#db.close();
      throw error;
    }
  }

  close(): void {
    this.#db.close();
  }

  #transaction<T>(operation: () => T): T {
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.#db.exec("COMMIT");
      return result;
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  createWork(name: string, objective: string): Work {
    text(name, 200);
    text(objective, 4_000);
    const work = { id: `work_${randomUUID()}`, name, objective };
    this.#db
      .prepare("INSERT INTO works VALUES (?, ?, ?)")
      .run(work.id, name, objective);
    return work;
  }

  /** Stored observations, deliberately not a fresh checkout/permission assertion. */
  list(): {
    works: Work[];
    repositories: Repository[];
    workspaces: Workspace[];
    context: Context;
  } {
    return this.#transaction(() => ({
      context: this.#context(),
      works: this.#db
        .prepare("SELECT * FROM works ORDER BY id")
        .all() as unknown as Work[],
      repositories: this.#db
        .prepare("SELECT * FROM repositories ORDER BY id")
        .all() as unknown as Repository[],
      workspaces: this.#db
        .prepare("SELECT * FROM workspaces ORDER BY id")
        .all() as unknown as Workspace[],
    }));
  }

  #workspace(workspaceId: string): Workspace {
    id(workspaceId, "ws");
    const workspace = this.#db
      .prepare("SELECT * FROM workspaces WHERE id=?")
      .get(workspaceId) as unknown as Workspace | undefined;
    assert.ok(workspace, "unknown workspace in this profile");
    assert.equal(
      workspace.environmentId,
      this.environmentId,
      "environment mismatch",
    );
    return { ...workspace };
  }

  async adopt(workId: string, checkoutRoot: string): Promise<Workspace> {
    id(workId, "work");
    assert.ok(
      this.#db.prepare("SELECT id FROM works WHERE id=?").get(workId),
      "unknown Work in this profile",
    );
    const checkout = await inspectCheckout(checkoutRoot);
    return this.#transaction(() => {
      const existing = this.#db
        .prepare("SELECT * FROM workspaces WHERE root=?")
        .get(checkout.root) as unknown as Workspace | undefined;
      if (existing) {
        assert.equal(
          existing.workId,
          workId,
          "checkout already belongs to another Work",
        );
        sameCheckout(existing, checkout);
        return { ...existing };
      }
      let repository = this.#db
        .prepare("SELECT * FROM repositories WHERE commonDir=?")
        .get(checkout.commonDir) as unknown as Repository | undefined;
      if (repository) {
        assert.equal(
          repository.commonIdentity,
          checkout.commonIdentity,
          "repository identity drift",
        );
      } else {
        repository = {
          id: `repo_${randomUUID()}`,
          commonDir: checkout.commonDir,
          commonIdentity: checkout.commonIdentity,
        };
        this.#db
          .prepare("INSERT INTO repositories VALUES (?, ?, ?)")
          .run(repository.id, repository.commonDir, repository.commonIdentity);
      }
      const workspace: Workspace = {
        id: `ws_${randomUUID()}`,
        workId,
        repositoryId: repository.id,
        environmentId: this.environmentId,
        ...checkout,
      };
      this.#db
        .prepare("INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(
          workspace.id,
          workId,
          repository.id,
          this.environmentId,
          checkout.root,
          checkout.gitDir,
          checkout.commonDir,
          checkout.commonIdentity,
          checkout.revision,
          checkout.branch,
        );
      return workspace;
    });
  }

  #context(): Context {
    const row = this.#db
      .prepare("SELECT generation, workspaceId FROM context WHERE singleton=1")
      .get();
    assert.ok(
      row &&
        typeof row.generation === "number" &&
        Number.isSafeInteger(row.generation) &&
        row.generation >= 0,
      "invalid context generation",
    );
    const workspace =
      row.workspaceId === null
        ? null
        : this.#workspace(String(row.workspaceId));
    return { generation: row.generation, workspace };
  }

  async context(): Promise<Context> {
    const observed = this.#context();
    const checkout = observed.workspace
      ? await inspectCheckout(observed.workspace.root)
      : null;
    return this.#transaction(() => {
      const current = this.#context();
      assert.equal(
        current.generation,
        observed.generation,
        "context changed during inspection",
      );
      if (current.workspace && checkout)
        sameCheckout(current.workspace, checkout);
      return current;
    });
  }

  #generation(expected: number): Context {
    assert.ok(
      Number.isSafeInteger(expected) &&
        expected >= 0 &&
        expected < Number.MAX_SAFE_INTEGER,
      "invalid expected generation",
    );
    const current = this.#context();
    assert.equal(current.generation, expected, "stale context generation");
    return current;
  }

  async select(
    workspaceId: string,
    expectedGeneration: number,
  ): Promise<Context> {
    this.#generation(expectedGeneration);
    const observed = this.#workspace(workspaceId);
    const checkout = await inspectCheckout(observed.root);
    return this.#transaction(() => {
      this.#generation(expectedGeneration);
      const workspace = this.#workspace(workspaceId);
      sameCheckout(workspace, checkout);
      this.#db
        .prepare(
          "UPDATE context SET generation=generation+1, workspaceId=? WHERE singleton=1",
        )
        .run(workspaceId);
      return this.#context();
    });
  }

  /** Explicitly accept new HEAD/branch observations; never rewrite a checkout. */
  async refresh(
    workspaceId: string,
    expectedGeneration: number,
  ): Promise<Workspace> {
    this.#generation(expectedGeneration);
    const observed = this.#workspace(workspaceId);
    const checkout = await inspectCheckout(observed.root);
    return this.#transaction(() => {
      this.#generation(expectedGeneration);
      const workspace = this.#workspace(workspaceId);
      sameCheckout(workspace, checkout, false);
      this.#db
        .prepare("UPDATE workspaces SET revision=?, branch=? WHERE id=?")
        .run(checkout.revision, checkout.branch, workspaceId);
      // Invalidate prior contexts even when refreshing a non-selected workspace.
      this.#db.exec(
        "UPDATE context SET generation=generation+1 WHERE singleton=1",
      );
      return this.#workspace(workspaceId);
    });
  }
}
