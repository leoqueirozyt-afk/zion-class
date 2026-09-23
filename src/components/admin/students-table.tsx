"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Ban, UserCog, RotateCcw, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format";
import { updateStudentAction } from "@/lib/actions/students";
import { ResponsiveTable } from "@/components/shell/responsive-table";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "TEACHER";
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  createdAt: number;
};

const statusBadge: Record<UserRow["status"], { label: string; cls: string }> = {
  PENDING: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  ACTIVE: { label: "Ativo", cls: "bg-emerald-100 text-emerald-800" },
  SUSPENDED: { label: "Suspenso", cls: "bg-red-100 text-red-700" },
};

export function StudentsTable({ users }: { users: UserRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [pending, start] = useTransition();
  const router = useRouter();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter((u) => {
      if (status !== "all" && u.status !== status.toUpperCase()) return false;
      if (!needle) return true;
      return (
        u.name.toLowerCase().includes(needle) ||
        u.email.toLowerCase().includes(needle)
      );
    });
  }, [users, q, status]);

  const act = (userId: string, action: string, label: string) => {
    if (action === "PROMOTE" && !window.confirm("Promover a professor?"))
      return;
    start(async () => {
      const res = await updateStudentAction({ userId, action });
      if (res.ok) {
        toast.success(label);
        router.refresh();
      } else {
        toast.error(res.error ?? "Não foi possível executar a ação");
      }
    });
  };

  const actionButtons = (u: UserRow, mobile: boolean) => (
    <div
      className={
        mobile
          ? "flex flex-wrap gap-1"
          : "flex justify-end items-center gap-1"
      }
    >
      {pending && (
        <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
      )}
      {u.status === "PENDING" && (
        <Button
          size="sm"
          variant="ghost"
          className={mobile ? "h-11 text-emerald-700" : "text-emerald-700"}
          disabled={pending}
          onClick={() => act(u.id, "APPROVE", "Aluno aprovado!")}
        >
          <Check className="h-4 w-4 mr-1" /> Aprovar
        </Button>
      )}
      {u.status === "ACTIVE" && (
        <Button
          size="sm"
          variant="ghost"
          className={mobile ? "h-11 text-red-600" : "text-red-600"}
          disabled={pending}
          onClick={() => act(u.id, "SUSPEND", "Conta suspensa.")}
        >
          <Ban className="h-4 w-4 mr-1" /> Suspender
        </Button>
      )}
      {u.status === "SUSPENDED" && (
        <Button
          size="sm"
          variant="ghost"
          className={mobile ? "h-11 text-emerald-700" : "text-emerald-700"}
          disabled={pending}
          onClick={() => act(u.id, "REACTIVATE", "Conta reativada.")}
        >
          <RotateCcw className="h-4 w-4 mr-1" /> Reativar
        </Button>
      )}
      {u.role === "STUDENT" && (
        <Button
          size="sm"
          variant="ghost"
          className={mobile ? "h-11" : undefined}
          disabled={pending}
          onClick={() => act(u.id, "PROMOTE", "Promovido a professor!")}
        >
          <UserCog className="h-4 w-4 mr-1" /> Promover
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          className="max-w-sm h-12"
          aria-label="Buscar aluno"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-11 rounded-md border border-stone-300 bg-white px-2 text-sm"
          aria-label="Filtrar por status"
        >
          <option value="all">Todos</option>
          <option value="pending">Pendentes</option>
          <option value="active">Ativos</option>
          <option value="suspended">Suspensos</option>
        </select>
      </div>

      <ResponsiveTable
        columns={[
          { key: "nome", header: "Nome" },
          { key: "email", header: "E-mail" },
          { key: "funcao", header: "Função" },
          { key: "status", header: "Status" },
          { key: "criado", header: "Criado em" },
          { key: "acoes", header: "Ações", className: "text-right" },
        ]}
        rows={rows}
        rowKey={(u) => u.id}
        emptyState={
          <p className="p-8 text-center text-stone-500">
            Nenhum usuário encontrado.
          </p>
        }
        renderMobile={(u) => {
          const st = statusBadge[u.status];
          return (
            <div className="space-y-2">
              <div>
                <p className="font-medium">{u.name}</p>
                <p className="text-xs text-stone-500 break-all">{u.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge
                  variant={u.role === "TEACHER" ? "default" : "secondary"}
                  className={u.role === "TEACHER" ? "bg-emerald-700" : ""}
                >
                  {u.role === "TEACHER" ? "Professor" : "Aluno"}
                </Badge>
                <Badge className={st.cls}>{st.label}</Badge>
                <span className="text-stone-500">
                  {formatDate(new Date(u.createdAt).toISOString().slice(0, 10))}
                </span>
              </div>
              {actionButtons(u, true)}
            </div>
          );
        }}
        renderDesktopRow={(u) => {
          const st = statusBadge[u.status];
          return (
            <>
              <td className="p-3 font-medium">{u.name}</td>
              <td className="p-3 text-stone-600">{u.email}</td>
              <td className="p-3">
                <Badge
                  variant={u.role === "TEACHER" ? "default" : "secondary"}
                  className={u.role === "TEACHER" ? "bg-emerald-700" : ""}
                >
                  {u.role === "TEACHER" ? "Professor" : "Aluno"}
                </Badge>
              </td>
              <td className="p-3">
                <Badge className={st.cls}>{st.label}</Badge>
              </td>
              <td className="p-3 text-stone-500">
                {formatDate(new Date(u.createdAt).toISOString().slice(0, 10))}
              </td>
              <td className="p-3">{actionButtons(u, false)}</td>
            </>
          );
        }}
      />
    </div>
  );
}
