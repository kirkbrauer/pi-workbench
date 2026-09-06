import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { eq, sql } from "drizzle-orm";
import { inspectCheckout, sameCheckout } from "./checkout.js";
import {
  connectDatabase,
  type QueryDatabase,
  type StoreDatabase,
  serialized,
  stateFile,
} from "./database.js";
import { migrateRegistry } from "./migrations.js";
import * as schema from "./schema.js";

export type Profile = (typeof schema.metadata.$inferSelect)["profile"];

export type Work = typeof schema.works.$inferSelect;

export type Repository = typeof schema.repositories.$inferSelect;

export type Workspace = typeof schema.workspaces.$inferSelect;

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

/** Operator-owned local metadata only. Not a broker, grant store or worker API. */
export class Registry {
  readonly #db: StoreDatabase;
  readonly #sqlite: DatabaseSync;
  readonly #file: string;
  readonly environmentId: string;
  readonly profile: Profile;

  private constructor(
    file: string,
    sqlite: DatabaseSync,
    environmentId: string,
    selectedProfile: Profile,
  ) {
    this.#file = file;
    this.#sqlite = sqlite;
    this.#db = connectDatabase(sqlite);
    this.environmentId = environmentId;
    this.profile = selectedProfile;
  }

  static async open(
    directory: string,
    selectedProfile: Profile,
    create = false,
  ): Promise<Registry> {
    profile(selectedProfile);
    const file = stateFile(directory, create);
    return serialized(file, async () => {
      const sqlite = new DatabaseSync(file, {
        enableForeignKeyConstraints: true,
        enableDoubleQuotedStringLiterals: false,
        allowExtension: false,
      });
      try {
        sqlite.exec("PRAGMA busy_timeout=1000; PRAGMA trusted_schema=OFF;");
        sqlite.exec("BEGIN IMMEDIATE");
        let environmentId: string;
        try {
          environmentId = await migrateRegistry(
            sqlite,
            selectedProfile,
            create,
          );
          sqlite.exec("COMMIT");
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
        return new Registry(file, sqlite, environmentId, selectedProfile);
      } catch (error) {
        sqlite.close();
        throw error;
      }
    });
  }

  /** Await all operations before closing this connection. */
  close(): void {
    this.#sqlite.close();
  }

  #transaction<T>(operation: (db: QueryDatabase) => Promise<T>): Promise<T> {
    return serialized(this.#file, () =>
      this.#db.transaction(operation, { behavior: "immediate" }),
    );
  }

  async createWork(name: string, objective: string): Promise<Work> {
    text(name, 200);
    text(objective, 4_000);
    const work = { id: `work_${randomUUID()}`, name, objective };
    return this.#transaction(async (db) => {
      await db.insert(schema.works).values(work).run();
      return work;
    });
  }

  /** Stored observations, deliberately not a fresh checkout/permission assertion. */
  list(): Promise<{
    works: Work[];
    repositories: Repository[];
    workspaces: Workspace[];
    context: Context;
  }> {
    return this.#transaction(async (db) => ({
      context: await this.#context(db),
      works: await db
        .select()
        .from(schema.works)
        .orderBy(schema.works.id)
        .all(),
      repositories: await db
        .select()
        .from(schema.repositories)
        .orderBy(schema.repositories.id)
        .all(),
      workspaces: await db
        .select()
        .from(schema.workspaces)
        .orderBy(schema.workspaces.id)
        .all(),
    }));
  }

  async #workspace(db: QueryDatabase, workspaceId: string): Promise<Workspace> {
    id(workspaceId, "ws");
    const workspace = await db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, workspaceId))
      .get();
    assert.ok(workspace, "unknown workspace in this profile");
    assert.equal(
      workspace.environmentId,
      this.environmentId,
      "environment mismatch",
    );
    return workspace;
  }

  async adopt(workId: string, checkoutRoot: string): Promise<Workspace> {
    id(workId, "work");
    await this.#transaction(async (db) => {
      assert.ok(
        await db
          .select({ id: schema.works.id })
          .from(schema.works)
          .where(eq(schema.works.id, workId))
          .get(),
        "unknown Work in this profile",
      );
    });
    const checkout = await inspectCheckout(checkoutRoot);
    return this.#transaction(async (db) => {
      const existing = await db
        .select()
        .from(schema.workspaces)
        .where(eq(schema.workspaces.root, checkout.root))
        .get();
      if (existing) {
        assert.equal(
          existing.workId,
          workId,
          "checkout already belongs to another Work",
        );
        sameCheckout(existing, checkout);
        return existing;
      }
      let repository = await db
        .select()
        .from(schema.repositories)
        .where(eq(schema.repositories.commonDir, checkout.commonDir))
        .get();
      if (repository)
        assert.equal(
          repository.commonIdentity,
          checkout.commonIdentity,
          "repository identity drift",
        );
      else {
        repository = {
          id: `repo_${randomUUID()}`,
          commonDir: checkout.commonDir,
          commonIdentity: checkout.commonIdentity,
        };
        await db.insert(schema.repositories).values(repository).run();
      }
      const workspace: Workspace = {
        id: `ws_${randomUUID()}`,
        workId,
        repositoryId: repository.id,
        environmentId: this.environmentId,
        ...checkout,
      };
      await db.insert(schema.workspaces).values(workspace).run();
      return workspace;
    });
  }

  async #context(db: QueryDatabase): Promise<Context> {
    const row = await db
      .select()
      .from(schema.context)
      .where(eq(schema.context.singleton, 1))
      .get();
    assert.ok(
      row && Number.isSafeInteger(row.generation) && row.generation >= 0,
      "invalid context generation",
    );
    return {
      generation: row.generation,
      workspace:
        row.workspaceId === null
          ? null
          : await this.#workspace(db, row.workspaceId),
    };
  }

  async context(): Promise<Context> {
    const observed = await this.#transaction((db) => this.#context(db));
    const checkout = observed.workspace
      ? await inspectCheckout(observed.workspace.root)
      : null;
    return this.#transaction(async (db) => {
      const current = await this.#context(db);
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

  async #generation(db: QueryDatabase, expected: number): Promise<Context> {
    assert.ok(
      Number.isSafeInteger(expected) &&
        expected >= 0 &&
        expected < Number.MAX_SAFE_INTEGER,
      "invalid expected generation",
    );
    const current = await this.#context(db);
    assert.equal(current.generation, expected, "stale context generation");
    return current;
  }

  async select(
    workspaceId: string,
    expectedGeneration: number,
  ): Promise<Context> {
    const observed = await this.#transaction(async (db) => {
      await this.#generation(db, expectedGeneration);
      return this.#workspace(db, workspaceId);
    });
    const checkout = await inspectCheckout(observed.root);
    return this.#transaction(async (db) => {
      await this.#generation(db, expectedGeneration);
      const workspace = await this.#workspace(db, workspaceId);
      sameCheckout(workspace, checkout);
      await db
        .update(schema.context)
        .set({ generation: sql`${schema.context.generation} + 1`, workspaceId })
        .where(eq(schema.context.singleton, 1))
        .run();
      return this.#context(db);
    });
  }

  /** Explicitly accept new HEAD/branch observations; never rewrite a checkout. */
  async refresh(
    workspaceId: string,
    expectedGeneration: number,
  ): Promise<Workspace> {
    const observed = await this.#transaction(async (db) => {
      await this.#generation(db, expectedGeneration);
      return this.#workspace(db, workspaceId);
    });
    const checkout = await inspectCheckout(observed.root);
    return this.#transaction(async (db) => {
      await this.#generation(db, expectedGeneration);
      const workspace = await this.#workspace(db, workspaceId);
      sameCheckout(workspace, checkout, false);
      await db
        .update(schema.workspaces)
        .set({ revision: checkout.revision, branch: checkout.branch })
        .where(eq(schema.workspaces.id, workspaceId))
        .run();
      await db
        .update(schema.context)
        .set({ generation: sql`${schema.context.generation} + 1` })
        .where(eq(schema.context.singleton, 1))
        .run();
      return this.#workspace(db, workspaceId);
    });
  }
}
