import type { MaterialsBucket } from "./r2";

const KEY_RE = /^materials\/[0-9a-f-]+\/[0-9a-f-]+\.pdf$/;

export async function serveMaterialFile(
  bucket: MaterialsBucket,
  path: string[]
): Promise<Response> {
  const key = path.join("/");
  if (path.length !== 3 || !KEY_RE.test(key))
    return new Response("Não encontrada", { status: 404 });

  const obj = await bucket.get(key);
  if (!obj) return new Response("Não encontrada", { status: 404 });

  const filename = path[path.length - 1];
  return new Response(await obj.arrayBuffer(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
