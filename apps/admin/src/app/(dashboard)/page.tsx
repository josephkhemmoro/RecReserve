"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";

interface Stats {
  totalCourts: number;
  activeMembers: number;
  todayReservations: number;
  revenueThisMonth: number;
}

interface TodayReservation {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  court: { name: string } | null;
  user: { full_name: string; email: string } | null;
}

function StatSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
      <div className="h-4 w-24 bg-slate-200 rounded mb-3" />
      <div className="h-8 w-16 bg-slate-200 rounded" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-5 flex-1 bg-slate-200 rounded" />
          <div className="h-5 w-32 bg-slate-200 rounded" />
          <div className="h-5 w-24 bg-slate-200 rounded" />
          <div className="h-5 w-20 bg-slate-200 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayList, setTodayList] = useState<TodayReservation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async (clubId: string) => {
    const supabase = createClient();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    try {
      const [courtsRes, membersRes, todayCountRes, revenueRes, todayListRes] =
        await Promise.all([
          supabase
            .from("courts")
            .select("id", { count: "exact", head: true })
            .eq("club_id", clubId)
            .eq("is_active", true),
          supabase
            .from("memberships")
            .select("id", { count: "exact", head: true })
            .eq("club_id", clubId)
            .eq("is_active", true),
          supabase
            .from("reservations")
            .select("id", { count: "exact", head: true })
            .eq("club_id", clubId)
            .gte("start_time", todayStart)
            .lt("start_time", todayEnd),
          supabase
            .from("reservations")
            .select("amount_paid")
            .eq("club_id", clubId)
            .eq("status", "confirmed")
            .gte("start_time", monthStart)
            .lt("start_time", todayEnd),
          supabase
            .from("reservations")
            .select("id, start_time, end_time, status, court:courts(name), user:users(full_name, email)")
            .eq("club_id", clubId)
            .gte("start_time", todayStart)
            .lt("start_time", todayEnd)
            .order("start_time", { ascending: true })
            .limit(20),
        ]);

      const revenue = (revenueRes.data ?? []).reduce(
        (sum: number, r: { amount_paid: number }) => sum + Number(r.amount_paid || 0),
        0
      );

      setStats({
        totalCourts: courtsRes.count ?? 0,
        activeMembers: membersRes.count ?? 0,
        todayReservations: todayCountRes.count ?? 0,
        revenueThisMonth: revenue,
      });

      setTodayList((todayListRes.data ?? []) as unknown as TodayReservation[]);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin?.clubId) {
      fetchDashboard(admin.clubId);
    }
  }, [admin?.clubId, fetchDashboard]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const isLoading = adminLoading || loading;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-8">
        Welcome back, {admin?.fullName || "..."}
      </h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {isLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Total Courts" value={String(stats?.totalCourts ?? 0)} />
            <StatCard label="Active Members" value={String(stats?.activeMembers ?? 0)} />
            <StatCard label="Today's Reservations" value={String(stats?.todayReservations ?? 0)} />
            <StatCard label="Revenue This Month" value={`$${(stats?.revenueThisMonth ?? 0).toFixed(2)}`} />
          </>
        )}
      </div>

      {/* Today's Reservations Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Today&apos;s Reservations
          </h2>
        </div>

        {isLoading ? (
          <div className="p-6">
            <TableSkeleton />
          </div>
        ) : todayList.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-slate-500">No reservations today</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Court
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Player
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {todayList.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-6 py-3 text-sm text-slate-900">
                    {r.court?.name ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-700">
                    {r.user?.full_name ?? r.user?.email ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600">
                    {formatTime(r.start_time)} – {formatTime(r.end_time)}
                  </td>
                  <td className="px-6 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: "bg-green-50 text-green-700",
    cancelled: "bg-red-50 text-red-700",
    completed: "bg-slate-100 text-slate-600",
    no_show: "bg-amber-50 text-amber-700",
  };

  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
