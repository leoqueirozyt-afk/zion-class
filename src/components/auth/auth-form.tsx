"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/actions/auth";

export function AuthForm({
  action,
  mode,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  mode: "login" | "register";
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const router = useRouter();
  const params = useSearchParams();
  const submitted = useRef(false);

  useEffect(() => {
    if (state.ok && submitted.current) {
      toast.success(mode === "login" ? "Bem-vindo de volta!" : "Conta criada!");
      router.replace(params.get("next") || "/");
      router.refresh();
    }
    if (state.error) {
      toast.error(state.error);
      submitted.current = false;
    }
  }, [state, router, params, mode]);

  return (
    <form
      action={formAction}
      className="space-y-4 bg-white border border-stone-200 rounded-xl p-6 shadow-sm"
      onSubmit={() => {
        submitted.current = true;
      }}
    >
      {mode === "register" && (
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" name="name" required placeholder="Maria Silva" autoComplete="name" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="voce@exemplo.com"
          autoComplete="email"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={mode === "register" ? 6 : 1}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </div>
      <Button className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {mode === "login" ? "Entrar" : "Criar conta"}
      </Button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
