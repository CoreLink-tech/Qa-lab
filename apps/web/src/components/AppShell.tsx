"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  clearSession,
  getStoredOrg,
  getStoredTokens,
  getStoredUser,
  logout,
  type OrganizationSummary,
  type UserSummary,
} from "@/lib/api";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/scans", label: "Scans" },
  { href: "/organizations", label: "Organizations" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserSummary | null>(null);
  const [org, setOrg] = useState<OrganizationSummary | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const tokens = getStoredTokens();
    if (!tokens?.accessToken) {
      router.replace("/login");
      return;
    }
    setUser(getStoredUser());
    setOrg(getStoredOrg());
    setReady(true);
  }, [router]);

  async function handleLogout() {
    await logout();
    clearSession();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                QA
              </span>
              <span className="text-sm font-semibold text-slate-900">
                QA Lab
              </span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {nav.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {org ? (
              <span className="hidden text-xs text-slate-500 sm:inline">
                {org.name}
              </span>
            ) : null}
            <span className="text-sm text-slate-700">
              {user?.firstName || user?.email}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
