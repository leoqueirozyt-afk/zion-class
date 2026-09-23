import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Logo } from "@/components/ui/logo";
import { registerAction } from "@/lib/actions/auth";

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 px-4 py-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Logo className="mx-auto w-12 h-12 rounded-xl" />
          <h1 className="text-2xl font-semibold text-stone-900">Criar conta</h1>
          <p className="text-sm text-stone-500">
            Cadastro de aluno · aguarda aprovação do professor
          </p>
        </div>
        <Suspense>
          <AuthForm action={registerAction} mode="register" />
        </Suspense>
        <p className="text-center text-sm text-stone-500">
          Já tenho conta?{" "}
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center text-emerald-700 font-medium"
          >
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
