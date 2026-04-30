import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno&deno-std=0.177.0";
import { getServiceClient } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const endpointSecret = Deno.env.get("STRIPE_PAYMENT_WEBHOOK_SECRET")!;

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", (err as Error).message);
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  const supabase = getServiceClient();

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const meta = pi.metadata || {};

        // Look for an existing payment_records row by PI id
        const { data: existing } = await supabase
          .from("payment_records")
          .select("id, status")
          .eq("stripe_payment_intent_id", pi.id)
          .maybeSingle();

        if (existing) {
          if (existing.status !== "succeeded" && existing.status !== "refunded" && existing.status !== "partially_refunded") {
            await supabase
              .from("payment_records")
              .update({ status: "succeeded", updated_at: new Date().toISOString() })
              .eq("id", existing.id);
          }
        } else if (meta.user_id && meta.club_id) {
          // Create an audit row so we have a trail even if finalize-booking didn't run
          await supabase.from("payment_records").insert({
            club_id: meta.club_id,
            user_id: meta.user_id,
            entity_type: meta.entity_type || "reservation",
            entity_id: meta.entity_id || null,
            amount_cents: pi.amount,
            platform_fee_cents: pi.application_fee_amount || 0,
            net_amount_cents: pi.amount - (pi.application_fee_amount || 0),
            currency: pi.currency || "usd",
            stripe_payment_intent_id: pi.id,
            status: "succeeded",
            metadata: meta,
          });
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const meta = pi.metadata || {};
        const reason = pi.last_payment_error?.message || "payment_failed";

        const { data: existing } = await supabase
          .from("payment_records")
          .select("id")
          .eq("stripe_payment_intent_id", pi.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("payment_records")
            .update({ status: "failed", failure_reason: reason, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else if (meta.user_id && meta.club_id) {
          await supabase.from("payment_records").insert({
            club_id: meta.club_id,
            user_id: meta.user_id,
            entity_type: meta.entity_type || "reservation",
            entity_id: meta.entity_id || null,
            amount_cents: pi.amount,
            currency: pi.currency || "usd",
            stripe_payment_intent_id: pi.id,
            status: "failed",
            failure_reason: reason,
            metadata: meta,
          });
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (!piId) break;

        const refundedAmount = charge.amount_refunded || 0;
        const totalAmount = charge.amount || 0;
        const isPartial = refundedAmount > 0 && refundedAmount < totalAmount;

        // Latest refund id (charge.refunds is most recent first)
        const refundList = (charge.refunds?.data || []) as Stripe.Refund[];
        const stripeRefundId = refundList.length > 0 ? refundList[0].id : null;

        await supabase
          .from("payment_records")
          .update({
            status: isPartial ? "partially_refunded" : "refunded",
            refund_amount_cents: refundedAmount,
            stripe_refund_id: stripeRefundId,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", piId);
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const piId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
        if (!piId) break;

        await supabase
          .from("payment_records")
          .update({
            status: "disputed",
            failure_reason: dispute.reason || "disputed",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", piId);
        break;
      }

      default:
        // Unhandled event type — ack so Stripe doesn't retry
        break;
    }
  } catch (err) {
    console.error("payment-webhook handler error:", (err as Error).message, "event:", event.type);
    // Return 500 so Stripe retries — but only for handler errors, not validation
    return new Response(`Handler error: ${(err as Error).message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
