"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

interface NavItem {
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Courts", href: "/courts" },
  { label: "Memberships", href: "/tier-pricing" },
  { label: "Booking Rules", href: "/booking-rules" },
  { label: "Members", href: "/members" },
  { label: "Reservations", href: "/reservations" },
  { label: "Weather Closure", href: "/weather-closure" },
  { label: "Events", href: "/events" },
  { label: "Announcements", href: "/announcements" },
];

type StripeState = "loading" | "not_connected" | "pending" | "active";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [stripeState, setStripeState] = useState<StripeState>("loading");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.replace("/login");
          return;
        }

        const { data: profile } = await supabase
          .from("users")
          .select("role, club_id")
          .eq("id", session.user.id)
          .single();

        if (profile?.role !== "admin") {
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        if (!profile?.club_id && pathname !== "/onboarding") {
          router.replace("/onboarding");
          return;
        }

        // Check Stripe Connect status
        if (profile?.club_id) {
          const { data: club } = await supabase
            .from("clubs")
            .select("stripe_account_id, stripe_onboarding_complete")
            .eq("id", profile.club_id)
            .single();

          if (club?.stripe_onboarding_complete) {
            setStripeState("active");
          } else if (club?.stripe_account_id) {
            setStripeState("pending");
          } else {
            setStripeState("not_connected");
          }
        }

        setAuthorized(true);
      } catch {
        router.replace("/login");
      }
    };

    checkAuth();
  }, [router, pathname]);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // proceed to redirect regardless
    }
    router.replace("/login");
  };

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <nav className="fixed inset-y-0 left-0 w-64 bg-slate-900 flex flex-col">
        <div className="px-6 py-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white">RecReserve</h1>
          <p className="text-xs text-slate-500 mt-1">Admin Dashboard</p>
        </div>

        <div className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="px-3 py-4 border-t border-slate-800 space-y-2">
          <Link
            href="/settings"
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/settings"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.248a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>
          {stripeState !== "loading" && (
            <div className="px-3 py-2 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  stripeState === "active"
                    ? "bg-green-400"
                    : stripeState === "pending"
                    ? "bg-amber-400"
                    : "bg-red-400"
                }`} />
                <span className="text-slate-400">
                  {stripeState === "active"
                    ? "Stripe Connected"
                    : stripeState === "pending"
                    ? "Stripe Pending"
                    : "Stripe Not Set Up"}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 text-left transition-colors"
          >
            Sign Out
          </button>
        </div>
      </nav>

      <main className="flex-1 ml-64 p-8 bg-slate-50 min-h-screen">
        {children}
      </main>
    </div>
  );
}
