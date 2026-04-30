"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Card, PageHeader, StatCard, Badge, SkeletonCard } from "@/components/ui";

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

  const maxFees = Math.max(...monthly.map((m) => m.fees), 1);

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

  return (
    <div className="space-y-6">
      <PageHeader title="Revenue" subtitle="Platform fees and GMV across all clubs" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Platform Fees (all time)" value={formatUsd(allTimeFees)} subtitle="Your earnings" />
        <StatCard label="GMV (all time)" value={formatUsd(allTimeGmv)} subtitle="Gross merchandise volume" />
        <StatCard label="Refunded (all time)" value={formatUsd(allTimeRefunded)} subtitle="Across all clubs" />
      </div>

      <Card>
        <h2 className="text-base font-semibold text-slate-900 mb-4">Last 12 Months — Platform Fees</h2>
        <div className="space-y-2">
          {monthly.map((m) => {
            const widthPct = (m.fees / maxFees) * 100;
            return (
              <div key={m.month} className="flex items-center gap-3">
                <div className="w-20 text-xs text-slate-500 font-medium">{m.label}</div>
                <div className="flex-1 h-7 bg-slate-50 rounded relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded transition-all"
                    style={{ width: `${widthPct}%`, background: "#0D9488" }}
                  />
                  <div className="absolute inset-0 flex items-center justify-end px-2">
                    <span className="text-xs font-semibold text-slate-700">
                      {m.fees > 0 ? formatUsd(m.fees) : "—"}
                    </span>
                  </div>
                </div>
                <div className="w-24 text-xs text-slate-500 text-right">{m.payments} pmt</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex gap-6 text-xs text-slate-500">
          <div>Total fees (12mo): <span className="font-semibold text-slate-900">{formatUsd(monthly.reduce((s, m) => s + m.fees, 0))}</span></div>
          <div>Total GMV (12mo): <span className="font-semibold text-slate-900">{formatUsd(monthly.reduce((s, m) => s + m.gmv, 0))}</span></div>
          <div>Total payments (12mo): <span className="font-semibold text-slate-900">{monthly.reduce((s, m) => s + m.payments, 0).toLocaleString()}</span></div>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-slate-900 mb-4">Top Clubs by GMV</h2>
        {topClubs.length === 0 ? (
          <p className="text-sm text-slate-500">No payment data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="py-2 pr-4">Rank</th>
                  <th className="py-2 pr-4">Club</th>
                  <th className="py-2 pr-4">GMV</th>
                  <th className="py-2 pr-4">Platform Fees</th>
                  <th className="py-2 pr-4">Payments</th>
                  <th className="py-2 pr-4">Take Rate</th>
                </tr>
              </thead>
              <tbody>
                {topClubs.map((c, i) => {
                  const takeRate = c.gmv_cents > 0 ? ((c.fees_cents / c.gmv_cents) * 100).toFixed(1) : "0";
                  return (
                    <tr key={c.club_id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-3 pr-4 font-semibold text-slate-700">#{i + 1}</td>
                      <td className="py-3 pr-4">
                        <Link href={`/platform/clubs/${c.club_id}`} className="font-medium text-slate-900 hover:text-teal-600">{c.club_name}</Link>
                      </td>
                      <td className="py-3 pr-4 text-slate-900 font-medium">{formatUsd(c.gmv_cents)}</td>
                      <td className="py-3 pr-4 text-slate-700">{formatUsd(c.fees_cents)}</td>
                      <td className="py-3 pr-4 text-slate-500">{c.payment_count}</td>
                      <td className="py-3 pr-4 text-slate-500">{takeRate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Watchlist — Failed & Disputed</h2>
          <span className="text-xs text-slate-500">Most recent 20</span>
        </div>
        {disputes.length === 0 ? (
          <p className="text-sm text-slate-500">No failed or disputed payments. 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Club</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Reason</th>
                  <th className="py-2 pr-4">Stripe</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50">
                    <td className="py-2 pr-4 text-slate-600">{new Date(d.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-4">
                      <Link href={`/platform/clubs/${d.club_id}`} className="text-slate-900 hover:text-teal-600">{d.club_name}</Link>
                    </td>
                    <td className="py-2 pr-4 text-slate-900 font-medium">{formatUsd(d.amount_cents)}</td>
                    <td className="py-2 pr-4">
                      <Badge label={d.status} variant={d.status === "disputed" ? "error" : "warning"} />
                    </td>
                    <td className="py-2 pr-4 text-slate-700 max-w-xs truncate">{d.failure_reason || "—"}</td>
                    <td className="py-2 pr-4">
                      {d.stripe_payment_intent_id && (
                        <a href={`https://dashboard.stripe.com/payments/${d.stripe_payment_intent_id}`} target="_blank" rel="noreferrer" className="text-xs text-teal-600 hover:text-teal-700">View →</a>
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
