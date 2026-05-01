"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Users, CalendarDays, DollarSign, TrendingUp, ArrowRight, Plus, ExternalLink } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { StatCard, Card, PageHeader, Badge, SkeletonCard, Button, EmptyState } from "@/components/ui";

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
        <PageHeader eyebrow="Platform" title="Overview" subtitle="All RecReserve clubs at a glance" />
        <div className="space-y-6">
          <div>
            <div className="h-3 w-16 animate-shimmer rounded mb-3" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={`m-${i}`} />)}
            </div>
          </div>
          <div>
            <div className="h-3 w-32 animate-shimmer rounded mb-3" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={`c-${i}`} />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Overview"
        subtitle="All RecReserve clubs at a glance"
        action={
          <Link href="/platform/clubs/new">
            <Button variant="primary" icon={<Plus />}>New Club</Button>
          </Link>
        }
      />

      {/* Money section */}
      <div className="flex items-center gap-2 mb-3 mt-2">
        <DollarSign className="h-4 w-4 text-emerald-600" />
        <h2 className="text-xs font-bold text-slate-600 uppercase tracking-widest">Money</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Fees (this month)" value={formatUsd(stats.platformFeesThisMonth)} icon={<TrendingUp />} accent="success" />
        <StatCard label="Fees (all time)" value={formatUsd(stats.platformFeesAllTime)} icon={<DollarSign />} accent="success" />
        <StatCard label="GMV (this month)" value={formatUsd(stats.gmvThisMonth)} accent="brand" />
        <StatCard label="GMV (all time)" value={formatUsd(stats.gmvAllTime)} accent="brand" />
      </div>

      {/* Clubs & Members section */}
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-brand" />
        <h2 className="text-xs font-bold text-slate-600 uppercase tracking-widest">Clubs &amp; Members</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Clubs" value={String(stats.totalClubs)} icon={<Building2 />} />
        <StatCard label="Active Clubs" value={String(stats.activeClubs)} icon={<Building2 />} accent="success" />
        <StatCard label="Active Members" value={stats.totalMembers.toLocaleString()} icon={<Users />} accent="brand" />
        <StatCard label="Reservations (this month)" value={stats.reservationsThisMonth.toLocaleString()} icon={<CalendarDays />} />
      </div>

      {(stats.suspendedClubs > 0 || stats.archivedClubs > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {stats.suspendedClubs > 0 && <StatCard label="Suspended Clubs" value={String(stats.suspendedClubs)} accent="warning" />}
          {stats.archivedClubs > 0 && <StatCard label="Archived Clubs" value={String(stats.archivedClubs)} />}
        </div>
      )}

      <Card noPadding>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Clubs</h2>
            <p className="text-xs text-slate-500 mt-0.5">Latest 5 clubs onboarded</p>
          </div>
          <Link
            href="/platform/clubs"
            className="text-sm font-semibold text-brand hover:text-brand-dark inline-flex items-center gap-1 group"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
        {recentClubs.length === 0 ? (
          <EmptyState
            icon={<Building2 />}
            title="No clubs yet"
            description="Onboard your first club to start accepting bookings."
            action={
              <Link href="/platform/clubs/new">
                <Button variant="primary" icon={<Plus />}>Create First Club</Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-slate-50/40">
                  <th className="py-3 px-6">Club</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Stripe</th>
                  <th className="py-3 pr-4">Members</th>
                  <th className="py-3 pr-4">GMV <span className="text-slate-400 normal-case font-medium">(30d)</span></th>
                  <th className="py-3 pr-6">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentClubs.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-6">
                      <Link href={`/platform/clubs/${c.id}`} className="font-semibold text-slate-900 hover:text-brand inline-flex items-center gap-1.5 group">
                        {c.name}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        label={c.platform_status}
                        dot
                        variant={c.platform_status === "active" ? "success" : c.platform_status === "suspended" ? "warning" : "default"}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      {c.stripe_onboarding_complete
                        ? <Badge label="Connected" variant="success" dot />
                        : <Badge label="Pending" variant="default" />}
                    </td>
                    <td className="py-3 pr-4 text-slate-700 tabular-nums font-medium">{c.member_count}</td>
                    <td className="py-3 pr-4 text-slate-700 tabular-nums font-medium">{formatUsd(c.gmv_30d)}</td>
                    <td className="py-3 pr-6 text-slate-500 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
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
