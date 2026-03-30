import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function calcChange(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "→ 0%";
  if (previous === 0) return "↑ 100%";
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return `↑ ${pct}%`;
  if (pct < 0) return `↓ ${Math.abs(pct)}%`;
  return "→ 0%";
}

interface ClubDigest {
  clubName: string;
  adminEmails: string[];
  adminNames: string[];
  bookings: number;
  revenue: number;
  cancellations: number;
  noShows: number;
  newMembers: number;
  busiestCourt: string;
  peakHour: string;
  prevBookings: number;
  prevRevenue: number;
  todayBookings: number;
  openSpots: number;
}

function buildEmailHtml(digest: ClubDigest, adminName: string, dateStr: string): string {
  const bookingChange = calcChange(digest.bookings, digest.prevBookings);
  const revenueChange = calcChange(digest.revenue, digest.prevRevenue);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
  <h2 style="color: #1e293b; margin-bottom: 4px;">${digest.clubName} Daily Digest</h2>
  <p style="color: #64748b; margin-top: 0;">${dateStr}</p>

  <p>Hi ${adminName},</p>
  <p>Here&rsquo;s how your club did yesterday:</p>

  <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">📊 Yesterday&rsquo;s Numbers</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 6px 0; color: #475569;">Bookings</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">${digest.bookings} <span style="color: ${bookingChange.startsWith("↑") ? "#16a34a" : bookingChange.startsWith("↓") ? "#dc2626" : "#94a3b8"}; font-size: 12px;">${bookingChange} vs last week</span></td></tr>
      <tr><td style="padding: 6px 0; color: #475569;">Revenue</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">${formatCurrency(digest.revenue)} <span style="color: ${revenueChange.startsWith("↑") ? "#16a34a" : revenueChange.startsWith("↓") ? "#dc2626" : "#94a3b8"}; font-size: 12px;">${revenueChange} vs last week</span></td></tr>
      <tr><td style="padding: 6px 0; color: #475569;">Cancellations</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">${digest.cancellations}</td></tr>
      <tr><td style="padding: 6px 0; color: #475569;">No-Shows</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">${digest.noShows}</td></tr>
      <tr><td style="padding: 6px 0; color: #475569;">New Members</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">${digest.newMembers}</td></tr>
    </table>
  </div>

  ${digest.busiestCourt || digest.peakHour ? `
  <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">🏆 Highlights</h3>
    ${digest.busiestCourt ? `<p style="margin: 4px 0;">Busiest Court: <strong>${digest.busiestCourt}</strong></p>` : ""}
    ${digest.peakHour ? `<p style="margin: 4px 0;">Peak Hour: <strong>${digest.peakHour}</strong></p>` : ""}
  </div>
  ` : ""}

  <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">📅 Today&rsquo;s Outlook</h3>
    <p style="margin: 4px 0;">Bookings confirmed: <strong>${digest.todayBookings}</strong></p>
    ${digest.openSpots > 0 ? `<p style="margin: 4px 0;">Open spots posted: <strong>${digest.openSpots}</strong> (players looking for partners)</p>` : ""}
  </div>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
  <p style="color: #94a3b8; font-size: 12px;">RecReserve &middot; Your club&rsquo;s command center</p>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getDateStr(yesterday);
    const todayStr = getDateStr(now);

    // Same day last week
    const lastWeekDay = new Date(yesterday);
    lastWeekDay.setDate(lastWeekDay.getDate() - 7);
    const lastWeekStr = getDateStr(lastWeekDay);

    const yesterdayStart = `${yesterdayStr}T00:00:00`;
    const yesterdayEnd = `${yesterdayStr}T23:59:59`;
    const lastWeekStart = `${lastWeekStr}T00:00:00`;
    const lastWeekEnd = `${lastWeekStr}T23:59:59`;
    const todayStart = `${todayStr}T00:00:00`;
    const todayEnd = `${todayStr}T23:59:59`;

    // Get all active clubs
    const { data: clubs, error: clubsErr } = await supabase
      .from("clubs")
      .select("id, name");

    if (clubsErr) throw clubsErr;

    let clubsProcessed = 0;
    let emailsLogged = 0;

    for (const club of clubs ?? []) {
      try {
        // Get admin users
        const { data: admins } = await supabase
          .from("users")
          .select("id, full_name, email")
          .eq("club_id", club.id)
          .eq("role", "admin");

        if (!admins || admins.length === 0) continue;

        // Yesterday's reservations
        const { data: yesterdayRes } = await supabase
          .from("reservations")
          .select("court_id, start_time, status, amount_paid")
          .eq("club_id", club.id)
          .gte("start_time", yesterdayStart)
          .lte("start_time", yesterdayEnd);

        const allYesterday = yesterdayRes ?? [];
        const confirmed = allYesterday.filter(
          (r) => r.status === "confirmed" || r.status === "completed"
        );

        // Last week same day
        const { data: lastWeekRes } = await supabase
          .from("reservations")
          .select("amount_paid, status")
          .eq("club_id", club.id)
          .in("status", ["confirmed", "completed"])
          .gte("start_time", lastWeekStart)
          .lte("start_time", lastWeekEnd);

        // New members yesterday
        const { count: newMembersCount } = await supabase
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("club_id", club.id)
          .gte("created_at", yesterdayStart)
          .lte("created_at", yesterdayEnd);

        // Today's outlook
        const { count: todayBookings } = await supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("club_id", club.id)
          .eq("status", "confirmed")
          .gte("start_time", todayStart)
          .lte("start_time", todayEnd);

        // Open spots for today
        let openSpots = 0;
        try {
          const { count } = await supabase
            .from("open_spots")
            .select("id", { count: "exact", head: true })
            .eq("club_id", club.id)
            .eq("is_active", true);
          openSpots = count ?? 0;
        } catch {
          // open_spots table may not exist yet
        }

        // Busiest court
        const courtCounts: Record<string, number> = {};
        for (const r of confirmed) {
          courtCounts[r.court_id] = (courtCounts[r.court_id] || 0) + 1;
        }
        let busiestCourtId = "";
        let busiestCount = 0;
        for (const [cid, count] of Object.entries(courtCounts)) {
          if (count > busiestCount) {
            busiestCourtId = cid;
            busiestCount = count;
          }
        }
        let busiestCourt = "";
        if (busiestCourtId) {
          const { data: courtData } = await supabase
            .from("courts")
            .select("name")
            .eq("id", busiestCourtId)
            .single();
          busiestCourt = courtData
            ? `${courtData.name} (${busiestCount} bookings)`
            : "";
        }

        // Peak hour
        const hourCounts: Record<number, number> = {};
        for (const r of confirmed) {
          const hour = new Date(r.start_time).getHours();
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }
        let peakHourNum = 0;
        let peakCount = 0;
        for (const [h, count] of Object.entries(hourCounts)) {
          if (count > peakCount) {
            peakHourNum = Number(h);
            peakCount = count;
          }
        }
        const peakHour =
          peakCount > 0
            ? `${peakHourNum > 12 ? peakHourNum - 12 : peakHourNum || 12}:00 ${peakHourNum >= 12 ? "PM" : "AM"} (${peakCount} bookings)`
            : "";

        const prevRes = lastWeekRes ?? [];

        const digest: ClubDigest = {
          clubName: club.name,
          adminEmails: admins.map((a) => a.email),
          adminNames: admins.map((a) => a.full_name || "Admin"),
          bookings: confirmed.length,
          revenue: confirmed.reduce(
            (sum, r) => sum + Number(r.amount_paid || 0),
            0
          ),
          cancellations: allYesterday.filter((r) => r.status === "cancelled")
            .length,
          noShows: allYesterday.filter((r) => r.status === "no_show").length,
          newMembers: newMembersCount ?? 0,
          busiestCourt,
          peakHour,
          prevBookings: prevRes.length,
          prevRevenue: prevRes.reduce(
            (sum, r) => sum + Number(r.amount_paid || 0),
            0
          ),
          todayBookings: todayBookings ?? 0,
          openSpots,
        };

        // Build and log email for each admin
        for (let i = 0; i < admins.length; i++) {
          const html = buildEmailHtml(
            digest,
            digest.adminNames[i],
            formatDate(yesterday)
          );

          // TODO: Replace with email provider (e.g., Resend)
          // await fetch('https://api.resend.com/emails', {
          //   method: 'POST',
          //   headers: {
          //     'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          //     'Content-Type': 'application/json',
          //   },
          //   body: JSON.stringify({
          //     from: 'RecReserve <digest@recreserve.com>',
          //     to: digest.adminEmails[i],
          //     subject: `${digest.clubName} Daily Digest — ${formatDate(yesterday)}`,
          //     html,
          //   }),
          // });

          console.log(
            `[Daily Digest] Club: ${club.name}, Admin: ${digest.adminEmails[i]}`
          );
          console.log(
            `  Bookings: ${digest.bookings}, Revenue: ${formatCurrency(digest.revenue)}, No-Shows: ${digest.noShows}`
          );
          emailsLogged++;
        }

        clubsProcessed++;
      } catch (clubErr) {
        console.error(`Error processing club ${club.id}:`, clubErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        clubs_processed: clubsProcessed,
        emails_logged: emailsLogged,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("daily-digest error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
