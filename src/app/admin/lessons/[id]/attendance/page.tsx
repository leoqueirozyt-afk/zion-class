import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getAttendanceView } from "@/lib/queries/admin";
import { AttendancePanel } from "@/components/admin/attendance-panel";

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await getAttendanceView(getDb(), id);
  if (!view) notFound();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Chamada</h1>
          <p className="text-sm text-stone-500">{view.lesson.title}</p>
        </div>
        <Link href={`/admin/lessons/${id}/edit`} className="text-sm underline">
          Editar aula
        </Link>
      </div>
      <AttendancePanel view={view} />
    </div>
  );
}
