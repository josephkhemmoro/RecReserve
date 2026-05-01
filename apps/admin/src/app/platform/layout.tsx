"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { LayoutDashboard, Building2, DollarSign, ArrowLeft, LogOut, Sparkles } from "lucide-react";
import { DialogProvider } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";

const navItems = [
  { label: "Overview", href: "/platform", icon: LayoutDashboard },
  { label: "Clubs", href: "/platform/clubs", icon: Building2 },
  { label: "Revenue", href: "/platform/revenue", icon: DollarSign },
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [adminLabel, setAdminLabel] = useState<string>("");

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
        setAdminLabel(profile.full_name || profile.email || session.user.email || "Platform Admin");
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
      <div className="flex min-h-screen items-center justify-center bg-page">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand" />
      </div>
    );
  }

  return (
    <DialogProvider>
      <div className="flex min-h-screen">
        <nav className="fixed inset-y-0 left-0 w-60 flex flex-col z-40 bg-[#0c1220] border-r border-white/5">
          {/* Brand header */}
          <div className="px-5 py-5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-white leading-tight">RecReserve</h1>
                <p className="text-[10px] text-amber-300/90 font-semibold uppercase tracking-wider">Platform</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-hide">
            {navItems.map((item) => {
              const isActive = item.href === "/platform"
                ? pathname === "/platform"
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "text-amber-300 bg-amber-400/10 nav-link-active"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-3 py-4 border-t border-white/5 space-y-1">
            <div className="px-3 py-1 mb-1">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Signed in as</p>
              <p className="text-xs text-slate-300 truncate font-medium">{adminLabel}</p>
            </div>
            <Link
              href="/"
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="h-[18px] w-[18px]" />
              Back to Club Admin
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/5 text-left transition-colors cursor-pointer"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Sign Out
            </button>
          </div>
        </nav>

        <main className="flex-1 ml-60 p-8 min-h-screen bg-page">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </DialogProvider>
  );
}
