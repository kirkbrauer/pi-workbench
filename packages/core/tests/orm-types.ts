// Compile-only regression fixture. This function is never executed.
import { eq } from "drizzle-orm";
import type { StoreDatabase } from "../src/database.js";
import { context, metadata, works } from "../src/schema.js";

export async function queryTypeContract(
  db: StoreDatabase,
): Promise<string | undefined> {
  // @ts-expect-error Unknown schema columns must fail compilation.
  db.select({ value: works.nonexistent }).from(works);
  // @ts-expect-error Inserts must include the required name column.
  db.insert(works).values({ id: "id", objective: "objective" });
  // @ts-expect-error Integer comparisons must not accept arbitrary strings.
  db.select().from(context).where(eq(context.generation, "wrong"));
  // @ts-expect-error Profiles must use the declared enum, not an arbitrary label.
  db.insert(metadata).values({ profile: "other", environmentId: "id" });
  const work = await db.select().from(works).get();
  return work?.name;
}
