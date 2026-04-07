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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getServiceClient();
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin
    const { data: profile } = await supabase
      .from("users")
      .select("role, club_id")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin" || !profile?.club_id) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clubId = profile.club_id;
    const { title, body, audience, audience_tier_id } = await req.json();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "Title and body required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build member query based on audience
    let memberQuery = supabase
      .from("memberships")
      .select("user_id, user:users!memberships_user_id_fkey(push_token)")
      .eq("club_id", clubId)
      .eq("is_active", true);

    if (audience === "tier" && audience_tier_id) {
      memberQuery = memberQuery.eq("tier_id", audience_tier_id);
    }

    const { data: members } = await memberQuery;

    let targetUserIds: string[] = (members ?? []).map((m) => m.user_id as string);

    // Filter by audience type
    if (audience === "no_show") {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: noShows } = await supabase
        .from("reservations")
        .select("user_id")
        .eq("club_id", clubId)
        .eq("status", "no_show")
        .gte("start_time", thirtyDaysAgo);

      const noShowIds = new Set((noShows ?? []).map((r) => r.user_id as string));
      targetUserIds = targetUserIds.filter((id) => noShowIds.has(id));
    } else if (audience === "lapsed") {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentBookers } = await supabase
        .from("reservations")
        .select("user_id")
        .eq("club_id", clubId)
        .eq("status", "confirmed")
        .gte("created_at", fourteenDaysAgo);

      const activeIds = new Set((recentBookers ?? []).map((r) => r.user_id as string));
      targetUserIds = targetUserIds.filter((id) => !activeIds.has(id));
    }

    // Send notifications
    let sentCount = 0;
    const pushTokenMap = new Map<string, string>();
    for (const m of members ?? []) {
      const u = m.user as { push_token: string | null } | null;
      if (u?.push_token) pushTokenMap.set(m.user_id as string, u.push_token);
    }

    for (const userId of targetUserIds) {
      // Create notification record
      await supabase.from("notifications").insert({
        user_id: userId,
        club_id: clubId,
        title,
        body,
        type: "push_campaign",
        read: false,
      });

      // Send push if token available
      const pushToken = pushTokenMap.get(userId);
      if (pushToken) {
        await sendExpoPush({
          to: pushToken,
          title,
          body,
          data: { type: "push_campaign", club_id: clubId },
        });
      }

      sentCount++;
    }

    // Save campaign record
    await supabase.from("push_campaigns").insert({
      club_id: clubId,
      title,
      body,
      audience: audience || "all",
      audience_tier_id: audience_tier_id || null,
      sent_count: sentCount,
      sent_at: new Date().toISOString(),
      created_by: user.id,
    });

    return new Response(
      JSON.stringify({ sent: sentCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error sending campaign:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
