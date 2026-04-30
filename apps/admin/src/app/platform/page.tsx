"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { StatCard, Card, PageHeader, Badge, SkeletonCard } from "@/components/ui";
import Link from "next/link";

interface Stats {
  totalClubs: number;
  activeClubs: number;
  suspendedClubs: number;
  archivedClubs: number;
  totalMembers: number;
  totalReservations: number;
  gmvAllTime: number;
  gmvThisMonth: number;
  platformFeesAllTime: number;
  platformFeesThisMonth: number;
  reservationsThisMonth: number;
  paidMembersThisMonth: number;
}

interface ClubRow {
  id: string;
  name: string;
  platform_status: string;
  stripe_onboarding_complete: boolean | null;
  created_at: string;
  member_count: number;
  gmv_30d: number;
}

function formatUsd(cents: number): string {
  if (!cents) return "$0";
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function PlatformOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentClubs, setRecentClubs] = useState<ClubRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const monthIso = monthStart.toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [
        clubsRes,
        membersRes,
        reservationsAllRes,
        reservationsMonthRes,
        gmvAllRes,
        gmvMonthRes,
        feesAllRes,
        feesMonthRes,
        recentClubsRes,
      ] = await Promise.all([
        supabase.from("clubs").select("platform_status"),
        supabase.from("memberships").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("reservations").select("id", { count: "exact", head: true }),
        supabase.from("reservations").select("id", { count: "exact", head: true }).gte("created_at", monthIso),
        supabase.from("payment_records").select("amount_cents").eq("status", "succeeded"),
        supabase.from("payment_records").select("amount_cents").eq("status", "succeeded").gte("created_at", monthIso),
        supabase.from("payment_records").select("platform_fee_cents").eq("status", "succeeded"),
        supabase.from("payment_records").select("platform_fee_cents").eq("status", "succeeded").gte("created_at", monthIso),
        supabase.from("clubs").select("id, name, platform_status, stripe_onboarding_complete, created_at").order("created_at", { ascending: false }).limit(5),
      ]);

      const clubs = clubsRes.data || [];
      const totalClubs = clubs.length;
      const activeClubs = clubs.filter((c) => c.platform_status === "active").length;
      const suspendedClubs = clubs.filter((c) => c.platform_status === "suspended").length;
      const archivedClubs = clubs.filter((c) => c.platform_status === "archived").length;
      const gmvAllTime = (gmvAllRes.data || []).reduce((s, p) => s + (p.amount_cents || 0), 0);
      const gmvThisMonth = (gmvMonthRes.data || []).reduce((s, p) => s + (p.amount_cents || 0), 0);
      const platformFeesAllTime = (feesAllRes.data || []).reduce((s, p) => s + (p.platform_fee_cents || 0), 0);
      const platformFeesThisMonth = (feesMonthRes.data || []).reduce((s, p) => s + (p.platform_fee_cents || 0), 0);

      // Recent clubs — enrich with member counts + 30d GMV
      const recent = recentClubsRes.data || [];
      const enriched: ClubRow[] = await Promise.all(
        recent.map(async (c) => {
          const [memRes, gmvRes] = await Promise.all([
            supabase.from("memberships").select("id", { count: "exact", head: true }).eq("club_id", c.id).eq("is_active", true),
            supabase.from("payment_records").select("amount_cents").eq("club_id", c.id).eq("status", "succeeded").gte("created_at", thirtyDaysAgo),
          ]);
          return {
            id: c.id,
            name: c.name,
            platform_status: c.platform_status,
            stripe_onboarding_complete: c.stripe_onboarding_complete,
            created_at: c.created_at,
            member_count: memRes.count || 0,
            gmv_30d: (gmvRes.data || []).reduce((s, p) => s + (p.amount_cents || 0), 0),
          };
        })
      );

      setStats({
        totalClubs, activeClubs, suspendedClubs, archivedClubs,
        totalMembers: membersRes.count || 0,
        totalReservations: reservationsAllRes.count || 0,
        reservationsThisMonth: reservationsMonthRes.count || 0,
        gmvAllTime, gmvThisMonth,
        platformFeesAllTime, platformFeesThisMonth,
        paidMembersThisMonth: 0,
      });
      setRecentClubs(enriched);
      setLoading(false);
    };
    load();
  }, []);

  if (loading || !stats) {
    return (
      <div>
        <PageHeader title="Platform Overview" subtitle="All RecReserve clubs at a glance" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Platform Overview" subtitle="All RecReserve clubs at a glance" />

      <h2 className="text-sm font-semibold text-slate-700 mb-3 mt-2">Money</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Platform Fees (this month)" value={formatUsd(stats.platformFeesThisMonth)} />
        <StatCard label="Platform Fees (all time)" value={formatUsd(stats.platformFeesAllTime)} />
        <StatCard label="GMV (this month)" value={formatUsd(stats.gmvThisMonth)} />
        <StatCard label="GMV (all time)" value={formatUsd(stats.gmvAllTime)} />
      </div>

      <h2 className="text-sm font-semibold text-slate-700 mb-3">Clubs & Members</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Clubs" value={String(stats.totalClubs)} />
        <StatCard label="Active Clubs" value={String(stats.activeClubs)} />
        <StatCard label="Active Members" value={stats.totalMembers.toLocaleString()} />
        <StatCard label="Reservations (this month)" value={stats.reservationsThisMonth.toLocaleString()} />
      </div>

      {(stats.suspendedClubs > 0 || stats.archivedClubs > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {stats.suspendedClubs > 0 && <StatCard label="Suspended Clubs" value={String(stats.suspendedClubs)} />}
          {stats.archivedClubs > 0 && <StatCard label="Archived Clubs" value={String(stats.archivedClubs)} />}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Recent Clubs</h2>
          <Link href="/platform/clubs" className="text-sm font-semibold text-teal-600 hover:text-teal-700">
            View all →
          </Link>
        </div>
        {recentClubs.length === 0 ? (
          <p className="text-sm text-slate-500">No clubs yet. Onboard your first one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="py-2 pr-4">Club</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Stripe</th>
                  <th className="py-2 pr-4">Members</th>
                  <th className="py-2 pr-4">GMV (30d)</th>
                  <th className="py-2 pr-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentClubs.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <Link href={`/platform/clubs/${c.id}`} className="font-medium text-slate-900 hover:text-teal-600">{c.name}</Link>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        label={c.platform_status}
                        variant={c.platform_status === "active" ? "success" : c.platform_status === "suspended" ? "warning" : "default"}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      {c.stripe_onboarding_complete
                        ? <Badge label="Connected" variant="success" />
                        : <Badge label="Not connected" variant="default" />}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{c.member_count}</td>
                    <td className="py-3 pr-4 text-slate-700">{formatUsd(c.gmv_30d)}</td>
                    <td className="py-3 pr-4 text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
