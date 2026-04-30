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

    const { tier_id } = await req.json();
    if (!tier_id) {
      return errorResponse("tier_id is required");
    }

    // Fetch tier
    const { data: tier, error: tierError } = await supabase
      .from("membership_tiers")
      .select(
        "id, name, club_id, monthly_price_cents, stripe_product_id, stripe_price_id, is_paid"
      )
      .eq("id", tier_id)
      .single();

    if (tierError || !tier) {
      return errorResponse("Tier not found");
    }

    if (!tier.is_paid) {
      return errorResponse("Tier is not a paid tier");
    }

    if (!tier.monthly_price_cents || tier.monthly_price_cents <= 0) {
      return errorResponse("Tier must have a positive monthly price");
    }

    // Verify caller is an admin at this club
    const { data: profile } = await supabase
      .from("users")
      .select("role, club_id")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin" || profile?.club_id !== tier.club_id) {
      return errorResponse("Admin access required for this club");
    }

    // Fetch club name for product naming
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("id, name")
      .eq("id", tier.club_id)
      .single();

    if (clubError || !club) {
      return errorResponse("Club not found");
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const stripeHeaders = {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    let stripeProductId = tier.stripe_product_id as string | null;
    let stripePriceId = tier.stripe_price_id as string | null;

    // Step 1: create product if missing
    if (!stripeProductId) {
      const productParams = new URLSearchParams();
      productParams.append("name", `${club.name} - ${tier.name}`);
      productParams.append("metadata[club_id]", tier.club_id);
      productParams.append("metadata[tier_id]", tier.id);

      const productRes = await fetch("https://api.stripe.com/v1/products", {
        method: "POST",
        headers: stripeHeaders,
        body: productParams.toString(),
      });
      const productData = await productRes.json();

      if (!productRes.ok) {
        console.error("Stripe product create failed:", JSON.stringify(productData));
        return errorResponse(
          productData.error?.message || "Failed to create Stripe product"
        );
      }
      stripeProductId = productData.id;
    }

    // Step 2: check if existing price matches current monthly_price_cents.
    // If we have a price id, fetch it from Stripe and compare unit_amount.
    let priceMatches = false;
    if (stripePriceId) {
      const priceRes = await fetch(
        `https://api.stripe.com/v1/prices/${stripePriceId}`,
        { method: "GET", headers: { Authorization: `Bearer ${stripeSecretKey}` } }
      );
      if (priceRes.ok) {
        const priceData = await priceRes.json();
        if (
          priceData.unit_amount === tier.monthly_price_cents &&
          priceData.active === true &&
          priceData.currency === "usd" &&
          priceData.recurring?.interval === "month"
        ) {
          priceMatches = true;
        }
      }
    }

    if (!stripePriceId || !priceMatches) {
      // Create a new price (Stripe prices are immutable).
      const priceParams = new URLSearchParams();
      priceParams.append("unit_amount", String(tier.monthly_price_cents));
      priceParams.append("currency", "usd");
      priceParams.append("recurring[interval]", "month");
      priceParams.append("product", stripeProductId!);
      priceParams.append("metadata[club_id]", tier.club_id);
      priceParams.append("metadata[tier_id]", tier.id);

      const priceRes = await fetch("https://api.stripe.com/v1/prices", {
        method: "POST",
        headers: stripeHeaders,
        body: priceParams.toString(),
      });
      const priceData = await priceRes.json();

      if (!priceRes.ok) {
        console.error("Stripe price create failed:", JSON.stringify(priceData));
        return errorResponse(
          priceData.error?.message || "Failed to create Stripe price"
        );
      }

      // Optionally deactivate the old price so it isn't accidentally reused
      if (stripePriceId) {
        const deactivateParams = new URLSearchParams();
        deactivateParams.append("active", "false");
        await fetch(`https://api.stripe.com/v1/prices/${stripePriceId}`, {
          method: "POST",
          headers: stripeHeaders,
          body: deactivateParams.toString(),
        }).catch((e) => console.error("Failed to deactivate old price:", e));
      }

      stripePriceId = priceData.id;
    }

    // Step 3: persist IDs on the tier
    const { error: updateError } = await supabase
      .from("membership_tiers")
      .update({
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
      })
      .eq("id", tier.id);

    if (updateError) {
      console.error("Failed to update tier:", updateError);
      return errorResponse(`Failed to persist Stripe IDs: ${updateError.message}`);
    }

    return jsonResponse({
      stripe_product_id: stripeProductId,
      stripe_price_id: stripePriceId,
    });
  } catch (err) {
    console.error("Error in create-tier-product:", err);
    return errorResponse((err as Error).message ?? "Internal server error");
  }
});
