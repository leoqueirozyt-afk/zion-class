import { getCloudflareContext } from "@opennextjs/cloudflare";

export type MaterialsBucket = {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array | string | ReadableStream,
    opts?: {
      httpMetadata?: {
        contentType?: string;
        contentDisposition?: string;
      };
    }
  ): Promise<unknown>;
  get(key: string): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    httpMetadata?: { contentType?: string };
  } | null>;
  list(opts: { prefix: string }): Promise<{ objects: { key: string }[] }>;
  delete(keys: string[]): Promise<void>;
};

type KvNamespace = {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array | string | ReadableStream,
    opts?: unknown
  ): Promise<void>;
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
  get(key: string, type?: "text" | "json"): Promise<string | null>;
  list(opts: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
  delete(key: string): Promise<void>;
};

type Env = { MATERIALS?: KvNamespace };

export function getMaterialsBucket(): MaterialsBucket {
  const { env } = getCloudflareContext() as unknown as { env: Env };
  const kv = env.MATERIALS;
  if (!kv) throw new Error("MATERIALS binding missing");
  return {
    put(key, value, opts) {
      return kv.put(key, value, opts);
    },
    async get(key) {
      const buf = await kv.get(key, "arrayBuffer");
      if (buf === null) return null;
      return { arrayBuffer: async () => buf };
    },
    async list({ prefix }) {
      const keys: { key: string }[] = [];
      let cursor: string | undefined;
      do {
        const page = await kv.list({
          prefix,
          limit: 1000,
          ...(cursor ? { cursor } : {}),
        });
        for (const k of page.keys) keys.push({ key: k.name });
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return { objects: keys };
    },
    async delete(keys) {
      for (const key of keys) await kv.delete(key);
    },
  };
}

export function materialKeyFromUrl(url: string): string {
  return url.replace(/^\/files\//, "materials/");
}

export function materialUrlFromKey(key: string): string {
  return key.replace(/^materials\//, "/files/");
}

export function lessonMaterialsPrefix(lessonId: string): string {
  return `materials/${lessonId}/`;
}

export async function wipeLessonPrefix(
  bucket: MaterialsBucket,
  lessonId: string,
  keepKeys: Set<string> = new Set()
): Promise<void> {
  const prefix = lessonMaterialsPrefix(lessonId);
  const { objects } = await bucket.list({ prefix });
  const toDelete = objects.map((o) => o.key).filter((k) => !keepKeys.has(k));
  if (toDelete.length) await bucket.delete(toDelete);
}
