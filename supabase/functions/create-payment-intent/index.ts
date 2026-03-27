import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { getServiceClient } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

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
    // Verify the user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabase = getServiceClient();
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { amount, court_id, user_id, club_id, date, start_time, end_time } =
      await req.json();

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Valid amount is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
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
        court_id: court_id ?? "",
        user_id: user_id ?? "",
        club_id: club_id ?? "",
        date: date ?? "",
        start_time: start_time ?? "",
        end_time: end_time ?? "",
      },
    };

    // If the club has completed Stripe Connect onboarding, route the payment
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
    console.error("Error creating payment intent:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
