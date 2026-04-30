import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno&deno-std=0.177.0";
import { getServiceClient } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const endpointSecret = Deno.env.get("STRIPE_SUBSCRIPTION_WEBHOOK_SECRET")!;

type SupabaseClient = ReturnType<typeof getServiceClient>;

// Map Stripe subscription status to our membership status enum
function mapStripeStatusToMembership(
  stripeStatus: string
): "trial" | "active" | "suspended" | "expired" | "cancelled" | null {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trial";
    case "past_due":
    case "unpaid":
      return "suspended";
    case "canceled":
      return "cancelled";
    case "incomplete_expired":
      return "expired";
    default:
      return null;
  }
}

// Determine whether a Stripe subscription id corresponds to a MEMBERSHIP (player)
// subscription or a CLUB-level subscription. We trust the DB over metadata.
async function findMembershipBySubscriptionId(
  supabase: SupabaseClient,
  subscriptionId: string
) {
  const { data } = await supabase
    .from("memberships")
    .select(
      "id, user_id, club_id, tier_id, pending_tier_id, stripe_subscription_id, cancel_at_period_end, current_period_end, status"
    )
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  return data ?? null;
}

async function findClubBySubscriptionId(
  supabase: SupabaseClient,
  subscriptionId: string
) {
  const { data } = await supabase
    .from("clubs")
    .select("id, stripe_subscription_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  return data ?? null;
}

async function handleMembershipSubscriptionEvent(
  supabase: SupabaseClient,
  event: Stripe.Event
) {
  const sub = event.data.object as Stripe.Subscription;

  // Try DB lookup first
  let membership = await findMembershipBySubscriptionId(supabase, sub.id);

  // Fallback: look up by metadata (user_id + club_id + tier_id)
  if (!membership) {
    const userIdMeta = sub.metadata?.user_id as string | undefined;
    const clubIdMeta = sub.metadata?.club_id as string | undefined;
    if (userIdMeta && clubIdMeta) {
      const { data } = await supabase
        .from("memberships")
        .select(
          "id, user_id, club_id, tier_id, pending_tier_id, stripe_subscription_id, cancel_at_period_end, current_period_end, status"
        )
        .eq("user_id", userIdMeta)
        .eq("club_id", clubIdMeta)
        .maybeSingle();
      membership = data ?? null;
    }
  }

  if (!membership) {
    console.log(
      `No membership row found for subscription ${sub.id}; ignoring event ${event.type}`
    );
    return;
  }

  const currentPeriodEndIso =
    typeof sub.current_period_end === "number"
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

  const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);

  const mappedStatus = mapStripeStatusToMembership(sub.status);

  if (event.type === "customer.subscription.created") {
    const update: Record<string, unknown> = {
      status: "trial", // until first invoice.paid lands
      current_period_end: currentPeriodEndIso,
      cancel_at_period_end: cancelAtPeriodEnd,
      stripe_subscription_id: sub.id,
    };
    await supabase.from("memberships").update(update).eq("id", membership.id);
    console.log(`Membership ${membership.id} created -> trial`);
    return;
  }

  if (event.type === "customer.subscription.updated") {
    const update: Record<string, unknown> = {
      current_period_end: currentPeriodEndIso,
      cancel_at_period_end: cancelAtPeriodEnd,
    };

    if (mappedStatus) {
      update.status = mappedStatus;
      update.is_active =
        mappedStatus === "active" || mappedStatus === "trial";
    }

    // If the cancel window just closed, swap to the pending (default free) tier
    // and clear the subscription id.
    const periodEndedMs =
      typeof sub.current_period_end === "number"
        ? sub.current_period_end * 1000
        : null;
    const now = Date.now();

    if (
      cancelAtPeriodEnd &&
      periodEndedMs !== null &&
      periodEndedMs <= now &&
      membership.pending_tier_id
    ) {
      update.tier_id = membership.pending_tier_id;
      update.pending_tier_id = null;
      update.stripe_subscription_id = null;
      update.cancel_at_period_end = false;
      update.status = "active";
      update.is_active = true;
    }

    await supabase.from("memberships").update(update).eq("id", membership.id);
    console.log(
      `Membership ${membership.id} updated -> status=${update.status ?? membership.status}`
    );
    return;
  }

  if (event.type === "customer.subscription.deleted") {
    const update: Record<string, unknown> = {
      stripe_subscription_id: null,
      cancel_at_period_end: false,
    };

    if (membership.pending_tier_id) {
      update.tier_id = membership.pending_tier_id;
      update.pending_tier_id = null;
      update.status = "active";
      update.is_active = true;
    } else {
      update.status = "cancelled";
      update.is_active = false;
    }

    await supabase.from("memberships").update(update).eq("id", membership.id);
    console.log(`Membership ${membership.id} subscription deleted`);
    return;
  }
}

async function handleMembershipInvoiceEvent(
  supabase: SupabaseClient,
  event: Stripe.Event,
  invoice: Stripe.Invoice
) {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id ?? null;

  if (!subscriptionId) return false;

  const membership = await findMembershipBySubscriptionId(
    supabase,
    subscriptionId
  );
  if (!membership) return false;

  if (event.type === "invoice.paid") {
    await supabase
      .from("memberships")
      .update({ status: "active", is_active: true })
      .eq("id", membership.id);
    console.log(`Membership ${membership.id} invoice paid -> active`);
    return true;
  }

  if (event.type === "invoice.payment_failed") {
    await supabase
      .from("memberships")
      .update({ status: "suspended" })
      .eq("id", membership.id);
    console.log(`Membership ${membership.id} invoice payment failed -> suspended`);
    return true;
  }

  return false;
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      endpointSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", (err as Error).message);
    return new Response(
      `Webhook Error: ${(err as Error).message}`,
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  try {
    // ---------- Subscription lifecycle events (membership only) ----------
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const membership = await findMembershipBySubscriptionId(supabase, sub.id);

      // Also check metadata fallback for the `.created` event where the DB
      // row may not have been written with the sub id yet (race).
      const hasMembershipMetadata = Boolean(
        sub.metadata?.user_id && sub.metadata?.tier_id
      );

      if (membership || hasMembershipMetadata) {
        await handleMembershipSubscriptionEvent(supabase, event);
      }
    }

    // ---------- Invoice events ----------
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;

      // Try membership handler first
      const handled = await handleMembershipInvoiceEvent(
        supabase,
        event,
        invoice
      );

      if (!handled) {
        // Fall back to legacy club-level handling
        const customerId = invoice.customer as string;
        await supabase
          .from("clubs")
          .update({ subscription_status: "suspended" })
          .eq("stripe_customer_id", customerId);
        console.log(`Suspended club with Stripe customer ${customerId}`);
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;

      const handled = await handleMembershipInvoiceEvent(
        supabase,
        event,
        invoice
      );

      if (!handled) {
        const customerId = invoice.customer as string;
        await supabase
          .from("clubs")
          .update({ subscription_status: "active" })
          .eq("stripe_customer_id", customerId);
        console.log(`Reactivated club with Stripe customer ${customerId}`);
      }
    }
  } catch (err) {
    console.error("Error processing webhook event:", err);
    // Still return 200 so Stripe doesn't hammer us; error is logged.
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
