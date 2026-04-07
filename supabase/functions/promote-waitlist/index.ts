import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendExpoPush } from "../_shared/push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const { reservation_id, court_id, club_id, start_time, end_time } = await req.json();

    if (!reservation_id || !court_id) {
      return new Response(
        JSON.stringify({ error: "reservation_id and court_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the next person on the waitlist for this court/time
    const { data: waitlistEntries, error: wlError } = await supabase
      .from("waitlist")
      .select("*")
      .eq("court_id", court_id)
      .lte("desired_start", start_time)
      .gte("desired_end", end_time)
      .is("notified_at", null)
      .order("position", { ascending: true })
      .limit(1);

    if (wlError) {
      console.error("Waitlist query error:", wlError);
      return new Response(
        JSON.stringify({ promoted: false, reason: "query_error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!waitlistEntries || waitlistEntries.length === 0) {
      return new Response(
        JSON.stringify({ promoted: false, reason: "no_waitlist" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const entry = waitlistEntries[0];

    // Mark as notified
    await supabase
      .from("waitlist")
      .update({ notified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() })
      .eq("id", entry.id);

    // Get user push token
    const { data: user } = await supabase
      .from("users")
      .select("push_token, full_name")
      .eq("id", entry.user_id)
      .single();

    // Get court name
    const { data: court } = await supabase
      .from("courts")
      .select("name")
      .eq("id", court_id)
      .single();

    // Create notification
    await supabase.from("notifications").insert({
      user_id: entry.user_id,
      club_id: club_id,
      title: "A spot opened up!",
      body: `A court time on ${court?.name || "your waitlisted court"} is now available. You have 30 minutes to book.`,
      type: "waitlist_promotion",
      read: false,
    });

    // Send push
    if (user?.push_token) {
      await sendExpoPush({
        to: user.push_token,
        title: "A spot opened up!",
        body: `${court?.name || "A court"} is now available. Book within 30 minutes!`,
        data: { type: "waitlist_promotion", court_id, reservation_id },
      });
    }

    return new Response(
      JSON.stringify({ promoted: true, user_id: entry.user_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error promoting waitlist:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
