"use client";

import Link from "next/link";
import { Menu, LogOut } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { logoutAction } from "@/lib/actions/auth";

export type NavItem = {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
};

export function MobileNav({
  links,
  user,
  showLogout = true,
  title = "Menu",
}: {
  links: NavItem[];
  user?: { name?: string; role?: string };
  showLogout?: boolean;
  title?: string;
}) {
  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Abrir menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-3/4 sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex h-12 items-center gap-2 rounded-lg px-3 text-sm text-stone-700 hover:bg-stone-100"
              >
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto border-t border-stone-200 p-4 space-y-3">
            {user?.name && (
              <p className="text-sm text-stone-600 truncate">
                {user.name}
                {user.role ? ` · ${user.role}` : ""}
              </p>
            )}
            {showLogout && (
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex h-12 w-full items-center gap-2 rounded-lg px-3 text-sm text-stone-700 hover:bg-stone-100"
                >
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </form>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
