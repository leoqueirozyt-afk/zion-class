import { getMaterialsBucket } from "@/lib/materials/r2";
import { serveMaterialFile } from "@/lib/materials/files";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  try {
    return await serveMaterialFile(getMaterialsBucket(), path);
  } catch (e) {
    console.error("files route", e);
    return new Response("Não encontrada", { status: 404 });
  }
}
