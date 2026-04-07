import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendExpoPush } from "../_shared/push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    let totalSent = 0;
    const todayStr = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // 1. "One more player needed" — open games needing exactly 1 more
    const { data: openGames } = await supabase
      .from("open_games")
      .select("id, club_id, sport, skill_level, format, date, start_time, creator_id, max_players, title")
      .eq("status", "open").gte("date", todayStr).lte("date", tomorrowStr);

    for (const game of openGames ?? []) {
      const { count: joinedCount } = await supabase
        .from("game_participants").select("id", { count: "exact", head: true })
        .eq("game_id", game.id).eq("status", "joined");
      const spotsLeft = game.max_players - ((joinedCount ?? 0) + 1);
      if (spotsLeft !== 1) continue;

      const { data: profiles } = await supabase
        .from("player_profiles").select("user_id")
        .contains("sports", [game.sport]).eq("looking_for_game", true);

      for (const profile of profiles ?? []) {
        if (profile.user_id === game.creator_id) continue;
        const { data: membership } = await supabase
          .from("memberships").select("id")
          .eq("user_id", profile.user_id).eq("club_id", game.club_id).eq("is_active", true).limit(1);
        if (!membership || membership.length === 0) continue;
        const { data: existing } = await supabase
          .from("game_participants").select("id")
          .eq("game_id", game.id).eq("user_id", profile.user_id).limit(1);
        if (existing && existing.length > 0) continue;

        const { data: user } = await supabase.from("users").select("push_token").eq("id", profile.user_id).single();
        const label = game.title || `${game.format} ${game.sport}`;
        await supabase.from("notifications").insert({
          user_id: profile.user_id, club_id: game.club_id,
          title: "One spot left!", body: `A ${label} game needs one more player on ${game.date}. Jump in!`,
          type: "game_invite", read: false,
        });
        if (user?.push_token) {
          await sendExpoPush({ to: user.push_token, title: "One spot left!", body: `A ${label} game needs one more. Join now!`, data: { type: "game_invite", game_id: game.id } });
        }
        totalSent++;
      }
    }

    // 2. "Your usual time is coming up" — pattern-based reminders
    const targetDay = tomorrow.getDay();
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();
    const { data: recentRes } = await supabase
      .from("reservations").select("user_id, club_id")
      .eq("status", "confirmed").gte("start_time", sixtyDaysAgo);

    const userPatterns = new Map<string, { count: number; club_id: string }>();
    for (const r of recentRes ?? []) {
      const key = r.user_id as string;
      const existing = userPatterns.get(key);
      if (existing) existing.count++; else userPatterns.set(key, { count: 1, club_id: r.club_id as string });
    }

    for (const [userId, pattern] of userPatterns) {
      if (pattern.count < 3) continue;
      const { data: existingBooking } = await supabase
        .from("reservations").select("id").eq("user_id", userId).eq("status", "confirmed")
        .gte("start_time", tomorrowStr + "T00:00:00").lte("start_time", tomorrowStr + "T23:59:59").limit(1);
      if (existingBooking && existingBooking.length > 0) continue;

      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: recentNotif } = await supabase
        .from("notifications").select("id").eq("user_id", userId).eq("type", "lapsed_reminder").gte("created_at", weekAgo).limit(1);
      if (recentNotif && recentNotif.length > 0) continue;

      const { data: user } = await supabase.from("users").select("push_token").eq("id", userId).single();
      const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][targetDay];
      await supabase.from("notifications").insert({
        user_id: userId, club_id: pattern.club_id,
        title: `${dayName} is your day!`, body: `You usually play on ${dayName}s. Book your court for tomorrow!`,
        type: "lapsed_reminder", read: false,
      });
      if (user?.push_token) {
        await sendExpoPush({ to: user.push_token, title: `${dayName} is your day!`, body: `Book a court for tomorrow!`, data: { type: "booking_reminder" } });
      }
      totalSent++;
    }

    // 3. "Open play tonight/tomorrow"
    const { data: openPlayEvents } = await supabase
      .from("events").select("id, club_id, title, start_time")
      .eq("event_type", "open_play").gte("start_time", todayStr + "T00:00:00").lte("start_time", tomorrowStr + "T23:59:59");

    for (const event of openPlayEvents ?? []) {
      const { data: members } = await supabase
        .from("memberships").select("user_id, user:users!memberships_user_id_fkey(push_token)")
        .eq("club_id", event.club_id).eq("is_active", true);
      const { data: registrants } = await supabase
        .from("event_registrations").select("user_id").eq("event_id", event.id).eq("status", "registered");
      const registeredIds = new Set((registrants ?? []).map((r) => r.user_id as string));
      const isToday = (event.start_time as string).startsWith(todayStr);
      const timeLabel = isToday ? "tonight" : "tomorrow";

      for (const member of (members ?? []).slice(0, 50)) { // cap at 50 per event
        if (registeredIds.has(member.user_id as string)) continue;
        const pushToken = (member.user as { push_token: string | null } | null)?.push_token;
        await supabase.from("notifications").insert({
          user_id: member.user_id, club_id: event.club_id,
          title: `Open play ${timeLabel}!`, body: `${event.title || "Open Play"} is happening ${timeLabel}. Drop in!`,
          type: "event_reminder", read: false,
        });
        if (pushToken) {
          await sendExpoPush({ to: pushToken, title: `Open play ${timeLabel}!`, body: `Drop in and play!`, data: { type: "event_reminder", event_id: event.id } });
        }
        totalSent++;
      }
    }

    return new Response(JSON.stringify({ sent: totalSent }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
