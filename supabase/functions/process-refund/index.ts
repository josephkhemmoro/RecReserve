import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno&deno-std=0.177.0";
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

    const { payment_intent_id, reservation_id, amount_cents, reason } = await req.json();

    if (!payment_intent_id) {
      return new Response(
        JSON.stringify({ error: "payment_intent_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    const hasTransfer = !!paymentIntent.transfer_data?.destination;

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: payment_intent_id,
    };
    if (typeof amount_cents === "number" && amount_cents > 0) {
      refundParams.amount = amount_cents;
    }
    if (hasTransfer) {
      refundParams.reverse_transfer = true;
      refundParams.refund_application_fee = false;
    }

    const refund = await stripe.refunds.create(refundParams);

    // Update payment_records — find by PI id
    const { data: payment } = await supabase
      .from("payment_records")
      .select("id, amount_cents, refund_amount_cents")
      .eq("stripe_payment_intent_id", payment_intent_id)
      .maybeSingle();

    if (payment) {
      const totalRefunded = (payment.refund_amount_cents || 0) + refund.amount;
      const isPartial = totalRefunded < payment.amount_cents;
      await supabase
        .from("payment_records")
        .update({
          status: isPartial ? "partially_refunded" : "refunded",
          stripe_refund_id: refund.id,
          refund_amount_cents: totalRefunded,
          refund_reason: reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);
    }

    // Audit log if we know the reservation
    if (reservation_id) {
      try {
        const { data: res } = await supabase
          .from("reservations")
          .select("club_id")
          .eq("id", reservation_id)
          .maybeSingle();
        if (res?.club_id) {
          await supabase.from("audit_logs").insert({
            club_id: res.club_id,
            actor_id: user.id,
            action: "refund.create",
            entity_type: "reservation",
            entity_id: reservation_id,
            changes: {
              stripe_refund_id: { old: null, new: refund.id },
              refund_amount_cents: { old: null, new: refund.amount },
            },
          });
        }
      } catch (auditErr) {
        console.warn("Refund audit log failed (non-blocking):", auditErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, refund_id: refund.id, refund_amount_cents: refund.amount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error processing refund:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
