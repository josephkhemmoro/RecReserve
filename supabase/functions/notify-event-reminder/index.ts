import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendExpoPush } from "../_shared/push.ts";

serve(async (_req) => {
  try {
    const supabase = getServiceClient();

    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find events starting in the next 24 hours
    const { data: events, error } = await supabase
      .from("events")
      .select("id, title, start_time, club_id")
      .gte("start_time", now.toISOString())
      .lte("start_time", twentyFourHoursFromNow.toISOString());

    if (error) throw error;

    let sent = 0;

    for (const event of events ?? []) {
      // Get registered users for this event
      const { data: registrations } = await supabase
        .from("event_registrations")
        .select("user_id")
        .eq("event_id", event.id)
        .eq("status", "registered");

      for (const reg of registrations ?? []) {
        const { data: user } = await supabase
          .from("users")
          .select("push_token")
          .eq("id", reg.user_id)
          .single();

        // Fetch club name
        const { data: club } = await supabase
          .from("clubs")
          .select("name")
          .eq("id", event.club_id)
          .single();
        const clubName = club?.name ?? "";

        const title = clubName ? `${clubName} - ${event.title} is tomorrow` : `Reminder: ${event.title} is tomorrow`;
        const startDate = new Date(event.start_time);
        const timeStr = startDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        const body = `Starts at ${timeStr}`;

        // Check if we already sent a reminder for this event+user
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", reg.user_id)
          .eq("type", "event_reminder")
          .ilike("title", `%${event.title}%`)
          .limit(1);

        if (existing && existing.length > 0) continue;

        await supabase.from("notifications").insert({
          user_id: reg.user_id,
          title,
          body,
          type: "event_reminder",
          read: false,
        });

        if (user?.push_token) {
          await sendExpoPush({
            to: user.push_token,
            title,
            body,
            data: {
              type: "event_reminder",
              event_id: event.id,
            },
          });
        }

        sent++;
      }
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
