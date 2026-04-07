# Trust Hardening — Remaining Work

Items deferred from the "make RecReserve pilot-ready" sprint. None are blocking current functionality but all are needed before a real club goes live with payments.

---

## 1. Finalize-Booking Atomic Path

**Priority:** High
**Status:** Direct insert fallback is working. Edge function deployed with `--no-verify-jwt` but untested end-to-end.

**What's needed:**
- Test `finalize-booking` edge function with a paid booking (Stripe test card)
- Verify it creates a `payment_records` row alongside the reservation
- Verify idempotency key prevents double-booking on retry
- Once confirmed working, remove the direct-insert fallback from `apps/mobile/app/booking/confirm.jsx`
- The Stripe SDK import was replaced with direct REST API calls in `create-payment-intent` — do the same for `finalize-booking` if the SDK import still causes boot crashes

**Files:**
- `supabase/functions/finalize-booking/index.ts`
- `apps/mobile/app/booking/confirm.jsx` (remove fallback once finalize works)

---

## 2. Webhook-Driven Payment Confirmation

**Priority:** High
**Status:** Not started.

**What's needed:**
- Create a `payment-webhook` edge function that listens for Stripe `payment_intent.succeeded`, `payment_intent.payment_failed`, and `charge.refunded` events
- On `payment_intent.succeeded`: update `payment_records.status` to `succeeded`
- On `payment_intent.payment_failed`: update to `failed`, optionally cancel the reservation
- On `charge.refunded`: update to `refunded` or `partially_refunded`
- Register the webhook URL in Stripe Dashboard → Developers → Webhooks
- This makes payment state trustworthy even if the client disconnects mid-flow

**Files to create:**
- `supabase/functions/payment-webhook/index.ts`

**Files to update:**
- Stripe Dashboard webhook configuration

---

## 3. Refund Flow with Payment Records

**Priority:** Medium
**Status:** `process-refund` works but doesn't update `payment_records`.

**What's needed:**
- Update `process-refund` to find the `payment_records` row by `stripe_payment_intent_id`
- Set `status` to `refunded` or `partially_refunded`
- Set `refund_amount_cents` and `stripe_refund_id`
- The audit trigger on `payment_records` will auto-log the change

**Files:**
- `supabase/functions/process-refund/index.ts`

---

## 4. Role-Based Permission Checks in Admin UI

**Priority:** Medium
**Status:** Roles exist in schema (`owner`, `club_admin`, `manager`, `front_desk`, `coach`, `finance`, `readonly_staff`) but admin pages only check `role === 'admin'`.

**What's needed:**
- Update `useAdminClub` hook to return the user's role
- Add permission checks on sensitive pages:
  - Finance pages (reports, payments): `owner`, `club_admin`, `finance`
  - Member management: `owner`, `club_admin`, `manager`
  - Booking rules/policies: `owner`, `club_admin`, `manager`
  - Settings: `owner`, `club_admin`
  - Audit log: `owner`, `club_admin`
  - Read-only views (dashboard, reservations): all staff roles
- Show/hide sidebar nav items based on role
- Shared types already have `ROLE_CAN_MANAGE_*` arrays for this

**Files:**
- `apps/admin/src/lib/useAdminClub.ts`
- `apps/admin/src/app/(dashboard)/layout.tsx` (sidebar filtering)
- All admin page files (permission gates)

---

## 5. Tests for Critical Trust Paths

**Priority:** Medium
**Status:** No tests exist.

**What's needed:**
- **Booking rule enforcement**: test that `validate_booking` SQL function correctly rejects over-limit, past-time, conflicting, and blackout bookings
- **Reservation state transitions**: test that only valid transitions are allowed (e.g., `confirmed` → `cancelled` is OK, `cancelled` → `confirmed` is not)
- **Payment/reservation consistency**: test that a reservation can't exist in `confirmed` without a corresponding payment record (for paid bookings)
- **Refund/credit accuracy**: test that refund amounts match original payment minus any fees
- **Membership permissions**: test that suspended/expired members can't book

**Suggested approach:**
- SQL tests for `validate_booking` and `validate_cancellation` functions (can run directly in Supabase SQL editor or via pgTAP)
- Integration tests for edge functions (use Deno test runner)
- Consider adding a `supabase/tests/` directory

---

## 6. Validate-Booking Edge Function Stability

**Priority:** Low (currently works but returns errors that are caught gracefully)
**Status:** Working with `--no-verify-jwt`. Returns non-2xx sometimes but client handles it.

**What's needed:**
- Investigate why the Supabase gateway returns 401 even for valid JWTs (may be simulator clock skew)
- Consider converting `validate-booking` to use direct REST API for the RPC call instead of the Supabase JS client, similar to how `create-payment-intent` now uses direct Stripe REST
- Long-term: move validation to a Postgres trigger or RLS policy so it doesn't require an edge function at all

---

## Quick Reference

| Item | Blocking Production? | Effort |
|---|---|---|
| Finalize-booking atomic path | Yes — needed for payment safety | Small |
| Payment webhooks | Yes — needed for payment reliability | Medium |
| Refund + payment records | Yes — needed for audit trail | Small |
| Role-based admin permissions | No — single-admin clubs work fine | Medium |
| Tests | No — but needed for confidence | Large |
| Validate-booking stability | No — fallback works | Small |
