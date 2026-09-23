import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Logo } from "@/components/ui/logo";
import { loginAction } from "@/lib/actions/auth";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 px-4 py-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Logo className="mx-auto w-12 h-12 rounded-xl" />
          <h1 className="text-2xl font-semibold text-stone-900">Zion Class</h1>
          <p className="text-sm text-stone-500">Área de estudos · Grupo bíblico semanal</p>
        </div>
        <Suspense>
          <AuthForm action={loginAction} mode="login" />
        </Suspense>
        <p className="text-center text-sm text-stone-500">
          Novo por aqui?{" "}
          <Link
            href="/register"
            className="inline-flex min-h-11 items-center text-emerald-700 font-medium"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  );
}
