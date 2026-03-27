import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendExpoPush } from "../_shared/push.ts";

serve(async (req) => {
  try {
    const { user_id, reservation_id } = await req.json();

    if (!user_id || !reservation_id) {
      return new Response(
        JSON.stringify({ error: "user_id and reservation_id required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = getServiceClient();

    const { data: reservation } = await supabase
      .from("reservations")
      .select("start_time, end_time, court:courts(name)")
      .eq("id", reservation_id)
      .single();

    const { data: user } = await supabase
      .from("users")
      .select("push_token")
      .eq("id", user_id)
      .single();

    const startDate = new Date(reservation?.start_time);
    const dateStr = startDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const timeStr = startDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    const courtName = reservation?.court?.name ?? "Court";
    const title = "Good news! A slot opened up 🎉";
    const body = `${courtName} on ${dateStr} at ${timeStr} is now yours`;

    await supabase.from("notifications").insert({
      user_id,
      title,
      body,
      type: "waitlist_promotion",
      read: false,
    });

    if (user?.push_token) {
      await sendExpoPush({
        to: user.push_token,
        title,
        body,
        data: {
          type: "waitlist_promotion",
          reservation_id,
        },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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
