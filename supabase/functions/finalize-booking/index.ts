import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendExpoPush } from "../_shared/push.ts";

const PLATFORM_FEE_PERCENT = Number(Deno.env.get("PLATFORM_FEE_PERCENT") || "5");

// Lazy Stripe initialization — only loaded when needed for paid bookings
let _stripe: any = null;
async function getStripe() {
  if (!_stripe) {
    const Stripe = (await import("https://esm.sh/stripe@17.7.0?target=deno&deno-std=0.177.0")).default;
    _stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return _stripe;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function errorResponse(error: string, debug?: unknown) {
  return new Response(
    JSON.stringify({ error, debug }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return errorResponse("Unauthorized: " + (authError?.message || "invalid token"));
    }

    const {
      court_id,
      club_id,
      start_time,
      end_time,
      guest_count,
      notes,
      stripe_payment_intent_id,
      amount_cents,
      is_free,
      idempotency_key,
    } = await req.json();

    // Step 1: Re-validate server-side (prevents race conditions)
    const { data: validation, error: valError } = await supabase.rpc("validate_booking", {
      p_user_id: user.id,
      p_club_id: club_id,
      p_court_id: court_id,
      p_start_time: start_time,
      p_end_time: end_time,
      p_guest_count: guest_count || 0,
    });

    if (valError) {
      console.error("Validation RPC error:", JSON.stringify(valError));
      return errorResponse("Validation failed: " + valError.message, {
        hint: valError.hint, details: valError.details, code: valError.code,
      });
    }

    const valResult = typeof validation === "string" ? JSON.parse(validation) : validation;
    if (!valResult.valid) {
      return new Response(
        JSON.stringify({ error: "Booking validation failed", errors: valResult.errors }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Idempotency check
    if (idempotency_key) {
      const { data: existingPayment } = await supabase
        .from("payment_records")
        .select("entity_id")
        .eq("idempotency_key", idempotency_key)
        .eq("status", "succeeded")
        .limit(1);

      if (existingPayment && existingPayment.length > 0) {
        const { data: existingRes } = await supabase
          .from("reservations")
          .select("id, status")
          .eq("id", existingPayment[0].entity_id)
          .single();

        if (existingRes) {
          return new Response(
            JSON.stringify({ reservation_id: existingRes.id, status: existingRes.status, idempotent: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Step 3: Verify Stripe payment if paid
    let verifiedPaymentIntentId = null;
    if (!is_free && stripe_payment_intent_id) {
      try {
        const stripe = await getStripe();
        const pi = await stripe.paymentIntents.retrieve(stripe_payment_intent_id);
        if (pi.status !== "succeeded") {
          return errorResponse(`Payment not completed. Stripe status: ${pi.status}`);
        }
        verifiedPaymentIntentId = pi.id;
      } catch (stripeErr) {
        return errorResponse("Failed to verify payment with Stripe: " + (stripeErr as Error).message);
      }
    }

    // Step 4: Create reservation
    const reservationId = crypto.randomUUID();
    const { error: resError } = await supabase.from("reservations").insert({
      id: reservationId,
      court_id,
      user_id: user.id,
      club_id,
      start_time,
      end_time,
      status: "confirmed",
      guest_count: guest_count || 0,
      notes: notes || null,
      stripe_payment_id: verifiedPaymentIntentId,
      amount_paid: is_free ? 0 : (amount_cents || 0) / 100,
      validated_at: new Date().toISOString(),
    });

    if (resError) {
      console.error("Reservation insert error:", JSON.stringify(resError));
      return errorResponse("Failed to create reservation: " + resError.message);
    }

    // Step 5: Payment record (non-blocking — don't fail the booking if this errors)
    if (!is_free && amount_cents > 0) {
      try {
        const platformFee = Math.round(amount_cents * (PLATFORM_FEE_PERCENT / 100));
        const { data: pr } = await supabase.from("payment_records").insert({
          club_id,
          user_id: user.id,
          entity_type: "reservation",
          entity_id: reservationId,
          amount_cents,
          platform_fee_cents: platformFee,
          net_amount_cents: amount_cents - platformFee,
          currency: "usd",
          stripe_payment_intent_id: verifiedPaymentIntentId,
          idempotency_key: idempotency_key || null,
          status: "succeeded",
        }).select("id").single();

        if (pr?.id) {
          await supabase.from("reservations").update({ payment_record_id: pr.id }).eq("id", reservationId);
        }
      } catch (payErr) {
        console.warn("Payment record creation failed (non-blocking):", payErr);
      }
    }

    // Step 6: Audit log (non-blocking)
    try {
      await supabase.from("audit_logs").insert({
        club_id,
        actor_id: user.id,
        action: "reservation.create",
        entity_type: "reservation",
        entity_id: reservationId,
        changes: { status: { old: null, new: "confirmed" }, amount_paid: { old: null, new: is_free ? 0 : (amount_cents || 0) / 100 } },
      });
    } catch (auditErr) {
      console.warn("Audit log failed (non-blocking):", auditErr);
    }

    // Step 7: Notification (non-blocking)
    try {
      const { data: court } = await supabase.from("courts").select("name").eq("id", court_id).single();
      const { data: userProfile } = await supabase.from("users").select("push_token").eq("id", user.id).single();

      const startDate = new Date(start_time);
      const dateStr = startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const timeStr = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

      await supabase.from("notifications").insert({
        user_id: user.id, club_id,
        title: "Booking Confirmed",
        body: `${court?.name || "Court"} on ${dateStr} at ${timeStr}`,
        type: "booking_confirmation", read: false,
      });

      if (userProfile?.push_token) {
        await sendExpoPush({
          to: userProfile.push_token,
          title: "Booking Confirmed",
          body: `${court?.name || "Court"} on ${dateStr} at ${timeStr}`,
          data: { type: "booking_confirmation", reservation_id: reservationId },
        });
      }
    } catch (notifErr) {
      console.warn("Notification failed (non-blocking):", notifErr);
    }

    return new Response(
      JSON.stringify({ reservation_id: reservationId, status: "confirmed", idempotent: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in finalize-booking:", err);
    return errorResponse(err.message ?? "Internal server error");
  }
});
