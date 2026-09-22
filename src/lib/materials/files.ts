import type { MaterialsBucket } from "./r2";

const SEGMENT_RE = /^[A-Za-z0-9_-]+$/;
const FILE_RE = /^[A-Za-z0-9_-]+\.pdf$/;

export async function serveMaterialFile(
  bucket: MaterialsBucket,
  path: string[]
): Promise<Response> {
  if (path.length !== 2) return new Response("Não encontrada", { status: 404 });
  const [lessonId, filename] = path;
  if (!SEGMENT_RE.test(lessonId) || !FILE_RE.test(filename))
    return new Response("Não encontrada", { status: 404 });

  const key = `materials/${lessonId}/${filename}`;
  const obj = await bucket.get(key);
  if (!obj) return new Response("Não encontrada", { status: 404 });

  return new Response(await obj.arrayBuffer(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
