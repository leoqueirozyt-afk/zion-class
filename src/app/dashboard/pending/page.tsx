import { Clock } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export default function PendingPage() {
  return (
    <main className="min-h-screen grid place-items-center p-6 text-center bg-stone-50">
      <div className="max-w-md space-y-4">
        <Clock className="mx-auto h-12 w-12 text-amber-600" />
        <h1 className="text-xl font-semibold">Aguardando aprovação</h1>
        <p className="text-stone-600 text-sm">
          Sua conta foi criada. Assim que o professor aprovar, você terá acesso aos
          estudos.
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
