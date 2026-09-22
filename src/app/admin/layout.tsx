import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, BookOpen, Users, LogOut } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { getCurrentSession, logoutAction } from "@/lib/actions/auth";

const nav = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/lessons", label: "Aulas", icon: BookOpen },
  { href: "/admin/students", label: "Alunos", icon: Users },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "TEACHER") redirect("/dashboard");
  if (session.status === "SUSPENDED") redirect("/dashboard/suspended");
  if (session.status !== "ACTIVE") redirect("/dashboard/pending");

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="flex min-h-screen">
        <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-stone-200 bg-white p-4 gap-1">
          <Link
            href="/admin"
            className="flex items-center gap-2 font-semibold mb-6 px-2"
          >
            <Logo className="w-8 h-8 rounded-lg" />
            Zion Admin
          </Link>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100"
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </Link>
          ))}
          <form action={logoutAction} className="mt-auto">
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-500 hover:bg-stone-100">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </form>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-white px-4 h-14">
            <Link href="/admin" className="flex items-center gap-2 font-semibold">
              <Logo className="w-7 h-7 rounded-lg" />
              Zion Admin
            </Link>
            <nav className="flex gap-3 text-sm">
              {nav.map((i) => (
                <Link key={i.href} href={i.href}>
                  {i.label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
