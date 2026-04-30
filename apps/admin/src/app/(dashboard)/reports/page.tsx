"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, Button, StatCard, Skeleton, FormSelect } from "@/components/ui";

type TimeRange = "7d" | "30d" | "90d" | "all";

interface UtilizationByHour { hour: number; bookings: number; capacity: number; rate: number; }
interface UtilizationByDay { day: string; bookings: number; rate: number; }
interface RevenueBySource { source: string; amount: number; count: number; }
interface ProgramFillRate { name: string; type: string; registered: number; capacity: number | null; rate: number; }
interface MemberActivity { bucket: string; count: number; }

const TIME_RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
];

function getDateRange(range: TimeRange): string {
  const now = new Date();
  if (range === "7d") return new Date(now.getTime() - 7 * 86400000).toISOString();
  if (range === "30d") return new Date(now.getTime() - 30 * 86400000).toISOString();
  if (range === "90d") return new Date(now.getTime() - 90 * 86400000).toISOString();
  return "2020-01-01T00:00:00Z";
}

export default function ReportsPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [range, setRange] = useState<TimeRange>("30d");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  // Stats
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [totalRefunds, setTotalRefunds] = useState(0);
  const [refundAmount, setRefundAmount] = useState(0);
  const [noShowCount, setNoShowCount] = useState(0);
  const [noShowRate, setNoShowRate] = useState(0);
  const [cancellationCount, setCancellationCount] = useState(0);
  const [cancellationRate, setCancellationRate] = useState(0);
  const [avgRevenuePerBooking, setAvgRevenuePerBooking] = useState(0);
  const [activeMembers, setActiveMembers] = useState(0);
  const [newMembers, setNewMembers] = useState(0);

  // Breakdowns
  const [utilizationByHour, setUtilizationByHour] = useState<UtilizationByHour[]>([]);
  const [utilizationByDay, setUtilizationByDay] = useState<UtilizationByDay[]>([]);
  const [revenueBySource, setRevenueBySource] = useState<RevenueBySource[]>([]);
  const [programFillRates, setProgramFillRates] = useState<ProgramFillRate[]>([]);
  const [memberActivity, setMemberActivity] = useState<MemberActivity[]>([]);

  const fetchData = useCallback(async () => {
    if (!admin?.clubId) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const since = getDateRange(range);

      // Reservations
      const { data: reservations } = await supabase.from("reservations")
        .select("id, status, amount_paid, start_time, end_time, court_id")
        .eq("club_id", admin.clubId).gte("start_time", since);
      const allRes = reservations ?? [];
      const confirmed = allRes.filter((r) => ["confirmed", "completed"].includes(r.status as string));
      const noShows = allRes.filter((r) => (r.status as string) === "no_show");
      const cancelled = allRes.filter((r) => (r.status as string) === "cancelled");

      setTotalBookings(confirmed.length + noShows.length);
      setTotalRevenue(confirmed.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0));
      setNoShowCount(noShows.length);
      setNoShowRate(allRes.length > 0 ? Math.round((noShows.length / allRes.length) * 100) : 0);
      setCancellationCount(cancelled.length);
      setCancellationRate(allRes.length > 0 ? Math.round((cancelled.length / allRes.length) * 100) : 0);
      setAvgRevenuePerBooking(confirmed.length > 0 ? confirmed.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0) / confirmed.length : 0);

      // Refunds
      const { data: refunds } = await supabase.from("payment_records")
        .select("refund_amount_cents").eq("club_id", admin.clubId)
        .in("status", ["refunded", "partially_refunded"]).gte("created_at", since);
      const totalRefundCents = (refunds ?? []).reduce((s, r) => s + (Number(r.refund_amount_cents) || 0), 0);
      setTotalRefunds((refunds ?? []).length);
      setRefundAmount(totalRefundCents / 100);

      // Members
      const { count: activeMemberCount } = await supabase.from("memberships")
        .select("id", { count: "exact", head: true }).eq("club_id", admin.clubId).eq("is_active", true);
      setActiveMembers(activeMemberCount ?? 0);
      const { count: newMemberCount } = await supabase.from("memberships")
        .select("id", { count: "exact", head: true }).eq("club_id", admin.clubId).gte("created_at", since);
      setNewMembers(newMemberCount ?? 0);

      // Utilization by hour
      const hourMap = new Map<number, { bookings: number }>();
      for (const r of confirmed) {
        const hour = new Date(r.start_time as string).getHours();
        const existing = hourMap.get(hour) ?? { bookings: 0 };
        hourMap.set(hour, { bookings: existing.bookings + 1 });
      }
      const { count: courtCount } = await supabase.from("courts")
        .select("id", { count: "exact", head: true }).eq("club_id", admin.clubId).eq("is_active", true);
      const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
      const maxPerHour = (courtCount ?? 1) * days;
      setUtilizationByHour(
        Array.from(hourMap.entries()).sort((a, b) => a[0] - b[0]).map(([hour, val]) => ({
          hour, bookings: val.bookings, capacity: maxPerHour,
          rate: maxPerHour > 0 ? Math.round((val.bookings / maxPerHour) * 100) : 0,
        }))
      );

      // Utilization by day of week
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayMap = new Map<number, number>();
      for (const r of confirmed) { const d = new Date(r.start_time as string).getDay(); dayMap.set(d, (dayMap.get(d) ?? 0) + 1); }
      const weeksInRange = Math.max(1, days / 7);
      setUtilizationByDay(
        Array.from({ length: 7 }, (_, i) => ({
          day: dayNames[i], bookings: dayMap.get(i) ?? 0,
          rate: Math.round(((dayMap.get(i) ?? 0) / weeksInRange / (courtCount ?? 1)) * 100 / 12), // rough per-hour estimate
        }))
      );

      // Revenue by source
      const sources: Record<string, { amount: number; count: number }> = { "Court Bookings": { amount: 0, count: 0 } };
      for (const r of confirmed) {
        sources["Court Bookings"].amount += Number(r.amount_paid) || 0;
        sources["Court Bookings"].count++;
      }
      // Event revenue
      const { data: eventRegs } = await supabase.from("event_registrations")
        .select("amount_paid, event:events!inner(club_id)").eq("status", "registered");
      const eventRevenue = (eventRegs ?? []).filter((er) => {
        const ev = er.event as { club_id: string } | null;
        return ev?.club_id === admin.clubId;
      }).reduce((s, er) => s + (Number(er.amount_paid) || 0), 0);
      const eventCount = (eventRegs ?? []).filter((er) => {
        const ev = er.event as { club_id: string } | null;
        return ev?.club_id === admin.clubId;
      }).length;
      if (eventCount > 0) sources["Events"] = { amount: eventRevenue, count: eventCount };

      setRevenueBySource(Object.entries(sources).map(([source, val]) => ({ source, ...val })).sort((a, b) => b.amount - a.amount));

      // Program fill rates
      const { data: programs } = await supabase.from("programs")
        .select("id, title, program_type, max_participants, status")
        .eq("club_id", admin.clubId).neq("status", "draft");
      if (programs && programs.length > 0) {
        const progIds = programs.map((p) => p.id as string);
        const { data: progRegs } = await supabase.from("program_registrations")
          .select("program_id").in("program_id", progIds).eq("status", "registered");
        const regCounts = new Map<string, number>();
        for (const r of progRegs ?? []) { const pid = r.program_id as string; regCounts.set(pid, (regCounts.get(pid) ?? 0) + 1); }
        setProgramFillRates(programs.map((p) => {
          const count = regCounts.get(p.id as string) ?? 0;
          const cap = p.max_participants as number | null;
          return {
            name: p.title as string, type: (p.program_type as string).replace("_", " "),
            registered: count, capacity: cap,
            rate: cap ? Math.round((count / cap) * 100) : 0,
          };
        }));
      }

      // Member activity frequency (bookings in period)
      const memberBookings = new Map<string, number>();
      for (const r of confirmed) {
        const uid = r.user_id as string ?? "";
        if (uid) memberBookings.set(uid, (memberBookings.get(uid) ?? 0) + 1);
      }
      const buckets = [
        { label: "0 bookings", min: 0, max: 0 },
        { label: "1-2 bookings", min: 1, max: 2 },
        { label: "3-5 bookings", min: 3, max: 5 },
        { label: "6-10 bookings", min: 6, max: 10 },
        { label: "11+ bookings", min: 11, max: 999 },
      ];
      // Count members with 0 bookings
      const bookingMembers = new Set(memberBookings.keys());
      const zeroBookings = (activeMemberCount ?? 0) - bookingMembers.size;
      const activityData = buckets.map((b) => {
        if (b.min === 0) return { bucket: b.label, count: Math.max(0, zeroBookings) };
        let count = 0;
        for (const [, v] of memberBookings) { if (v >= b.min && v <= b.max) count++; }
        return { bucket: b.label, count };
      });
      setMemberActivity(activityData);

    } catch (err) { console.error("Error fetching reports:", err); }
    finally { setLoading(false); }
  }, [admin?.clubId, range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const exportCSV = async (type: "reservations" | "members" | "revenue") => {
    if (!admin?.clubId) return;
    setExporting(type);
    try {
      const supabase = createClient();
      let csvContent = "";
      if (type === "reservations") {
        const { data: rows } = await supabase.from("reservations")
          .select("id, start_time, end_time, status, amount_paid, guest_count, booking_source, court:courts(name), user:users!reservations_user_id_fkey(full_name, email)")
          .eq("club_id", admin.clubId).order("start_time", { ascending: false }).limit(5000);
        csvContent = "ID,Court,Player,Email,Date,Start,End,Status,Amount,Guests,Source\n";
        for (const r of rows ?? []) {
          const court = (r.court as { name: string } | null)?.name ?? "";
          const user = r.user as { full_name: string; email: string } | null;
          csvContent += `"${r.id}","${court}","${user?.full_name ?? ""}","${user?.email ?? ""}","${new Date(r.start_time as string).toLocaleDateString()}","${new Date(r.start_time as string).toLocaleTimeString()}","${new Date(r.end_time as string).toLocaleTimeString()}","${r.status}","${r.amount_paid}","${r.guest_count}","${r.booking_source || "mobile"}"\n`;
        }
      } else if (type === "members") {
        const { data: rows } = await supabase.from("memberships")
          .select("user:users!memberships_user_id_fkey(full_name, email, created_at), status, is_active, membership_tier:membership_tiers!tier_id(name)")
          .eq("club_id", admin.clubId);
        csvContent = "Name,Email,Tier,Status,Active,Joined\n";
        for (const r of rows ?? []) {
          const user = r.user as { full_name: string; email: string; created_at: string } | null;
          const tier = (r.membership_tier as { name: string } | null)?.name ?? "None";
          csvContent += `"${user?.full_name ?? ""}","${user?.email ?? ""}","${tier}","${r.status || "active"}","${r.is_active}","${user?.created_at ? new Date(user.created_at).toLocaleDateString() : ""}"\n`;
        }
      } else {
        const { data: rows } = await supabase.from("payment_records")
          .select("entity_type, amount_cents, status, refund_amount_cents, created_at")
          .eq("club_id", admin.clubId).order("created_at", { ascending: false }).limit(5000);
        csvContent = "Date,Type,Amount,Status,Refund\n";
        for (const r of rows ?? []) {
          csvContent += `"${new Date(r.created_at as string).toLocaleDateString()}","${r.entity_type}","${((Number(r.amount_cents) || 0) / 100).toFixed(2)}","${r.status}","${((Number(r.refund_amount_cents) || 0) / 100).toFixed(2)}"\n`;
        }
      }
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${type}-${range}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error("CSV export error:", err); }
    finally { setExporting(null); }
  };

  const formatHour = (h: number) => h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`;
  const isLoading = adminLoading || loading;

  return (
    <div>
      <PageHeader title="Reports & Analytics" action={
        <div className="flex items-center gap-3">
          <FormSelect value={range} onChange={(v) => setRange(v as TimeRange)} options={TIME_RANGE_OPTIONS} />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => exportCSV("reservations")} disabled={!!exporting}>Reservations CSV</Button>
            <Button variant="secondary" size="sm" onClick={() => exportCSV("members")} disabled={!!exporting}>Members CSV</Button>
            <Button variant="secondary" size="sm" onClick={() => exportCSV("revenue")} disabled={!!exporting}>Revenue CSV</Button>
          </div>
        </div>
      } />

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Revenue" value={`$${totalRevenue.toFixed(2)}`} />
            <StatCard label="Bookings" value={totalBookings} />
            <StatCard label="Active Members" value={activeMembers} />
            <StatCard label="New Members" value={newMembers} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="No-Show Rate" value={`${noShowRate}%`} />
            <StatCard label="No-Shows" value={noShowCount} />
            <StatCard label="Cancellation Rate" value={`${cancellationRate}%`} />
            <StatCard label="Cancellations" value={cancellationCount} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Avg Revenue/Booking" value={`$${avgRevenuePerBooking.toFixed(2)}`} />
            <StatCard label="Refunds" value={totalRefunds} />
            <StatCard label="Refund Amount" value={`$${refundAmount.toFixed(2)}`} />
            <StatCard label="Net Revenue" value={`$${(totalRevenue - refundAmount).toFixed(2)}`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Utilization by Hour */}
            <Card title="Bookings by Hour">
              {utilizationByHour.length === 0 ? <p className="text-sm text-slate-500">No data</p> : (
                <div className="space-y-2">
                  {utilizationByHour.map((h) => {
                    const maxBookings = Math.max(...utilizationByHour.map((x) => x.bookings));
                    const pct = maxBookings > 0 ? Math.round((h.bookings / maxBookings) * 100) : 0;
                    return (
                      <div key={h.hour} className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 w-10 text-right">{formatHour(h.hour)}</span>
                        <div className="flex-1 h-5 rounded bg-slate-100 overflow-hidden">
                          <div className="h-full rounded bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-600 w-12 text-right">{h.bookings}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Utilization by Day */}
            <Card title="Bookings by Day of Week">
              {utilizationByDay.length === 0 ? <p className="text-sm text-slate-500">No data</p> : (
                <div className="space-y-2">
                  {utilizationByDay.map((d) => {
                    const maxBookings = Math.max(...utilizationByDay.map((x) => x.bookings));
                    const pct = maxBookings > 0 ? Math.round((d.bookings / maxBookings) * 100) : 0;
                    return (
                      <div key={d.day} className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 w-10 text-right">{d.day}</span>
                        <div className="flex-1 h-5 rounded bg-slate-100 overflow-hidden">
                          <div className="h-full rounded bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-600 w-12 text-right">{d.bookings}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Revenue by Source */}
            <Card title="Revenue by Source">
              {revenueBySource.length === 0 ? <p className="text-sm text-slate-500">No data</p> : (
                <div className="space-y-3">
                  {revenueBySource.map((s) => {
                    const total = revenueBySource.reduce((sum, x) => sum + x.amount, 0);
                    const pct = total > 0 ? Math.round((s.amount / total) * 100) : 0;
                    return (
                      <div key={s.source}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-900">{s.source}</span>
                          <span className="text-slate-600">${s.amount.toFixed(2)} ({s.count} txns)</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Member Activity */}
            <Card title="Member Activity Frequency">
              {memberActivity.length === 0 ? <p className="text-sm text-slate-500">No data</p> : (
                <div className="space-y-2">
                  {memberActivity.map((m) => {
                    const maxCount = Math.max(...memberActivity.map((x) => x.count));
                    const pct = maxCount > 0 ? Math.round((m.count / maxCount) * 100) : 0;
                    return (
                      <div key={m.bucket} className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 w-24 text-right">{m.bucket}</span>
                        <div className="flex-1 h-5 rounded bg-slate-100 overflow-hidden">
                          <div className="h-full rounded bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-600 w-12 text-right">{m.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Program Fill Rates */}
          {programFillRates.length > 0 && (
            <Card title="Program Fill Rates" className="mb-6">
              <div className="space-y-3">
                {programFillRates.map((p) => (
                  <div key={p.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-900">{p.name} <span className="text-slate-400 font-normal">({p.type})</span></span>
                      <span className="text-slate-600">{p.registered}{p.capacity ? ` / ${p.capacity}` : ""} ({p.rate}%)</span>
                    </div>
                    {p.capacity && (
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{
                          width: `${Math.min(100, p.rate)}%`,
                          backgroundColor: p.rate >= 90 ? "#ef4444" : p.rate >= 60 ? "#f59e0b" : "#0d9488",
                        }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
