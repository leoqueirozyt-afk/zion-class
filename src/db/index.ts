import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

type Env = { DB: D1Database };

export function getDb() {
  const { env } = getCloudflareContext() as unknown as { env: Env };
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
