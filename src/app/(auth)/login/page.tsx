import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { loginAction } from "@/lib/actions/auth";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-700 text-white grid place-items-center font-bold text-lg">
            Z
          </div>
          <h1 className="text-2xl font-semibold text-stone-900">Zion Class</h1>
          <p className="text-sm text-stone-500">Área de estudos · Grupo bíblico semanal</p>
        </div>
        <Suspense>
          <AuthForm action={loginAction} mode="login" />
        </Suspense>
        <p className="text-center text-sm text-stone-500">
          Novo por aqui?{" "}
          <Link href="/register" className="text-emerald-700 font-medium">
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  );
}
