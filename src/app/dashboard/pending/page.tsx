import { Clock } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentSession, logoutAction } from "@/lib/actions/auth";
import { statusRedirectPath } from "@/lib/auth/session-refresh";
import { Button } from "@/components/ui/button";

export default async function PendingPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const away = statusRedirectPath(session);
  if (away && away !== "/dashboard/pending") redirect(away);
  if (!away) redirect(session.role === "TEACHER" ? "/admin" : "/dashboard");

  return (
    <main className="min-h-screen grid place-items-center p-6 text-center bg-stone-50">
      <div className="max-w-md space-y-4">
        <Clock className="mx-auto h-12 w-12 text-amber-600" />
        <h1 className="text-xl font-semibold">Aguardando aprovação</h1>
        <p className="text-sm text-stone-500">
          Conta de <span className="font-medium text-stone-700">{session.name}</span> ·
          status <span className="font-medium text-amber-700">PENDING</span>
        </p>
        <p className="text-stone-600 text-sm">
          Sua conta foi criada. Assim que o professor aprovar, você terá acesso aos
          estudos. Atualize a página para verificar.
        </p>
        <form action={logoutAction}>
          <Button variant="outline" type="submit">
            Sair
          </Button>
        </form>
      </div>
    </main>
  );
}
