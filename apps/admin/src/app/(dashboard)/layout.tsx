"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import {
  HomeIcon,
  Squares2X2Icon,
  CalendarDaysIcon,
  CalendarIcon,
  CloudIcon,
  UsersIcon,
  TagIcon,
  MegaphoneIcon,
  BellAlertIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  AdjustmentsHorizontalIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  ArrowRightStartOnRectangleIcon,
  AcademicCapIcon,
  TrophyIcon,
  TicketIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  GiftIcon,
} from "@heroicons/react/24/outline";

interface NavGroup {
  label: string;
  items: { label: string; href: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/", icon: HomeIcon }],
  },
  {
    label: "Operations",
    items: [
      { label: "Courts", href: "/courts", icon: Squares2X2Icon },
      { label: "Reservations", href: "/reservations", icon: CalendarDaysIcon },
      { label: "Events", href: "/events", icon: CalendarIcon },
      { label: "Programs", href: "/programs", icon: AcademicCapIcon },
      { label: "Leagues", href: "/leagues", icon: TrophyIcon },
      { label: "Front Desk", href: "/front-desk", icon: TicketIcon },
      { label: "Weather Closure", href: "/weather-closure", icon: CloudIcon },
      { label: "Booking Policies", href: "/booking-policies", icon: ShieldCheckIcon },
    ],
  },
  {
    label: "Members",
    items: [
      { label: "Members", href: "/members", icon: UsersIcon },
      { label: "Membership Tiers", href: "/tier-pricing", icon: TagIcon },
    ],
  },
  {
    label: "Engagement",
    items: [
      { label: "Announcements", href: "/announcements", icon: MegaphoneIcon },
      { label: "Push Campaigns", href: "/push-campaigns", icon: BellAlertIcon },
      { label: "Templates", href: "/message-templates", icon: DocumentTextIcon },
      { label: "Comm History", href: "/communications", icon: ChatBubbleLeftRightIcon },
      { label: "Rewards Program", href: "/rewards-program", icon: GiftIcon },
    ],
  },
  {
    label: "Analytics",
    items: [{ label: "Reports", href: "/reports", icon: ChartBarIcon }],
  },
  {
    label: "Configuration",
    items: [
      { label: "Booking Rules", href: "/booking-rules", icon: AdjustmentsHorizontalIcon },
      { label: "Club Settings", href: "/settings", icon: Cog6ToothIcon },
      { label: "Audit Log", href: "/audit-log", icon: ClipboardDocumentListIcon },
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
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#f8f9fb" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300" style={{ borderTopColor: "#0D9488" }} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <nav className="fixed inset-y-0 left-0 w-60 flex flex-col z-40" style={{ background: "#0f172a" }}>
        <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#0D9488" }}>
              <span className="text-white text-sm font-bold">R</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">RecReserve</h1>
              <p className="text-[11px] text-slate-500 truncate max-w-[140px]">{admin?.clubName || "Admin"}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                      style={isActive ? { background: "rgba(13,148,136,0.15)", color: "#5eead4" } : undefined}
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

        <div className="px-3 py-4 space-y-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {stripeState !== "loading" && (
            <div className="px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  stripeState === "active" ? "bg-emerald-400" : stripeState === "pending" ? "bg-amber-400" : "bg-red-400"
                }`} />
                <span className="text-[11px] text-slate-500">
                  {stripeState === "active" ? "Stripe Connected" : stripeState === "pending" ? "Stripe Pending" : "Stripe Not Set Up"}
                </span>
              </div>
            </div>
          )}
          {isPlatformAdmin && (
            <Link
              href="/platform"
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-amber-300 hover:text-amber-200 text-left transition-colors"
              style={{ background: "rgba(245,158,11,0.1)" }}
            >
              <span className="text-base">⚡</span>
              Platform Admin
            </Link>
          )}
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
