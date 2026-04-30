import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const errorResponse = (message: string) =>
  jsonResponse({ error: message }, 200);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Missing authorization header");
    }

    const supabase = getServiceClient();
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } =
      await supabase.auth.getUser(token);
    if (authError || !user) {
      return errorResponse("Unauthorized");
    }

    const { membership_id } = await req.json();
    if (!membership_id) {
      return errorResponse("membership_id is required");
    }

    // Fetch membership
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select(
        "id, user_id, club_id, tier_id, stripe_subscription_id, current_period_end, cancel_at_period_end"
      )
      .eq("id", membership_id)
      .single();

    if (membershipError || !membership) {
      return errorResponse("Membership not found");
    }

    if (membership.user_id !== user.id) {
      return errorResponse("You do not own this membership");
    }

    // Look up the club's default free tier
    const { data: defaultTier, error: defaultTierError } = await supabase
      .from("membership_tiers")
      .select("id, name")
      .eq("club_id", membership.club_id)
      .eq("is_default", true)
      .maybeSingle();

    if (defaultTierError) {
      console.error("Failed to find default tier:", defaultTierError);
      return errorResponse("Failed to find default tier");
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const stripeHeaders = {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    // If no Stripe subscription, drop straight to the default free tier.
    if (!membership.stripe_subscription_id) {
      const update: Record<string, unknown> = {
        status: "active",
        is_active: true,
        cancel_at_period_end: false,
        pending_tier_id: null,
        stripe_subscription_id: null,
      };
      if (defaultTier?.id) {
        update.tier_id = defaultTier.id;
      }

      const { error: updErr } = await supabase
        .from("memberships")
        .update(update)
        .eq("id", membership.id);

      if (updErr) {
        console.error("Failed to update membership:", updErr);
        return errorResponse(`Failed to update membership: ${updErr.message}`);
      }

      return jsonResponse({
        effective_until: null,
        pending_tier: defaultTier
          ? { id: defaultTier.id, name: defaultTier.name }
          : null,
      });
    }

    // Mark Stripe subscription to cancel at period end
    const cancelParams = new URLSearchParams();
    cancelParams.append("cancel_at_period_end", "true");

    const cancelRes = await fetch(
      `https://api.stripe.com/v1/subscriptions/${membership.stripe_subscription_id}`,
      {
        method: "POST",
        headers: stripeHeaders,
        body: cancelParams.toString(),
      }
    );
    const cancelData = await cancelRes.json();

    if (!cancelRes.ok) {
      console.error(
        "Failed to schedule subscription cancel:",
        JSON.stringify(cancelData)
      );
      return errorResponse(
        cancelData.error?.message || "Failed to cancel subscription"
      );
    }

    // Update membership locally: keep current paid tier, flag cancel_at_period_end,
    // and remember which tier to drop to when the period ends.
    const periodEndIso =
      typeof cancelData.current_period_end === "number"
        ? new Date(cancelData.current_period_end * 1000).toISOString()
        : membership.current_period_end ?? null;

    const { error: updErr } = await supabase
      .from("memberships")
      .update({
        cancel_at_period_end: true,
        current_period_end: periodEndIso,
        pending_tier_id: defaultTier?.id ?? null,
      })
      .eq("id", membership.id);

    if (updErr) {
      console.error("Failed to update membership:", updErr);
      return errorResponse(`Failed to update membership: ${updErr.message}`);
    }

    return jsonResponse({
      effective_until: periodEndIso,
      pending_tier: defaultTier
        ? { id: defaultTier.id, name: defaultTier.name }
        : null,
    });
  } catch (err) {
    console.error("Error in cancel-tier-subscription:", err);
    return errorResponse((err as Error).message ?? "Internal server error");
  }
});
