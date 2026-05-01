"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell,
} from "recharts";
import { DollarSign, TrendingUp, RotateCcw, AlertCircle, ExternalLink } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Card, PageHeader, StatCard, Badge, SkeletonCard, EmptyState } from "@/components/ui";

interface MonthlyRow {
  month: string; // "YYYY-MM"
  label: string; // "Apr 2026"
  gmv: number;
  fees: number;
  payments: number;
  refunded: number;
}

interface ClubBreakdown {
  club_id: string;
  club_name: string;
  gmv_cents: number;
  fees_cents: number;
  payment_count: number;
}

interface DisputeRow {
  id: string;
  club_id: string;
  club_name: string;
  amount_cents: number;
  status: string;
  failure_reason: string | null;
  created_at: string;
  stripe_payment_intent_id: string | null;
}

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function RevenuePage() {
  const [loading, setLoading] = useState(true);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [topClubs, setTopClubs] = useState<ClubBreakdown[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [allTimeFees, setAllTimeFees] = useState(0);
  const [allTimeGmv, setAllTimeGmv] = useState(0);
  const [allTimeRefunded, setAllTimeRefunded] = useState(0);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const [paymentsRes, refundsRes, clubsRes, problemsRes] = await Promise.all([
        // All succeeded payments (for monthly aggregation + top clubs)
        supabase
          .from("payment_records")
          .select("amount_cents, platform_fee_cents, club_id, created_at")
          .eq("status", "succeeded")
          .order("created_at", { ascending: false })
          .limit(5000),
        // All refunded — to net out
        supabase
          .from("payment_records")
          .select("refund_amount_cents, club_id, created_at, status")
          .in("status", ["refunded", "partially_refunded"])
          .limit(5000),
        // Club name lookup
        supabase.from("clubs").select("id, name"),
        // Disputes + failures for the watchlist
        supabase
          .from("payment_records")
          .select("id, club_id, amount_cents, status, failure_reason, created_at, stripe_payment_intent_id")
          .in("status", ["disputed", "failed"])
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const payments = paymentsRes.data || [];
      const refunds = refundsRes.data || [];
      const clubs = clubsRes.data || [];
      const clubNameMap = new Map(clubs.map((c) => [c.id, c.name]));

      // Monthly aggregation, last 12 months
      const months: Record<string, MonthlyRow> = {};
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months[monthKey(d)] = { month: monthKey(d), label: monthLabel(d), gmv: 0, fees: 0, payments: 0, refunded: 0 };
      }

      for (const p of payments) {
        const d = new Date(p.created_at);
        const key = monthKey(d);
        if (months[key]) {
          months[key].gmv += p.amount_cents || 0;
          months[key].fees += p.platform_fee_cents || 0;
          months[key].payments += 1;
        }
      }
      for (const r of refunds) {
        const d = new Date(r.created_at);
        const key = monthKey(d);
        if (months[key]) months[key].refunded += r.refund_amount_cents || 0;
      }

      const monthlyArr = Object.values(months);
      setMonthly(monthlyArr);

      // Top clubs by GMV (all time)
      const clubAgg: Record<string, ClubBreakdown> = {};
      for (const p of payments) {
        if (!p.club_id) continue;
        if (!clubAgg[p.club_id]) {
          clubAgg[p.club_id] = {
            club_id: p.club_id,
            club_name: clubNameMap.get(p.club_id) || "(unknown)",
            gmv_cents: 0,
            fees_cents: 0,
            payment_count: 0,
          };
        }
        clubAgg[p.club_id].gmv_cents += p.amount_cents || 0;
        clubAgg[p.club_id].fees_cents += p.platform_fee_cents || 0;
        clubAgg[p.club_id].payment_count += 1;
      }
      const topArr = Object.values(clubAgg).sort((a, b) => b.gmv_cents - a.gmv_cents).slice(0, 10);
      setTopClubs(topArr);

      // All-time totals
      setAllTimeGmv(payments.reduce((s, p) => s + (p.amount_cents || 0), 0));
      setAllTimeFees(payments.reduce((s, p) => s + (p.platform_fee_cents || 0), 0));
      setAllTimeRefunded(refunds.reduce((s, r) => s + (r.refund_amount_cents || 0), 0));

      // Disputes / failures with club name
      const enrichedDisputes: DisputeRow[] = (problemsRes.data || []).map((d) => ({
        id: d.id,
        club_id: d.club_id,
        club_name: clubNameMap.get(d.club_id) || "(unknown)",
        amount_cents: d.amount_cents || 0,
        status: d.status,
        failure_reason: d.failure_reason,
        created_at: d.created_at,
        stripe_payment_intent_id: d.stripe_payment_intent_id,
      }));
      setDisputes(enrichedDisputes);

      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Revenue" subtitle="Platform fees and GMV across all clubs" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  // Recharts data — each row in dollars (not cents) for cleaner Y-axis.
  const chartData = monthly.map((m) => ({
    label: m.label.split(" ")[0], // "Apr"
    fullLabel: m.label,
    fees: m.fees / 100,
    gmv: m.gmv / 100,
    payments: m.payments,
  }));

  const total12moFees = monthly.reduce((s, m) => s + m.fees, 0);
  const total12moGmv = monthly.reduce((s, m) => s + m.gmv, 0);
  const total12moPayments = monthly.reduce((s, m) => s + m.payments, 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Revenue" subtitle="Platform fees and GMV across all clubs" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Platform Fees (all time)" value={formatUsd(allTimeFees)} subtitle="Your earnings" icon={<DollarSign />} accent="success" />
        <StatCard label="GMV (all time)" value={formatUsd(allTimeGmv)} subtitle="Gross merchandise volume" icon={<TrendingUp />} accent="brand" />
        <StatCard label="Refunded (all time)" value={formatUsd(allTimeRefunded)} subtitle="Across all clubs" icon={<RotateCcw />} accent="warning" />
      </div>

      <Card>
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Last 12 Months</h2>
            <p className="text-xs text-slate-500 mt-0.5">Platform fees + GMV by month</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">12mo Fees</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums">{formatUsd(total12moFees)}</p>
          </div>
        </div>
        {total12moFees === 0 ? (
          <EmptyState
            icon={<DollarSign />}
            title="No revenue yet"
            description="Once your clubs start taking bookings, fees will show up here."
          />
        ) : (
          <>
            <div className="h-[260px] mt-4 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="feesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0D9488" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gmvGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 8px 24px -8px rgba(15,23,42,0.12)",
                    }}
                    labelFormatter={(value, payload) => payload[0]?.payload?.fullLabel || value}
                    formatter={(value: number, name: string) => {
                      const formatted = `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      const label = name === "fees" ? "Platform Fees" : "GMV";
                      return [formatted, label];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="gmv"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    fill="url(#gmvGradient)"
                    name="gmv"
                  />
                  <Area
                    type="monotone"
                    dataKey="fees"
                    stroke="#0D9488"
                    strokeWidth={2.5}
                    fill="url(#feesGradient)"
                    name="fees"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-slate-500 mb-0.5">12mo GMV</p>
                <p className="font-bold text-slate-900 tabular-nums text-sm">{formatUsd(total12moGmv)}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">12mo Fees</p>
                <p className="font-bold text-brand tabular-nums text-sm">{formatUsd(total12moFees)}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">12mo Payments</p>
                <p className="font-bold text-slate-900 tabular-nums text-sm">{total12moPayments.toLocaleString()}</p>
              </div>
            </div>
          </>
        )}
      </Card>

      <Card noPadding>
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Top Clubs by GMV</h2>
            <p className="text-xs text-slate-500 mt-0.5">All-time leaderboard</p>
          </div>
        </div>
        {topClubs.length === 0 ? (
          <EmptyState icon={<DollarSign />} title="No payment data yet" description="Once clubs start taking bookings, the leaderboard fills in." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-slate-50/40">
                  <th className="py-3 px-6">Rank</th>
                  <th className="py-3 pr-4">Club</th>
                  <th className="py-3 pr-4">GMV</th>
                  <th className="py-3 pr-4">Platform Fees</th>
                  <th className="py-3 pr-4">Payments</th>
                  <th className="py-3 pr-6">Take Rate</th>
                </tr>
              </thead>
              <tbody>
                {topClubs.map((c, i) => {
                  const takeRate = c.gmv_cents > 0 ? ((c.fees_cents / c.gmv_cents) * 100).toFixed(1) : "0";
                  const medal = i === 0 ? "bg-amber-100 text-amber-700 ring-amber-200" : i === 1 ? "bg-slate-100 text-slate-600 ring-slate-200" : i === 2 ? "bg-orange-100 text-orange-700 ring-orange-200" : "bg-slate-50 text-slate-500 ring-slate-200";
                  return (
                    <tr key={c.club_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-6">
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ring-1 ring-inset ${medal}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <Link href={`/platform/clubs/${c.club_id}`} className="font-semibold text-slate-900 hover:text-brand inline-flex items-center gap-1.5 group">
                          {c.club_name}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-slate-900 font-semibold tabular-nums">{formatUsd(c.gmv_cents)}</td>
                      <td className="py-3 pr-4 text-brand font-semibold tabular-nums">{formatUsd(c.fees_cents)}</td>
                      <td className="py-3 pr-4 text-slate-500 tabular-nums">{c.payment_count}</td>
                      <td className="py-3 pr-6 text-slate-700 tabular-nums font-medium">{takeRate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card noPadding>
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              Watchlist
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Failed and disputed payments — most recent 20</p>
          </div>
        </div>
        {disputes.length === 0 ? (
          <EmptyState
            title="All clear"
            description="No failed or disputed payments across any club."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-slate-50/40">
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 pr-4">Club</th>
                  <th className="py-3 pr-4">Amount</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Reason</th>
                  <th className="py-3 pr-6">Stripe</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-6 text-slate-600 text-xs tabular-nums">{new Date(d.created_at).toLocaleString()}</td>
                    <td className="py-3 pr-4">
                      <Link href={`/platform/clubs/${d.club_id}`} className="text-slate-900 hover:text-brand font-medium">{d.club_name}</Link>
                    </td>
                    <td className="py-3 pr-4 text-slate-900 font-semibold tabular-nums">{formatUsd(d.amount_cents)}</td>
                    <td className="py-3 pr-4">
                      <Badge label={d.status} variant={d.status === "disputed" ? "error" : "warning"} dot />
                    </td>
                    <td className="py-3 pr-4 text-slate-600 text-xs max-w-xs truncate">{d.failure_reason || "—"}</td>
                    <td className="py-3 pr-6">
                      {d.stripe_payment_intent_id && (
                        <a href={`https://dashboard.stripe.com/payments/${d.stripe_payment_intent_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand-dark font-semibold">
                          View
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
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
