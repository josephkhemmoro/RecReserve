"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  HomeIcon,
  BuildingStorefrontIcon,
  CurrencyDollarIcon,
  ArrowRightStartOnRectangleIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";

const navItems = [
  { label: "Overview", href: "/platform", icon: HomeIcon },
  { label: "Clubs", href: "/platform/clubs", icon: BuildingStorefrontIcon },
  { label: "Revenue", href: "/platform/revenue", icon: CurrencyDollarIcon },
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string>("");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace("/login"); return; }

        const { data: profile } = await supabase
          .from("users")
          .select("is_platform_admin, email, full_name")
          .eq("id", session.user.id)
          .single();

        if (!profile?.is_platform_admin) {
          router.replace("/");
          return;
        }
        setAdminEmail(profile.full_name || profile.email || session.user.email || "Platform Admin");
        setAuthorized(true);
      } catch {
        router.replace("/login");
      }
    };
    checkAuth();
  }, [router]);

  const handleSignOut = async () => {
    try { const supabase = createClient(); await supabase.auth.signOut(); } catch {}
    router.replace("/login");
  };

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#f8f9fb" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300" style={{ borderTopColor: "#0D9488" }} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <nav className="fixed inset-y-0 left-0 w-60 flex flex-col z-40" style={{ background: "#0b1220" }}>
        <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#f59e0b" }}>
              <span className="text-white text-sm font-bold">P</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">RecReserve</h1>
              <p className="text-[11px] text-amber-300/80 truncate max-w-[140px]">Platform Admin</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive = item.href === "/platform"
              ? pathname === "/platform"
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive ? "text-white" : "text-slate-400 hover:text-white"
                }`}
                style={isActive ? { background: "rgba(245,158,11,0.15)", color: "#fbbf24" } : undefined}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="px-3 py-4 space-y-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="px-3 py-1">
            <p className="text-[11px] text-slate-500 truncate">{adminEmail}</p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-[18px] h-[18px]" />
            Back to Club Admin
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white text-left transition-colors cursor-pointer"
          >
            <ArrowRightStartOnRectangleIcon className="w-[18px] h-[18px]" />
            Sign Out
          </button>
        </div>
      </nav>

      <main className="flex-1 ml-60 p-8 min-h-screen" style={{ background: "#f8f9fb" }}>
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
