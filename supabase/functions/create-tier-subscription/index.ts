import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";

const PLATFORM_FEE_PERCENT = Number(
  Deno.env.get("PLATFORM_FEE_PERCENT") || "5"
);

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

    const { user_id, club_id, tier_id } = await req.json();
    if (!user_id || !club_id || !tier_id) {
      return errorResponse("user_id, club_id, and tier_id are required");
    }

    if (user.id !== user_id) {
      return errorResponse("user_id does not match authenticated user");
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const stripeHeaders = {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    // Fetch user row for email
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, email")
      .eq("id", user_id)
      .single();

    if (userError || !userRow) {
      return errorResponse("User profile not found");
    }

    const email = (userRow as { email?: string }).email ?? user.email ?? null;
    if (!email) {
      return errorResponse("User has no email on file");
    }

    // Fetch tier
    const { data: tier, error: tierError } = await supabase
      .from("membership_tiers")
      .select("id, club_id, is_paid, stripe_price_id, monthly_price_cents")
      .eq("id", tier_id)
      .single();

    if (tierError || !tier) {
      return errorResponse("Tier not found");
    }

    if (tier.club_id !== club_id) {
      return errorResponse("Tier does not belong to this club");
    }

    if (!tier.is_paid) {
      return errorResponse("This tier is not a paid tier");
    }

    if (!tier.stripe_price_id) {
      return errorResponse(
        "Tier has no Stripe price yet. Ask the club admin to save the tier so we can provision billing."
      );
    }

    // Fetch club
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("id, stripe_account_id, stripe_onboarding_complete")
      .eq("id", club_id)
      .single();

    if (clubError || !club) {
      return errorResponse("Club not found");
    }

    if (!club.stripe_account_id || !club.stripe_onboarding_complete) {
      return errorResponse("Club has not completed payment setup");
    }

    // Look for existing customer id: first on the membership for (user, club),
    // then across any of this user's other memberships.
    const { data: existingMembership } = await supabase
      .from("memberships")
      .select(
        "id, user_id, club_id, stripe_customer_id, stripe_subscription_id, status"
      )
      .eq("user_id", user_id)
      .eq("club_id", club_id)
      .maybeSingle();

    let customerId: string | null =
      (existingMembership?.stripe_customer_id as string | null) ?? null;

    if (!customerId) {
      const { data: anyMembership } = await supabase
        .from("memberships")
        .select("stripe_customer_id")
        .eq("user_id", user_id)
        .not("stripe_customer_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (anyMembership?.stripe_customer_id) {
        customerId = anyMembership.stripe_customer_id as string;
      }
    }

    // If existing membership has an active subscription, cancel it immediately
    // before creating the replacement.
    const existingSubId =
      (existingMembership?.stripe_subscription_id as string | null) ?? null;

    if (existingSubId) {
      const cancelRes = await fetch(
        `https://api.stripe.com/v1/subscriptions/${existingSubId}`,
        { method: "DELETE", headers: stripeHeaders }
      );
      if (!cancelRes.ok) {
        const cancelData = await cancelRes.json().catch(() => ({}));
        console.error(
          "Failed to cancel existing subscription:",
          JSON.stringify(cancelData)
        );
        // If Stripe says the sub is already gone, we can continue.
        const code = cancelData?.error?.code;
        if (code !== "resource_missing") {
          return errorResponse(
            cancelData?.error?.message ||
              "Failed to cancel existing subscription"
          );
        }
      }
    }

    // Create customer if needed
    if (!customerId) {
      const customerParams = new URLSearchParams();
      customerParams.append("email", email);
      customerParams.append("metadata[user_id]", user_id);

      const customerRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: stripeHeaders,
        body: customerParams.toString(),
      });
      const customerData = await customerRes.json();

      if (!customerRes.ok) {
        console.error(
          "Failed to create Stripe customer:",
          JSON.stringify(customerData)
        );
        return errorResponse(
          customerData.error?.message || "Failed to create Stripe customer"
        );
      }
      customerId = customerData.id;
    }

    // Create the subscription
    const subParams = new URLSearchParams();
    subParams.append("customer", customerId!);
    subParams.append("items[0][price]", tier.stripe_price_id);
    subParams.append("payment_behavior", "default_incomplete");
    subParams.append("payment_settings[save_default_payment_method]", "on_subscription");
    subParams.append("expand[]", "latest_invoice.payment_intent");
    subParams.append("transfer_data[destination]", club.stripe_account_id);
    subParams.append(
      "application_fee_percent",
      String(PLATFORM_FEE_PERCENT)
    );
    subParams.append("metadata[user_id]", user_id);
    subParams.append("metadata[club_id]", club_id);
    subParams.append("metadata[tier_id]", tier_id);

    const subRes = await fetch("https://api.stripe.com/v1/subscriptions", {
      method: "POST",
      headers: stripeHeaders,
      body: subParams.toString(),
    });
    const subData = await subRes.json();

    if (!subRes.ok) {
      console.error("Failed to create subscription:", JSON.stringify(subData));
      return errorResponse(
        subData.error?.message || "Failed to create subscription"
      );
    }

    const subscriptionId: string = subData.id;
    const latestInvoice = subData.latest_invoice;
    const paymentIntent =
      latestInvoice && typeof latestInvoice === "object"
        ? latestInvoice.payment_intent
        : null;
    const clientSecret =
      paymentIntent && typeof paymentIntent === "object"
        ? paymentIntent.client_secret
        : null;

    const currentPeriodEnd =
      typeof subData.current_period_end === "number"
        ? new Date(subData.current_period_end * 1000).toISOString()
        : null;

    // Upsert membership row
    const today = new Date().toISOString().slice(0, 10);

    const membershipPayload: Record<string, unknown> = {
      user_id,
      club_id,
      tier_id,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      status: "trial",
      is_active: true,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: false,
      pending_tier_id: null,
    };

    let membershipId: string | null = null;

    if (existingMembership?.id) {
      const { data: updated, error: updateError } = await supabase
        .from("memberships")
        .update(membershipPayload)
        .eq("id", existingMembership.id)
        .select("id")
        .single();

      if (updateError) {
        console.error("Failed to update membership:", updateError);
        return errorResponse(
          `Failed to update membership: ${updateError.message}`
        );
      }
      membershipId = updated?.id ?? existingMembership.id;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("memberships")
        .insert({ ...membershipPayload, start_date: today })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to insert membership:", insertError);
        return errorResponse(
          `Failed to insert membership: ${insertError.message}`
        );
      }
      membershipId = inserted?.id ?? null;
    }

    return jsonResponse({
      subscription_id: subscriptionId,
      client_secret: clientSecret,
      membership_id: membershipId,
    });
  } catch (err) {
    console.error("Error in create-tier-subscription:", err);
    return errorResponse((err as Error).message ?? "Internal server error");
  }
});
