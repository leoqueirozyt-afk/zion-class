import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession, logoutAction } from "@/lib/actions/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="w-7 h-7 rounded-lg bg-emerald-700 grid place-items-center text-sm text-white">
              Z
            </span>
            Zion Class
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-400">
            <Link href="/dashboard" className="hover:text-zinc-100">
              Início
            </Link>
            <form action={logoutAction}>
              <button className="hover:text-zinc-100" type="submit">
                Sair
              </button>
            </form>
            <span className="w-8 h-8 rounded-full bg-zinc-800 grid place-items-center text-xs text-zinc-300">
              {session.name.slice(0, 1).toUpperCase()}
            </span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16">{children}</main>
    </div>
  );
}
