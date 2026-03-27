import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { getServiceClient } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

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

    const { payment_intent_id, reservation_id } = await req.json();

    if (!payment_intent_id) {
      return new Response(
        JSON.stringify({ error: "payment_intent_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this payment has a transfer (Connect payment) by looking at the PaymentIntent
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    const hasTransfer = !!paymentIntent.transfer_data?.destination;

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: payment_intent_id,
    };

    // If it was a Connect payment, reverse the transfer to claw back from the club
    if (hasTransfer) {
      refundParams.reverse_transfer = true;
      refundParams.refund_application_fee = false; // platform keeps fee — change to true if you want to refund it
    }

    const refund = await stripe.refunds.create(refundParams);

    // Update reservation with refund info
    if (reservation_id) {
      const supabase = getServiceClient();
      await supabase
        .from("reservations")
        .update({ stripe_refund_id: refund.id })
        .eq("id", reservation_id);
    }

    return new Response(
      JSON.stringify({ success: true, refund_id: refund.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error processing refund:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
