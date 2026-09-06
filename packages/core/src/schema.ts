import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const metadata = sqliteTable(
  "metadata",
  {
    singleton: integer().primaryKey(),
    profile: text({ enum: ["personal", "work"] }).notNull(),
    environmentId: text().notNull(),
  },
  (table) => [
    check("metadata_singleton", sql`${table.singleton} = 1`),
    check("metadata_profile", sql`${table.profile} IN ('personal', 'work')`),
  ],
);

export const works = sqliteTable("works", {
  id: text().primaryKey(),
  name: text().notNull(),
  objective: text().notNull(),
});

export const repositories = sqliteTable("repositories", {
  id: text().primaryKey(),
  commonDir: text().notNull().unique(),
  commonIdentity: text().notNull(),
});

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text().primaryKey(),
    workId: text()
      .notNull()
      .references(() => works.id),
    repositoryId: text()
      .notNull()
      .references(() => repositories.id),
    environmentId: text().notNull(),
    root: text().notNull().unique(),
    gitDir: text().notNull().unique(),
    commonDir: text().notNull(),
    commonIdentity: text().notNull(),
    // Immutable Git HEAD observation today, never a JJ change ID/Gerrit Change-Id.
    // Future VCS/review identities need separate tagged records and migrations.
    revision: text().notNull(),
    branch: text(),
  },
  (table) => [
    index("workspaces_work_id_idx").on(table.workId),
    index("workspaces_repository_id_idx").on(table.repositoryId),
  ],
);

export const context = sqliteTable(
  "context",
  {
    singleton: integer().primaryKey(),
    generation: integer().notNull(),
    workspaceId: text().references(() => workspaces.id),
  },
  (table) => [
    check("context_singleton", sql`${table.singleton} = 1`),
    check("context_generation", sql`${table.generation} >= 0`),
  ],
);
