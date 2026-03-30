import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendExpoPush } from "../_shared/push.ts";

serve(async (_req) => {
  try {
    const supabase = getServiceClient();

    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Find reservations starting in the next 60 minutes that haven't been reminded
    const { data: reservations, error } = await supabase
      .from("reservations")
      .select("id, user_id, club_id, start_time, end_time, court:courts(name)")
      .eq("status", "confirmed")
      .eq("reminder_sent", false)
      .gte("start_time", now.toISOString())
      .lte("start_time", oneHourFromNow.toISOString());

    if (error) throw error;

    let sent = 0;

    for (const reservation of reservations ?? []) {
      const { data: user } = await supabase
        .from("users")
        .select("push_token")
        .eq("id", reservation.user_id)
        .single();

      const startTime = new Date(reservation.start_time);
      const timeStr = startTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

      // Fetch club name
      const { data: club } = await supabase
        .from("clubs")
        .select("name")
        .eq("id", reservation.club_id)
        .single();
      const clubName = club?.name ?? "";

      const courtName = reservation.court?.name ?? "Court";
      const title = "Your court is in 1 hour";
      const pushTitle = clubName ? `${clubName}: ${title}` : title;
      const body = `${courtName} at ${timeStr}`;

      // Write notification
      await supabase.from("notifications").insert({
        user_id: reservation.user_id,
        club_id: reservation.club_id,
        title,
        body,
        type: "booking_reminder",
        read: false,
      });

      // Send push
      if (user?.push_token) {
        await sendExpoPush({
          to: user.push_token,
          title: pushTitle,
          body,
          data: {
            type: "booking_reminder",
            reservation_id: reservation.id,
          },
        });
      }

      // Mark as reminded
      await supabase
        .from("reservations")
        .update({ reminder_sent: true })
        .eq("id", reservation.id);

      sent++;
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
