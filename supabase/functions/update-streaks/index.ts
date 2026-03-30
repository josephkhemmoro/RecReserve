import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MILESTONES = [4, 8, 12, 26, 52];

const MILESTONE_LABELS: Record<number, string> = {
  4: "1 Month Strong",
  8: "2 Month Warrior",
  12: "Quarter Master",
  26: "Half-Year Hero",
  52: "Year-Round Legend",
};

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().split("T")[0];
}

interface PlayerStreakRow {
  id: string;
  user_id: string;
  club_id: string;
  current_streak: number;
  longest_streak: number;
  last_play_week: string | null;
  streak_frozen_until: string | null;
  freezes_remaining: number;
  freezes_reset_at: string | null;
  updated_at: string;
}

interface Summary {
  processed: number;
  streaks_incremented: number;
  streaks_reset: number;
  milestones_achieved: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const now = new Date();
    const currentMonday = getMondayOfWeek(now);
    const currentMondayStr = formatDateOnly(currentMonday);

    // Determine mode: single user or cron batch
    let body: { user_id?: string; club_id?: string } = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body = cron mode
    }

    const isSingleUser = Boolean(body.user_id && body.club_id);

    if (isSingleUser) {
      const result = await processSingleUser(
        supabase,
        body.user_id!,
        body.club_id!,
        now,
        currentMonday,
        currentMondayStr
      );
      return new Response(
        JSON.stringify({ success: true, mode: "single_user", summary: result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const result = await processCronBatch(supabase, now, currentMonday, currentMondayStr);
      return new Response(
        JSON.stringify({ success: true, mode: "cron", summary: result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("update-streaks error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processSingleUser(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  clubId: string,
  now: Date,
  currentMonday: Date,
  currentMondayStr: string
): Promise<Summary> {
  const summary: Summary = {
    processed: 1,
    streaks_incremented: 0,
    streaks_reset: 0,
    milestones_achieved: 0,
  };

  // Check if user played this week
  const { data: playedRows, error: playedError } = await supabase
    .from("reservations")
    .select("id")
    .eq("user_id", userId)
    .eq("club_id", clubId)
    .in("status", ["completed", "confirmed"])
    .lt("end_time", now.toISOString())
    .gte("end_time", currentMonday.toISOString())
    .limit(1);

  if (playedError) throw playedError;

  const playedThisWeek = (playedRows ?? []).length > 0;

  if (!playedThisWeek) {
    console.log(`User ${userId} has not played this week yet, skipping`);
    return summary;
  }

  // Fetch existing streak record
  const { data: existing, error: fetchError } = await supabase
    .from("player_streaks")
    .select("*")
    .eq("user_id", userId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  let newStreak: number;
  let newLongest: number;

  if (!existing) {
    // First streak record for this user+club
    newStreak = 1;
    newLongest = 1;

    const { error: insertError } = await supabase
      .from("player_streaks")
      .insert({
        user_id: userId,
        club_id: clubId,
        current_streak: newStreak,
        longest_streak: newLongest,
        last_play_week: currentMondayStr,
        freezes_remaining: 2,
        freezes_reset_at: now.toISOString(),
        updated_at: now.toISOString(),
      });

    if (insertError) throw insertError;

    summary.streaks_incremented = 1;
    console.log(`Created new streak for user ${userId} in club ${clubId}`);
  } else {
    const record = existing as PlayerStreakRow;

    // Already counted this week
    if (record.last_play_week === currentMondayStr) {
      console.log(`User ${userId} already counted for week ${currentMondayStr}`);
      return summary;
    }

    const previousMonday = new Date(currentMonday);
    previousMonday.setUTCDate(previousMonday.getUTCDate() - 7);
    const previousMondayStr = formatDateOnly(previousMonday);

    if (record.last_play_week === previousMondayStr) {
      // Consecutive week — increment streak
      newStreak = record.current_streak + 1;
    } else {
      // Gap detected — check freeze
      const isFrozen =
        record.streak_frozen_until !== null &&
        record.streak_frozen_until >= currentMondayStr;

      if (isFrozen) {
        console.log(`User ${userId} streak frozen, incrementing despite gap`);
        newStreak = record.current_streak + 1;
      } else {
        console.log(`User ${userId} streak broken, resetting to 1`);
        newStreak = 1;
        summary.streaks_reset = 1;
      }
    }

    newLongest = Math.max(newStreak, record.longest_streak);

    // Monthly freeze reset
    let freezesRemaining = record.freezes_remaining;
    let freezesResetAt = record.freezes_reset_at;
    const shouldResetFreezes =
      !record.freezes_reset_at ||
      now.getTime() - new Date(record.freezes_reset_at).getTime() > 30 * 24 * 60 * 60 * 1000;

    if (shouldResetFreezes) {
      freezesRemaining = 2;
      freezesResetAt = now.toISOString();
      console.log(`Reset monthly freezes for user ${userId}`);
    }

    const { error: updateError } = await supabase
      .from("player_streaks")
      .update({
        current_streak: newStreak,
        longest_streak: newLongest,
        last_play_week: currentMondayStr,
        freezes_remaining: freezesRemaining,
        freezes_reset_at: freezesResetAt,
        updated_at: now.toISOString(),
      })
      .eq("id", record.id);

    if (updateError) throw updateError;

    if (newStreak > record.current_streak) {
      summary.streaks_incremented = 1;
    }
  }

  // Check milestones
  for (const milestone of MILESTONES) {
    if (newStreak === milestone) {
      const { data: inserted, error: milestoneError } = await supabase
        .from("streak_milestones")
        .upsert(
          { user_id: userId, club_id: clubId, milestone, achieved_at: now.toISOString() },
          { onConflict: "user_id,club_id,milestone", ignoreDuplicates: true }
        )
        .select("id");

      if (milestoneError) {
        console.error(`Milestone insert error for ${milestone}:`, milestoneError);
        continue;
      }

      // If we got a row back, it was newly inserted
      if (inserted && inserted.length > 0) {
        const label = MILESTONE_LABELS[milestone] ?? `${milestone}-week streak`;
        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            club_id: clubId,
            title: "🔥 Streak Milestone!",
            body: `You hit a ${milestone}-week streak! You are now a ${label}!`,
            type: "streak_milestone",
            read: false,
          });

        if (notifError) {
          console.error("Notification insert error:", notifError);
        } else {
          summary.milestones_achieved++;
          console.log(`User ${userId} achieved ${milestone}-week milestone`);
        }

        // Insert feed event for streak milestone
        const { error: feedError } = await supabase
          .from("feed_events")
          .insert({
            club_id: clubId,
            actor_id: userId,
            event_type: "streak_milestone",
            metadata: {
              milestone,
              milestone_label: label,
            },
          });

        if (feedError) {
          console.error("Feed event insert error:", feedError);
        }
      }
    }
  }

  return summary;
}

async function processCronBatch(
  supabase: ReturnType<typeof getServiceClient>,
  now: Date,
  currentMonday: Date,
  currentMondayStr: string
): Promise<Summary> {
  const summary: Summary = {
    processed: 0,
    streaks_incremented: 0,
    streaks_reset: 0,
    milestones_achieved: 0,
  };

  const previousMonday = new Date(currentMonday);
  previousMonday.setUTCDate(previousMonday.getUTCDate() - 7);
  const previousMondayStr = formatDateOnly(previousMonday);

  // Fetch all active streaks
  const { data: streaks, error: fetchError } = await supabase
    .from("player_streaks")
    .select("*")
    .gt("current_streak", 0);

  if (fetchError) throw fetchError;

  if (!streaks || streaks.length === 0) {
    console.log("No active streaks to process");
    return summary;
  }

  console.log(`Processing ${streaks.length} active streaks`);

  for (const record of streaks as PlayerStreakRow[]) {
    summary.processed++;

    // Already processed this week
    if (record.last_play_week && record.last_play_week >= currentMondayStr) {
      console.log(`User ${record.user_id} already processed for this week`);
      continue;
    }

    let shouldReset = false;

    if (record.last_play_week === previousMondayStr) {
      // Last played the previous week — check if they actually played
      const { data: playedRows, error: playedError } = await supabase
        .from("reservations")
        .select("id")
        .eq("user_id", record.user_id)
        .eq("club_id", record.club_id)
        .in("status", ["completed", "confirmed"])
        .gte("end_time", previousMonday.toISOString())
        .lt("end_time", currentMonday.toISOString())
        .limit(1);

      if (playedError) {
        console.error(`Error checking reservations for user ${record.user_id}:`, playedError);
        continue;
      }

      const playedLastWeek = (playedRows ?? []).length > 0;

      if (playedLastWeek) {
        // Safety net — single-user mode should have caught this
        console.log(`User ${record.user_id} played last week (safety net), skipping reset`);
        continue;
      }

      // Did not play — check freeze
      const isFrozen =
        record.streak_frozen_until !== null &&
        record.streak_frozen_until >= currentMondayStr;

      if (isFrozen) {
        // Streak protected by freeze, decrement freezes
        const newFreezes = Math.max(0, record.freezes_remaining - 1);
        const { error: freezeError } = await supabase
          .from("player_streaks")
          .update({
            freezes_remaining: newFreezes,
            updated_at: now.toISOString(),
          })
          .eq("id", record.id);

        if (freezeError) {
          console.error(`Error updating freeze for user ${record.user_id}:`, freezeError);
        } else {
          console.log(`User ${record.user_id} streak frozen, decremented freezes to ${newFreezes}`);
          summary.streaks_incremented++;
        }
        continue;
      }

      shouldReset = true;
    } else if (record.last_play_week && record.last_play_week < previousMondayStr) {
      // Streak was already broken in a prior week
      shouldReset = true;
    }

    if (shouldReset) {
      // Monthly freeze reset check
      let freezesRemaining = record.freezes_remaining;
      let freezesResetAt = record.freezes_reset_at;
      const shouldResetFreezes =
        !record.freezes_reset_at ||
        now.getTime() - new Date(record.freezes_reset_at).getTime() > 30 * 24 * 60 * 60 * 1000;

      if (shouldResetFreezes) {
        freezesRemaining = 2;
        freezesResetAt = now.toISOString();
      }

      const { error: resetError } = await supabase
        .from("player_streaks")
        .update({
          current_streak: 0,
          freezes_remaining: freezesRemaining,
          freezes_reset_at: freezesResetAt,
          updated_at: now.toISOString(),
        })
        .eq("id", record.id);

      if (resetError) {
        console.error(`Error resetting streak for user ${record.user_id}:`, resetError);
      } else {
        summary.streaks_reset++;
        console.log(`Reset streak for user ${record.user_id}`);
      }
    }
  }

  console.log("Cron batch summary:", JSON.stringify(summary));
  return summary;
}
