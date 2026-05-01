"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { CourtOccupancyHeatMap } from "@/components/dashboard/CourtOccupancyHeatMap";
import { RevenueByCourtChart } from "@/components/dashboard/RevenueByCourtChart";
import { StatCard, Card, Badge, Button, PageHeader, SkeletonCard, SkeletonTableRow } from "@/components/ui";
import { useConfirm } from "@/components/ui/Dialog";
import { localDayStart, localDayEnd, localMonthStart } from "@/lib/dateUtils";
import {
  getDashboardTrends,
  getCourtOccupancy,
  getRevenueByCourtData,
  type TrendData,
  type CourtOccupancy,
  type CourtRevenue,
} from "@/lib/dashboardData";

interface StripeStatus {
  connected: boolean;
  onboardingComplete: boolean;
}

interface Stats {
  courtUtilization: number;
  totalCourts: number;
  activeMembers: number;
  todayReservations: number;
  revenueThisMonth: number;
  noShowsToday: number;
}

interface TodayReservation {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  amount_paid: number;
  court: { name: string } | null;
  user: { full_name: string; email: string } | null;
}

function getTrend(data: number[] | undefined): { value: number; direction: "up" | "down" | "flat" } | undefined {
  if (!data || data.length < 2) return undefined;
  const first = data[0];
  const last = data[data.length - 1];
  if (first === 0 && last === 0) return { value: 0, direction: "flat" };
  if (first === 0) return { value: 100, direction: "up" };
  const pct = Math.round(((last - first) / first) * 100);
  if (pct > 0) return { value: pct, direction: "up" };
  if (pct < 0) return { value: Math.abs(pct), direction: "down" };
  return { value: 0, direction: "flat" };
}

export default function DashboardPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayList, setTodayList] = useState<TodayReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [occupancy, setOccupancy] = useState<{
    courts: CourtOccupancy[];
    occupancyPercent: number;
  }>({ courts: [], occupancyPercent: 0 });
  const [revenueData, setRevenueData] = useState<CourtRevenue[]>([]);
  const confirm = useConfirm();
  const [markingNoShow, setMarkingNoShow] = useState<string | null>(null);
  const [setupChecklist, setSetupChecklist] = useState<{ courts: boolean; tiers: boolean; rules: boolean; stripe: boolean } | null>(null);
  const [socialStats, setSocialStats] = useState({ gamesCreated: 0, gamesFilled: 0, groupsActive: 0, gameParticipants: 0 });

  const fetchDashboard = useCallback(async (clubId: string) => {
    const supabase = createClient();
    const todayStart = localDayStart();
    const todayEnd = localDayEnd();
    const monthStart = localMonthStart();

    try {
      const { data: clubData } = await supabase
        .from("clubs")
        .select("stripe_account_id, stripe_onboarding_complete")
        .eq("id", clubId)
        .single();

      setStripeStatus({
        connected: !!clubData?.stripe_account_id,
        onboardingComplete: !!clubData?.stripe_onboarding_complete,
      });

      const [courtsRes, membersRes, todayCountRes, revenueRes, todayListRes, noShowRes] =
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
            .lte("start_time", todayEnd),
          supabase
            .from("reservations")
            .select("amount_paid")
            .eq("club_id", clubId)
            .eq("status", "confirmed")
            .gte("start_time", monthStart)
            .lte("start_time", todayEnd),
          supabase
            .from("reservations")
            .select(
              "id, start_time, end_time, status, amount_paid, court:courts(name), user:users(full_name, email)"
            )
            .eq("club_id", clubId)
            .gte("start_time", todayStart)
            .lte("start_time", todayEnd)
            .order("start_time", { ascending: true })
            .limit(30),
          supabase
            .from("reservations")
            .select("id", { count: "exact", head: true })
            .eq("club_id", clubId)
            .eq("status", "no_show")
            .gte("start_time", todayStart)
            .lte("start_time", todayEnd),
        ]);

      const revenue = (revenueRes.data ?? []).reduce(
        (sum: number, r: { amount_paid: number }) => sum + Number(r.amount_paid || 0),
        0
      );

      // Get occupancy percent from the occupancy data (will be fetched separately)
      setStats({
        courtUtilization: 0, // updated by occupancy fetch
        totalCourts: courtsRes.count ?? 0,
        activeMembers: membersRes.count ?? 0,
        todayReservations: todayCountRes.count ?? 0,
        revenueThisMonth: revenue,
        noShowsToday: noShowRes.count ?? 0,
      });

      setTodayList(
        (todayListRes.data ?? []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          start_time: r.start_time as string,
          end_time: r.end_time as string,
          status: r.status as string,
          amount_paid: Number(r.amount_paid || 0),
          court: r.court as { name: string } | null,
          user: r.user as { full_name: string; email: string } | null,
        }))
      );

      // Fetch supplementary data in parallel
      const [trendData, occData, revData] = await Promise.all([
        getDashboardTrends(clubId),
        getCourtOccupancy(clubId),
        getRevenueByCourtData(clubId),
      ]);

      setTrends(trendData);
      setOccupancy(occData);
      setRevenueData(revData);
      setStats((prev) =>
        prev ? { ...prev, courtUtilization: occData.occupancyPercent } : prev
      );

      // Social stats
      try {
        const weekAgoDate = new Date(Date.now() - 7 * 86400000).toISOString();
        const [gcRes, gfRes, gaRes, gpRes] = await Promise.all([
          supabase.from("open_games").select("id", { count: "exact", head: true }).eq("club_id", clubId).gte("created_at", weekAgoDate),
          supabase.from("open_games").select("id", { count: "exact", head: true }).eq("club_id", clubId).in("status", ["full", "confirmed", "completed"]).gte("created_at", weekAgoDate),
          supabase.from("play_groups").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("is_active", true),
          supabase.from("game_participants").select("id", { count: "exact", head: true }).eq("status", "joined").gte("joined_at", weekAgoDate),
        ]);
        setSocialStats({ gamesCreated: gcRes.count ?? 0, gamesFilled: gfRes.count ?? 0, groupsActive: gaRes.count ?? 0, gameParticipants: gpRes.count ?? 0 });
      } catch {}
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin?.clubId) fetchDashboard(admin.clubId);
  }, [admin?.clubId, fetchDashboard]);

  useEffect(() => {
    if (!admin?.clubId) return;
    const checkSetup = async () => {
      const supabase = createClient();
      const [courtsRes, tiersRes, rulesRes, clubRes] = await Promise.all([
        supabase.from("courts").select("id", { count: "exact", head: true }).eq("club_id", admin.clubId).eq("is_active", true),
        supabase.from("membership_tiers").select("id", { count: "exact", head: true }).eq("club_id", admin.clubId),
        supabase.from("booking_rules").select("id", { count: "exact", head: true }).eq("club_id", admin.clubId),
        supabase.from("clubs").select("stripe_onboarding_complete").eq("id", admin.clubId).single(),
      ]);
      const checklist = {
        courts: (courtsRes.count ?? 0) > 0,
        tiers: (tiersRes.count ?? 0) > 0,
        rules: (rulesRes.count ?? 0) > 0,
        stripe: clubRes.data?.stripe_onboarding_complete === true,
      };
      // Only show if not everything is done
      if (!checklist.courts || !checklist.tiers || !checklist.rules || !checklist.stripe) {
        setSetupChecklist(checklist);
      }
    };
    checkSetup();
  }, [admin?.clubId]);

  const handleMarkNoShow = async (reservation: TodayReservation) => {
    const ok = await confirm({
      title: `Mark ${reservation.user?.full_name || "this player"} as no-show?`,
      description: "The reservation will be flagged and the action is logged.",
      confirmLabel: "Mark No-Show",
      tone: "warning",
    });
    if (!ok) return;

    setMarkingNoShow(reservation.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("reservations")
        .update({ status: "no_show" })
        .eq("id", reservation.id);

      if (error) throw error;

      // Send notification to the player
      if (reservation.user) {
        const { data: userData } = await supabase
          .from("reservations")
          .select("user_id")
          .eq("id", reservation.id)
          .single();

        if (userData?.user_id) {
          // Get club_id from the reservation
          const { data: resData } = await supabase
            .from("reservations")
            .select("club_id")
            .eq("id", reservation.id)
            .single();

          await supabase.from("notifications").insert({
            user_id: userData.user_id,
            club_id: resData?.club_id || admin?.clubId || null,
            title: "Missed Reservation",
            body: `You were marked as a no-show for your ${reservation.court?.name || "court"} booking at ${formatTime(reservation.start_time)}. Repeated no-shows may affect your booking privileges.`,
            type: "no_show",
            read: false,
          });
        }
      }

      // Refresh
      if (admin?.clubId) fetchDashboard(admin.clubId);
    } catch (err) {
      console.error("Error marking no-show:", err);
    } finally {
      setMarkingNoShow(null);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const isLoading = adminLoading || loading;

  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState("");

  const handleSetupStripe = async () => {
    if (!admin) return;
    setStripeLoading(true);
    setStripeError("");
    try {
      const supabase = createClient();
      const {
        data: { session: refreshedSession },
        error: refreshError,
      } = await supabase.auth.refreshSession();
      const session = refreshedSession;
      if (!session) {
        setStripeError("Not authenticated. Please log in again.");
        return;
      }

      const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-connect-account`;
      const response = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({
          club_id: admin.clubId,
          email: session.user.email,
          return_url: `${window.location.origin}/stripe-return`,
          refresh_url: `${window.location.origin}/stripe-return?refresh=true`,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setStripeError(data.error || data.message || "Failed to start Stripe setup");
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setStripeError("No onboarding URL returned.");
      }
    } catch (err) {
      setStripeError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setStripeLoading(false);
    }
  };

  const now = new Date();
  const isPastReservation = (endTime: string) => new Date(endTime) < now;

  const statusVariants: Record<string, "success" | "error" | "warning" | "default"> = {
    confirmed: "success", cancelled: "error", completed: "default", no_show: "warning",
  };
  const statusLabels: Record<string, string> = {
    confirmed: "Confirmed", cancelled: "Cancelled", completed: "Completed", no_show: "No-Show",
  };

  return (
    <div>
      <PageHeader title={`Welcome back, ${admin?.fullName || "..."}`} />

      {/* Stripe Connect Banner */}
      {stripeStatus && !stripeStatus.onboardingComplete && (
        <div
          className={`rounded-xl border p-4 mb-6 ${
            stripeStatus.connected
              ? "bg-amber-50 border-amber-200"
              : "bg-blue-50 border-blue-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`font-semibold text-sm ${
                  stripeStatus.connected ? "text-amber-800" : "text-brand-dark"
                }`}
              >
                {stripeStatus.connected
                  ? "Stripe setup incomplete"
                  : "Set up payments to accept bookings"}
              </p>
              <p
                className={`text-xs mt-0.5 ${
                  stripeStatus.connected ? "text-amber-600" : "text-brand"
                }`}
              >
                {stripeStatus.connected
                  ? "Complete your Stripe onboarding to start receiving payments."
                  : "Connect a Stripe account so payments route to your bank."}
              </p>
            </div>
            <button
              onClick={handleSetupStripe}
              disabled={stripeLoading}
              className={`px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 ${
                stripeStatus.connected
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-brand hover:bg-brand-dark"
              }`}
            >
              {stripeLoading
                ? "Loading..."
                : stripeStatus.connected
                ? "Continue Setup"
                : "Connect Stripe"}
            </button>
          </div>
          {stripeError && <p className="text-xs text-red-600 mt-2">{stripeError}</p>}
        </div>
      )}

      {/* Setup Checklist */}
      {setupChecklist && (
        <Card title="Setup Checklist" className="mb-6">
          <p className="text-sm text-slate-500 mb-4">Complete these steps to start accepting bookings.</p>
          <div className="space-y-3">
            {[
              { done: setupChecklist.courts, label: "Add your courts", href: "/courts", description: "Define courts with names and hourly rates" },
              { done: setupChecklist.tiers, label: "Create membership tiers", href: "/tier-pricing", description: "Set up pricing tiers with discounts" },
              { done: setupChecklist.rules, label: "Configure booking rules", href: "/booking-rules", description: "Set advance booking, duration, and cancellation limits" },
              { done: setupChecklist.stripe, label: "Connect Stripe", href: "#stripe", description: "Enable payments by connecting your Stripe account" },
            ].map((step) => (
              <div key={step.label} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${step.done ? "bg-emerald-100" : "bg-slate-100"}`}>
                  {step.done ? (
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                  )}
                </div>
                <div className="flex-1">
                  <a href={step.href} className={`text-sm font-medium ${step.done ? "text-slate-400 line-through" : "text-brand hover:underline"}`}>
                    {step.label}
                  </a>
                  {!step.done && <p className="text-xs text-slate-400">{step.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {isLoading ? (
          [1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard label="Court Utilization" value={`${stats?.courtUtilization ?? 0}%`} subtitle={`${stats?.totalCourts ?? 0} active courts`} sparklineData={trends?.courtUtilization} trend={getTrend(trends?.courtUtilization)} />
            <StatCard label="Active Members" value={String(stats?.activeMembers ?? 0)} sparklineData={trends?.newMembers} trend={getTrend(trends?.newMembers)} />
            <StatCard label="Today's Reservations" value={String(stats?.todayReservations ?? 0)} sparklineData={trends?.reservations} trend={getTrend(trends?.reservations)} />
            <StatCard label="Revenue This Month" value={`$${(stats?.revenueThisMonth ?? 0).toFixed(2)}`} sparklineData={trends?.revenue} trend={getTrend(trends?.revenue)} />
            <StatCard label="No-Shows Today" value={String(stats?.noShowsToday ?? 0)} sparklineData={trends?.noShows} trend={getTrend(trends?.noShows)} />
          </>
        )}
      </div>

      {/* Social Activity */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Games Created (7d)" value={socialStats.gamesCreated} />
        <StatCard label="Games Filled (7d)" value={socialStats.gamesFilled} />
        <StatCard label="Active Groups" value={socialStats.groupsActive} />
        <StatCard label="Game Joins (7d)" value={socialStats.gameParticipants} />
      </div>

      {/* Court Occupancy Heat Map */}
      <CourtOccupancyHeatMap
        courts={occupancy.courts}
        occupancyPercent={occupancy.occupancyPercent}
        isLoading={isLoading}
      />

      {/* Revenue by Court */}
      <RevenueByCourtChart data={revenueData} isLoading={isLoading} />

      {/* Today's Reservations Table */}
      <Card title="Today's Schedule" noPadding>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => <SkeletonTableRow key={i} />)}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {todayList.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-50 hover:bg-slate-50/50"
                >
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
                    <Badge label={statusLabels[r.status] ?? r.status} variant={statusVariants[r.status] ?? "default"} />
                  </td>
                  <td className="px-6 py-3">
                    {r.status === "confirmed" && isPastReservation(r.end_time) && (
                      <button
                        onClick={() => handleMarkNoShow(r)}
                        disabled={markingNoShow === r.id}
                        className="text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50"
                      >
                        {markingNoShow === r.id ? "Marking..." : "Mark No-Show"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
