"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import {
  LayoutDashboard,
  Grid3x3,
  CalendarDays,
  Calendar,
  CloudRain,
  Users,
  Tag,
  Megaphone,
  Bell,
  BarChart3,
  Settings,
  SlidersHorizontal,
  ShieldCheck,
  ClipboardList,
  LogOut,
  GraduationCap,
  Trophy,
  Ticket,
  FileText,
  MessageSquare,
  Gift,
  Sparkles,
} from "lucide-react";
import { DialogProvider } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";

interface NavGroup {
  label: string;
  items: { label: string; href: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [
      { label: "Courts", href: "/courts", icon: Grid3x3 },
      { label: "Reservations", href: "/reservations", icon: CalendarDays },
      { label: "Events", href: "/events", icon: Calendar },
      { label: "Programs", href: "/programs", icon: GraduationCap },
      { label: "Leagues", href: "/leagues", icon: Trophy },
      { label: "Front Desk", href: "/front-desk", icon: Ticket },
      { label: "Weather Closure", href: "/weather-closure", icon: CloudRain },
      { label: "Booking Policies", href: "/booking-policies", icon: ShieldCheck },
    ],
  },
  {
    label: "Members",
    items: [
      { label: "Members", href: "/members", icon: Users },
      { label: "Membership Tiers", href: "/tier-pricing", icon: Tag },
    ],
  },
  {
    label: "Engagement",
    items: [
      { label: "Announcements", href: "/announcements", icon: Megaphone },
      { label: "Push Campaigns", href: "/push-campaigns", icon: Bell },
      { label: "Templates", href: "/message-templates", icon: FileText },
      { label: "Comm History", href: "/communications", icon: MessageSquare },
      { label: "Rewards Program", href: "/rewards-program", icon: Gift },
    ],
  },
  {
    label: "Analytics",
    items: [{ label: "Reports", href: "/reports", icon: BarChart3 }],
  },
  {
    label: "Configuration",
    items: [
      { label: "Booking Rules", href: "/booking-rules", icon: SlidersHorizontal },
      { label: "Club Settings", href: "/settings", icon: Settings },
      { label: "Audit Log", href: "/audit-log", icon: ClipboardList },
    ],
  },
];

type StripeState = "loading" | "not_connected" | "pending" | "active";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { admin } = useAdminClub();
  const [authorized, setAuthorized] = useState(false);
  const [stripeState, setStripeState] = useState<StripeState>("loading");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace("/login"); return; }
        const { data: profile } = await supabase.from("users").select("role, club_id, is_platform_admin").eq("id", session.user.id).single();
        if (profile?.role !== "admin") { await supabase.auth.signOut(); router.replace("/login"); return; }
        if (!profile?.club_id && pathname !== "/onboarding") { router.replace("/onboarding"); return; }
        if (profile?.club_id) {
          const { data: club } = await supabase.from("clubs").select("stripe_account_id, stripe_onboarding_complete").eq("id", profile.club_id).single();
          if (club?.stripe_onboarding_complete) setStripeState("active");
          else if (club?.stripe_account_id) setStripeState("pending");
          else setStripeState("not_connected");
        }
        setIsPlatformAdmin(!!profile?.is_platform_admin);
        setAuthorized(true);
      } catch { router.replace("/login"); }
    };
    checkAuth();
  }, [router, pathname]);

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
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-brand to-brand-dark shadow-lg shadow-brand/30">
              <span className="text-white text-sm font-bold">R</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white leading-tight">RecReserve</h1>
              <p className="text-[10px] text-slate-400 truncate max-w-[140px] font-medium">{admin?.clubName || "Admin"}</p>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-hide">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                        isActive
                          ? "text-brand-light bg-brand/10 nav-link-active"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-white/5 space-y-1">
          {stripeState !== "loading" && (
            <div className="px-3 py-2 mb-1 rounded-lg flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={cn(
                  "absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping",
                  stripeState === "active" ? "bg-emerald-400" : stripeState === "pending" ? "bg-amber-400" : "bg-red-400"
                )} />
                <span className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  stripeState === "active" ? "bg-emerald-400" : stripeState === "pending" ? "bg-amber-400" : "bg-red-400"
                )} />
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {stripeState === "active" ? "Stripe Connected" : stripeState === "pending" ? "Stripe Pending" : "Stripe Not Set Up"}
              </span>
            </div>
          )}
          {isPlatformAdmin && (
            <Link
              href="/platform"
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-amber-300 hover:text-amber-200 transition-colors bg-amber-400/8 hover:bg-amber-400/15 ring-1 ring-amber-400/20"
            >
              <Sparkles className="w-[18px] h-[18px] flex-shrink-0" />
              Platform Admin
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/5 text-left transition-colors cursor-pointer"
          >
            <LogOut className="w-[18px] h-[18px]" />
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
