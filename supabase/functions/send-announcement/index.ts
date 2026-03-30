import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendExpoPush } from "../_shared/push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the calling user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service client for all operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user with the service client (bypasses RLS for token validation)
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", detail: authError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is admin
    const { data: profile } = await supabase
      .from("users")
      .select("role, club_id")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin" || !profile?.club_id) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { title, message, audience, tier_id, send_push, send_in_app } =
      await req.json();

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: "title and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clubId = profile.club_id as string;

    // Get club name for push notifications
    const { data: clubData } = await supabase
      .from("clubs")
      .select("name")
      .eq("id", clubId)
      .single();
    const clubName = clubData?.name || "";
    const pushTitle = clubName ? `${clubName}: ${title}` : title;

    // Build query to get target members
    let query = supabase
      .from("users")
      .select("id, push_token")
      .eq("club_id", clubId);

    // If targeting a specific tier, join through memberships
    let targetUserIds: string[] = [];

    if (audience === "tier" && tier_id) {
      const { data: memberships } = await supabase
        .from("memberships")
        .select("user_id")
        .eq("club_id", clubId)
        .eq("tier_id", tier_id)
        .eq("is_active", true);

      targetUserIds = (memberships ?? []).map(
        (m: { user_id: string }) => m.user_id
      );

      if (targetUserIds.length === 0) {
        return new Response(
          JSON.stringify({ success: true, recipients: 0, push_sent: 0, push_failed: 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      query = query.in("id", targetUserIds);
    }

    const { data: users, error: usersError } = await query;
    if (usersError) throw usersError;

    const recipients = users ?? [];
    let pushSent = 0;
    let pushFailed = 0;

    // Store master announcement record
    const { error: annError } = await supabase
      .from("club_announcements")
      .insert({
        club_id: clubId,
        title,
        body: message,
        audience: audience === "tier" && tier_id ? tier_id : "all",
        created_by: user.id,
      });

    if (annError) {
      console.error("Error inserting club announcement:", annError);
    }

    // In-app notifications — batch insert
    if (send_in_app && recipients.length > 0) {
      const rows = recipients.map((u: { id: string }) => ({
        user_id: u.id,
        club_id: clubId,
        title,
        body: message,
        type: "announcement",
        read: false,
      }));

      const { error: insertError } = await supabase
        .from("notifications")
        .insert(rows);

      if (insertError) {
        console.error("Error inserting notifications:", insertError);
      }
    }

    // Push notifications
    if (send_push) {
      const tokens = recipients
        .filter((u: { id: string; push_token: string | null }) => u.push_token)
        .map((u: { id: string; push_token: string | null }) => u.push_token!);

      // Send in batches of 100 (Expo API recommendation)
      for (let i = 0; i < tokens.length; i += 100) {
        const batch = tokens.slice(i, i + 100);
        const results = await Promise.allSettled(
          batch.map((token: string) =>
            sendExpoPush({
              to: token,
              title: pushTitle,
              body: message,
              data: { type: "announcement" },
            })
          )
        );

        for (const result of results) {
          if (result.status === "fulfilled" && result.value) {
            pushSent++;
          } else {
            pushFailed++;
            if (result.status === "rejected") {
              console.error("Push failed:", result.reason);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        recipients: recipients.length,
        push_sent: pushSent,
        push_failed: pushFailed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
