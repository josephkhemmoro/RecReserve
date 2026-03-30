import { createClient } from "@/utils/supabase/client";

export interface TrendData {
  courtUtilization: number[];
  newMembers: number[];
  reservations: number[];
  revenue: number[];
  noShows: number[];
}

export interface CourtOccupancy {
  courtId: string;
  courtName: string;
  openTime: string;
  closeTime: string;
  bookings: {
    startMins: number;
    endMins: number;
    playerName: string;
    time: string;
    amount: number;
  }[];
}

export interface CourtRevenue {
  courtId: string;
  courtName: string;
  totalRevenue: number;
  bookingCount: number;
  averagePerBooking: number;
}

function getDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getDayBounds(dateStr: string): { start: string; end: string } {
  return {
    start: `${dateStr}T00:00:00`,
    end: `${dateStr}T23:59:59`,
  };
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(getDateStr(d));
  }
  return days;
}

export async function getDashboardTrends(clubId: string): Promise<TrendData> {
  const supabase = createClient();
  const days = getLast7Days();

  const reservations: number[] = [];
  const revenue: number[] = [];
  const noShows: number[] = [];
  const newMembers: number[] = [];
  const courtUtilization: number[] = [];

  try {
    // Fetch all reservations for the last 7 days in one query
    const { start } = getDayBounds(days[0]);
    const { end } = getDayBounds(days[6]);

    const [resData, memberData, courtsData, availData] = await Promise.all([
      supabase
        .from("reservations")
        .select("start_time, end_time, status, amount_paid")
        .eq("club_id", clubId)
        .gte("start_time", start)
        .lte("start_time", end),
      supabase
        .from("memberships")
        .select("created_at")
        .eq("club_id", clubId)
        .eq("is_active", true)
        .gte("created_at", start)
        .lte("created_at", end),
      supabase
        .from("courts")
        .select("id")
        .eq("club_id", clubId)
        .eq("is_active", true),
      supabase
        .from("court_availability")
        .select("court_id, open_time, close_time, day_of_week"),
    ]);

    const allRes = resData.data ?? [];
    const allMembers = memberData.data ?? [];
    const courtIds = new Set((courtsData.data ?? []).map((c: { id: string }) => c.id));
    const allAvail = (availData.data ?? []).filter(
      (a: { court_id: string }) => courtIds.has(a.court_id)
    );

    for (const day of days) {
      const { start: dStart, end: dEnd } = getDayBounds(day);
      const dayDate = new Date(day + "T00:00:00");
      const dow = dayDate.getDay();

      // Reservations for this day
      const dayRes = allRes.filter(
        (r: { start_time: string }) => r.start_time >= dStart && r.start_time <= dEnd
      );

      const confirmedOrCompleted = dayRes.filter(
        (r: { status: string }) => r.status === "confirmed" || r.status === "completed"
      );

      reservations.push(confirmedOrCompleted.length);

      revenue.push(
        confirmedOrCompleted.reduce(
          (sum: number, r: { amount_paid: number }) => sum + Number(r.amount_paid || 0),
          0
        )
      );

      noShows.push(
        dayRes.filter((r: { status: string }) => r.status === "no_show").length
      );

      // New members this day
      newMembers.push(
        allMembers.filter((m: { created_at: string }) => {
          const mDay = m.created_at.split("T")[0];
          return mDay === day;
        }).length
      );

      // Court utilization for this day
      const dayAvail = allAvail.filter(
        (a: { day_of_week: number }) => a.day_of_week === dow
      );
      let totalAvailHours = 0;
      for (const a of dayAvail) {
        const av = a as { open_time: string; close_time: string };
        const [oh, om] = av.open_time.split(":").map(Number);
        const [ch, cm] = av.close_time.split(":").map(Number);
        totalAvailHours += (ch * 60 + cm - oh * 60 - om) / 60;
      }

      let bookedHours = 0;
      for (const r of confirmedOrCompleted) {
        const res = r as { start_time: string; end_time: string };
        const rs = new Date(res.start_time);
        const re = new Date(res.end_time);
        bookedHours += (re.getTime() - rs.getTime()) / 3600000;
      }

      courtUtilization.push(
        totalAvailHours > 0 ? Math.round((bookedHours / totalAvailHours) * 100) : 0
      );
    }
  } catch (err) {
    console.error("Error fetching trends:", err);
    return {
      courtUtilization: Array(7).fill(0),
      newMembers: Array(7).fill(0),
      reservations: Array(7).fill(0),
      revenue: Array(7).fill(0),
      noShows: Array(7).fill(0),
    };
  }

  return { courtUtilization, newMembers, reservations, revenue, noShows };
}

export async function getCourtOccupancy(clubId: string): Promise<{
  courts: CourtOccupancy[];
  occupancyPercent: number;
}> {
  const supabase = createClient();
  const today = new Date();
  const todayStr = getDateStr(today);
  const dow = today.getDay();
  const { start, end } = getDayBounds(todayStr);

  try {
    const [courtsRes, availRes, resRes] = await Promise.all([
      supabase
        .from("courts")
        .select("id, name")
        .eq("club_id", clubId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("court_availability")
        .select("court_id, open_time, close_time")
        .eq("day_of_week", dow),
      supabase
        .from("reservations")
        .select("court_id, start_time, end_time, amount_paid, user:users(full_name)")
        .eq("club_id", clubId)
        .eq("status", "confirmed")
        .gte("start_time", start)
        .lte("start_time", end),
    ]);

    const courts = courtsRes.data ?? [];
    const courtIds = new Set(courts.map((c: { id: string }) => c.id));
    const avail = (availRes.data ?? []).filter(
      (a: { court_id: string }) => courtIds.has(a.court_id)
    );
    const reservations = (resRes.data ?? []).filter(
      (r: { court_id: string }) => courtIds.has(r.court_id)
    );

    let totalAvailMins = 0;
    let totalBookedMins = 0;

    const result: CourtOccupancy[] = courts.map(
      (court: { id: string; name: string }) => {
        const courtAvail = avail.find(
          (a: { court_id: string }) => a.court_id === court.id
        ) as { open_time: string; close_time: string } | undefined;

        const openTime = courtAvail?.open_time ?? "06:00";
        const closeTime = courtAvail?.close_time ?? "21:00";

        const [oh, om] = openTime.split(":").map(Number);
        const [ch, cm] = closeTime.split(":").map(Number);
        const availMins = ch * 60 + cm - (oh * 60 + om);
        totalAvailMins += availMins;

        const courtRes = reservations.filter(
          (r: { court_id: string }) => r.court_id === court.id
        );

        const bookings = courtRes.map(
          (r: {
            start_time: string;
            end_time: string;
            amount_paid: number;
            user: { full_name: string } | null;
          }) => {
            const s = new Date(r.start_time);
            const e = new Date(r.end_time);
            const startMins = s.getHours() * 60 + s.getMinutes();
            const endMins = e.getHours() * 60 + e.getMinutes();
            totalBookedMins += endMins - startMins;

            const timeStr = `${s.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })} – ${e.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}`;

            return {
              startMins,
              endMins,
              playerName: r.user?.full_name ?? "Unknown",
              time: timeStr,
              amount: Number(r.amount_paid || 0),
            };
          }
        );

        return {
          courtId: court.id,
          courtName: court.name,
          openTime,
          closeTime,
          bookings,
        };
      }
    );

    const occupancyPercent =
      totalAvailMins > 0
        ? Math.round((totalBookedMins / totalAvailMins) * 100)
        : 0;

    return { courts: result, occupancyPercent };
  } catch (err) {
    console.error("Error fetching court occupancy:", err);
    return { courts: [], occupancyPercent: 0 };
  }
}

export async function getRevenueByCourtData(
  clubId: string
): Promise<CourtRevenue[]> {
  const supabase = createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  try {
    const [courtsRes, resRes] = await Promise.all([
      supabase
        .from("courts")
        .select("id, name")
        .eq("club_id", clubId)
        .eq("is_active", true),
      supabase
        .from("reservations")
        .select("court_id, amount_paid")
        .eq("club_id", clubId)
        .in("status", ["confirmed", "completed"])
        .gte("start_time", monthStart)
        .lte("start_time", monthEnd),
    ]);

    const courts = courtsRes.data ?? [];
    const reservations = resRes.data ?? [];

    const result: CourtRevenue[] = courts
      .map((court: { id: string; name: string }) => {
        const courtRes = reservations.filter(
          (r: { court_id: string }) => r.court_id === court.id
        );
        const totalRevenue = courtRes.reduce(
          (sum: number, r: { amount_paid: number }) =>
            sum + Number(r.amount_paid || 0),
          0
        );
        const bookingCount = courtRes.length;
        return {
          courtId: court.id,
          courtName: court.name,
          totalRevenue,
          bookingCount,
          averagePerBooking:
            bookingCount > 0 ? Math.round((totalRevenue / bookingCount) * 100) / 100 : 0,
        };
      })
      .sort(
        (a: CourtRevenue, b: CourtRevenue) => b.totalRevenue - a.totalRevenue
      );

    return result;
  } catch (err) {
    console.error("Error fetching revenue by court:", err);
    return [];
  }
}
