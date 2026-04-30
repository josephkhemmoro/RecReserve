import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";

const PLATFORM_FEE_PERCENT = Number(Deno.env.get("PLATFORM_FEE_PERCENT") || "5");

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabase = getServiceClient();
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      amount: rawAmount,
      court_id,
      user_id,
      club_id,
      date,
      start_time,
      end_time,
      reward_id,
    } = await req.json();

    if (!rawAmount || rawAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Valid amount is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Optional reward handling ---
    // Defensive: if reward_id is not provided, null, or empty string, behave exactly as before.
    let amount: number = Number(rawAmount);
    let rewardApplied = false;
    let rewardSkipped = false;
    let appliedRewardId: string | null = null;

    if (reward_id && typeof reward_id === "string" && reward_id.trim().length > 0) {
      const { data: reward, error: rewardError } = await supabase
        .from("player_rewards")
        .select("id, user_id, reward_type, reward_value, redeemed_at, expires_at")
        .eq("id", reward_id)
        .maybeSingle();

      if (rewardError || !reward) {
        return new Response(
          JSON.stringify({ error: "Reward is not available" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership — must belong to the authenticated user
      if (reward.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Reward is not available" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify unredeemed
      if (reward.redeemed_at) {
        return new Response(
          JSON.stringify({ error: "Reward is not available" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify not expired
      if (reward.expires_at && new Date(reward.expires_at).getTime() <= Date.now()) {
        return new Response(
          JSON.stringify({ error: "Reward is not available" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (reward.reward_type === "discount_percent") {
        const pct = Math.max(0, Math.min(100, Number(reward.reward_value) || 0));
        amount = Math.floor((Number(rawAmount) * (100 - pct)) / 100);
        rewardApplied = true;
        appliedRewardId = reward.id;

        // Free via 100% discount → short-circuit, skip creating a payment intent
        if (amount <= 0) {
          return new Response(
            JSON.stringify({
              clientSecret: null,
              paymentIntentId: null,
              reward_applied: true,
              discounted_amount: 0,
              final_amount: 0,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else if (reward.reward_type === "free_booking") {
        // Skip the PaymentSheet step entirely — client should create the reservation with no payment.
        return new Response(
          JSON.stringify({
            clientSecret: null,
            paymentIntentId: null,
            reward_applied: true,
            final_amount: 0,
            discounted_amount: 0,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (reward.reward_type === "bonus_credit") {
        // Not applied here — handled client-side differently.
        rewardSkipped = true;
      }
    }

    // Create Stripe payment intent via REST API directly (no SDK needed)
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;

    // Check club Connect status
    const { data: club } = await supabase
      .from("clubs")
      .select("stripe_account_id, stripe_onboarding_complete")
      .eq("id", club_id)
      .single();

    const formParams = new URLSearchParams();
    formParams.append("amount", String(amount));
    formParams.append("currency", "usd");
    formParams.append("automatic_payment_methods[enabled]", "true");
    formParams.append("metadata[court_id]", court_id ?? "");
    formParams.append("metadata[user_id]", user_id ?? "");
    formParams.append("metadata[club_id]", club_id ?? "");
    formParams.append("metadata[date]", date ?? "");
    formParams.append("metadata[start_time]", start_time ?? "");
    formParams.append("metadata[end_time]", end_time ?? "");
    formParams.append("metadata[entity_type]", "reservation");
    if (appliedRewardId) {
      formParams.append("metadata[reward_id]", appliedRewardId);
    }

    if (club?.stripe_account_id && club?.stripe_onboarding_complete) {
      const applicationFee = Math.round(amount * (PLATFORM_FEE_PERCENT / 100));
      formParams.append("application_fee_amount", String(applicationFee));
      formParams.append("transfer_data[destination]", club.stripe_account_id);
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formParams.toString(),
    });

    const stripeData = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error("Stripe API error:", JSON.stringify(stripeData));
      return new Response(
        JSON.stringify({ error: stripeData.error?.message || "Stripe payment failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        clientSecret: stripeData.client_secret,
        paymentIntentId: stripeData.id,
        reward_applied: rewardApplied,
        reward_skipped: rewardSkipped,
        discounted_amount: amount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error creating payment intent:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
