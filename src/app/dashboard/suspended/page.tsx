import { Ban } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export default function SuspendedPage() {
  return (
    <main className="min-h-screen grid place-items-center p-6 text-center bg-stone-50">
      <div className="max-w-md space-y-4">
        <Ban className="mx-auto h-12 w-12 text-red-600" />
        <h1 className="text-xl font-semibold">Conta suspensa</h1>
        <p className="text-stone-600 text-sm">
          Fale com o professor da turma para reativar seu acesso.
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
