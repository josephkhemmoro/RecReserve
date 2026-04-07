import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno&deno-std=0.177.0";
import { getServiceClient } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const PLATFORM_FEE_PERCENT = Number(Deno.env.get("PLATFORM_FEE_PERCENT") || "5");

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
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
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

    const { event_id, club_id, amount } = await req.json();

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Valid amount required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check event capacity
    const { data: event } = await supabase
      .from("events")
      .select("max_participants")
      .eq("id", event_id)
      .single();

    if (event?.max_participants) {
      const { count } = await supabase
        .from("event_registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event_id)
        .eq("status", "registered");

      if (count !== null && count >= event.max_participants) {
        return new Response(JSON.stringify({ error: "Event is full" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check club Stripe status
    const { data: club } = await supabase
      .from("clubs")
      .select("stripe_account_id, stripe_onboarding_complete")
      .eq("id", club_id)
      .single();

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        event_id: event_id ?? "",
        user_id: user.id,
        club_id: club_id ?? "",
        type: "event_registration",
      },
    };

    if (club?.stripe_account_id && club?.stripe_onboarding_complete) {
      const applicationFee = Math.round(amount * (PLATFORM_FEE_PERCENT / 100));
      paymentIntentParams.application_fee_amount = applicationFee;
      paymentIntentParams.transfer_data = {
        destination: club.stripe_account_id,
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error creating event payment:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
