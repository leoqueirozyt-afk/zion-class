import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { StudentsTable } from "@/components/admin/students-table";

export default async function AdminStudentsPage() {
  const rows = await getDb()
    .select()
    .from(users)
    .orderBy(asc(users.name));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Alunos</h1>
        <p className="text-sm text-stone-500">
          Aprove, suspenda ou promova membros da turma.
        </p>
      </div>
      <StudentsTable users={rows} />
    </div>
  );
}
