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
  { label: "Booking Rules", href: "/booking-rules" },
  { label: "Members", href: "/members" },
  { label: "Reservations", href: "/reservations" },
  { label: "Weather Closure", href: "/weather-closure" },
  { label: "Events", href: "/events" },
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
