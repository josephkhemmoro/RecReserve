import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendExpoPush } from "../_shared/push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LAPSE_DAYS = 14;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const cutoffDate = new Date(Date.now() - LAPSE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Find active members with push tokens who haven't booked recently
    const { data: activeMembers } = await supabase
      .from("memberships")
      .select("user_id, club_id, user:users!memberships_user_id_fkey(push_token, full_name)")
      .eq("is_active", true);

    if (!activeMembers || activeMembers.length === 0) {
      return new Response(
        JSON.stringify({ nudged: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let nudgedCount = 0;

    for (const member of activeMembers) {
      const user = member.user as { push_token: string | null; full_name: string } | null;
      if (!user?.push_token) continue;

      // Check if they have any recent reservation
      const { data: recentBooking } = await supabase
        .from("reservations")
        .select("id")
        .eq("user_id", member.user_id)
        .eq("club_id", member.club_id)
        .gte("created_at", cutoffDate)
        .limit(1);

      if (recentBooking && recentBooking.length > 0) continue;

      // Check we haven't already nudged them recently (last 7 days)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentNudge } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", member.user_id)
        .eq("type", "lapsed_reminder")
        .gte("created_at", weekAgo)
        .limit(1);

      if (recentNudge && recentNudge.length > 0) continue;

      // Get club name
      const { data: club } = await supabase
        .from("clubs")
        .select("name")
        .eq("id", member.club_id)
        .single();

      // Send nudge
      await supabase.from("notifications").insert({
        user_id: member.user_id,
        club_id: member.club_id,
        title: "We miss you!",
        body: `It's been a while since your last game at ${club?.name || "your club"}. Book a court and get back in the game!`,
        type: "lapsed_reminder",
        read: false,
      });

      await sendExpoPush({
        to: user.push_token,
        title: "We miss you!",
        body: `Book a court at ${club?.name || "your club"} — your streak is waiting!`,
        data: { type: "lapsed_reminder", club_id: member.club_id },
      });

      nudgedCount++;
    }

    return new Response(
      JSON.stringify({ nudged: nudgedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error nudging lapsed players:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
