import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

type Env = { DB: Parameters<typeof drizzle>[0] };

export function getDb(): DrizzleD1Database<typeof schema> {
  const { env } = getCloudflareContext() as unknown as { env: Env };
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
