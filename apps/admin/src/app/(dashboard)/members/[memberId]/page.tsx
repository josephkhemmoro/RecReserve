"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, Badge, Button, StatCard, Skeleton } from "@/components/ui";

interface MemberDetail {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  credit_balance: number;
}

interface ReservationSummary {
  total: number;
  completed: number;
  cancelled: number;
  no_show: number;
  total_spent: number;
}

interface StreakInfo {
  current_streak: number;
  longest_streak: number;
}

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.memberId as string;
  const { admin, loading: adminLoading } = useAdminClub();

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [stats, setStats] = useState<ReservationSummary>({ total: 0, completed: 0, cancelled: 0, no_show: 0, total_spent: 0 });
  const [streak, setStreak] = useState<StreakInfo>({ current_streak: 0, longest_streak: 0 });
  const [kudosCount, setKudosCount] = useState(0);
  const [recentBookings, setRecentBookings] = useState<{ id: string; court_name: string; start_time: string; status: string; amount_paid: number }[]>([]);
  const [termsAcceptances, setTermsAcceptances] = useState<{ id: string; terms_version: number; accepted_at: string; ip_address: string | null; user_agent: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!admin?.clubId || !memberId) return;
    try {
      const supabase = createClient();

      const [memberRes, reservationsRes, streakRes, kudosRes, recentRes, termsRes] = await Promise.all([
        supabase.from("users").select("id, full_name, email, avatar_url, phone, created_at, credit_balance").eq("id", memberId).single(),
        supabase.from("reservations").select("status, amount_paid").eq("user_id", memberId).eq("club_id", admin.clubId),
        supabase.from("player_streaks").select("current_streak, longest_streak").eq("user_id", memberId).eq("club_id", admin.clubId).single(),
        supabase.from("kudos").select("id", { count: "exact", head: true }).eq("receiver_id", memberId).eq("club_id", admin.clubId),
        supabase.from("reservations").select("id, status, amount_paid, start_time, court:courts(name)")
          .eq("user_id", memberId).eq("club_id", admin.clubId)
          .order("start_time", { ascending: false }).limit(20),
        supabase.from("terms_acceptances").select("id, terms_version, accepted_at, ip_address, user_agent")
          .eq("user_id", memberId).eq("club_id", admin.clubId)
          .order("accepted_at", { ascending: false }),
      ]);
      setTermsAcceptances((termsRes.data || []).map((t) => ({
        id: t.id,
        terms_version: t.terms_version,
        accepted_at: t.accepted_at,
        ip_address: t.ip_address,
        user_agent: t.user_agent,
      })));

      setMember(memberRes.data as MemberDetail | null);

      const reservations = reservationsRes.data ?? [];
      setStats({
        total: reservations.length,
        completed: reservations.filter((r) => (r.status as string) === "completed").length,
        cancelled: reservations.filter((r) => (r.status as string) === "cancelled").length,
        no_show: reservations.filter((r) => (r.status as string) === "no_show").length,
        total_spent: reservations.reduce((sum, r) => sum + (Number(r.amount_paid) || 0), 0),
      });

      setStreak(streakRes.data as StreakInfo ?? { current_streak: 0, longest_streak: 0 });
      setKudosCount(kudosRes.count ?? 0);
      setRecentBookings(
        (recentRes.data ?? []).map((r) => ({
          id: r.id as string,
          court_name: (r.court as { name: string } | null)?.name ?? "Court",
          start_time: r.start_time as string,
          status: r.status as string,
          amount_paid: Number(r.amount_paid) || 0,
        }))
      );
    } catch (err) {
      console.error("Error fetching member detail:", err);
    } finally {
      setLoading(false);
    }
  }, [admin?.clubId, memberId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const noShowRate = stats.total > 0 ? Math.round((stats.no_show / stats.total) * 100) : 0;

  const handleMarkNoShow = async (reservationId: string) => {
    try {
      const supabase = createClient();
      await supabase.from("reservations").update({ status: "no_show" }).eq("id", reservationId);
      fetchData();
    } catch (err) {
      console.error("Error marking no-show:", err);
    }
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const statusVariant = (s: string): "success" | "warning" | "error" | "default" | "brand" => {
    if (s === "confirmed") return "brand";
    if (s === "completed") return "success";
    if (s === "cancelled") return "error";
    if (s === "no_show") return "warning";
    return "default";
  };

  const isLoading = adminLoading || loading;

  return (
    <div>
      <PageHeader
        title={isLoading ? "Member" : member?.full_name ?? "Member"}
        action={<Button variant="secondary" onClick={() => router.back()}>Back to Members</Button>}
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      ) : !member ? (
        <Card><p className="text-sm text-slate-500">Member not found.</p></Card>
      ) : (
        <>
          {/* Profile Info */}
          <Card className="mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-600 overflow-hidden">
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  member.full_name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{member.full_name}</h2>
                <p className="text-sm text-slate-500">{member.email}</p>
                {member.phone && <p className="text-sm text-slate-500">{member.phone}</p>}
                <p className="text-xs text-slate-400 mt-1">
                  Joined {new Date(member.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-slate-500">Credit Balance</p>
                <p className="text-lg font-bold text-brand">${(Number(member.credit_balance) || 0).toFixed(2)}</p>
              </div>
            </div>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Bookings" value={stats.total} />
            <StatCard label="Total Spent" value={`$${stats.total_spent.toFixed(2)}`} />
            <StatCard label="No-Show Rate" value={`${noShowRate}%`} />
            <StatCard label="Kudos Received" value={kudosCount} />
          </div>

          {/* Streak */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <StatCard label="Current Streak" value={`${streak.current_streak} weeks`} />
            <StatCard label="Longest Streak" value={`${streak.longest_streak} weeks`} />
          </div>

          {/* Terms & Conditions Acceptance History */}
          <Card title="Terms & Conditions" subtitle="Audit trail of when this member accepted club terms" noPadding>
            {termsAcceptances.length === 0 ? (
              <p className="px-6 py-4 text-sm text-slate-500">This member has not accepted any version of the club&apos;s terms.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40">
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Version</th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Accepted</th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">IP Address</th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {termsAcceptances.map((t) => (
                    <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-6 py-3"><Badge label={`v${t.terms_version}`} variant="brand" size="sm" /></td>
                      <td className="px-6 py-3 text-sm text-slate-700 tabular-nums">{new Date(t.accepted_at).toLocaleString()}</td>
                      <td className="px-6 py-3 text-xs text-slate-500 font-mono">{t.ip_address || "—"}</td>
                      <td className="px-6 py-3 text-xs text-slate-500 max-w-xs truncate" title={t.user_agent || ""}>{t.user_agent || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Recent Bookings */}
          <Card title="Recent Bookings" noPadding>
            {recentBookings.length === 0 ? (
              <p className="px-6 py-4 text-sm text-slate-500">No bookings found</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Court</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((b) => (
                    <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-6 py-3 text-sm font-medium text-slate-900">{b.court_name}</td>
                      <td className="px-6 py-3 text-sm text-slate-600">{formatDateTime(b.start_time)}</td>
                      <td className="px-6 py-3"><Badge label={b.status} variant={statusVariant(b.status)} /></td>
                      <td className="px-6 py-3 text-sm text-slate-600">{b.amount_paid > 0 ? `$${b.amount_paid.toFixed(2)}` : "Free"}</td>
                      <td className="px-6 py-3 text-right">
                        {b.status === "completed" && (
                          <Button variant="danger" size="sm" onClick={() => handleMarkNoShow(b.id)}>
                            Mark No-Show
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
