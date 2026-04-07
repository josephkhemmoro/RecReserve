# Failure Mode Handling

## Payment Success but Reservation Write Failure

**Current behavior:** Mobile client calls `create-payment-intent` → Stripe payment succeeds → direct insert to `reservations` fails (RLS, constraint, network).

**Mitigation:**
- The booking flow catches insert errors and shows them to the user
- The Stripe payment exists but no reservation was created
- **Recovery:** Admin can find the payment in Stripe Dashboard by searching the user's email, then manually create the reservation in the admin panel

**Future improvement:** Re-enable `finalize-booking` edge function (see TODO_TRUST_HARDENING.md) which does atomic validation + insert + payment record in one server call.

## Duplicate Submission

**Current behavior:**
- `if (loading) return` guard prevents double-tap on Confirm Booking
- `no_overlap` exclusion constraint on reservations prevents duplicate court bookings at the same time
- `UNIQUE (event_id, user_id)` on event_registrations prevents double registration
- `UNIQUE (program_id, user_id)` on program_registrations prevents double registration
- `UNIQUE (game_id, user_id)` on game_participants prevents double join
- `UNIQUE (group_id, user_id)` on play_group_members prevents double join
- `UNIQUE (reservation_id, user_id)` on reservation_participants prevents double add

**Status:** Covered at the database level. UI double-tap guard is a convenience layer.

## Webhook Delays

**Current behavior:** Stripe Connect webhook (`stripe-connect-webhook`) updates `stripe_onboarding_complete` on clubs. If delayed, the club shows "Stripe Pending" in admin but payments still work (they go to platform account).

**Mitigation:** No user-facing impact. Admin can manually check Stripe Dashboard.

**Future improvement:** Payment webhook to update `payment_records` status from Stripe events.

## Partial Recurring Booking Failure

**Current behavior:** Recurring bookings are not yet fully implemented (schema supports it with `recurring_group_id` but the insertion loop isn't built).

**When implemented:** Wrap all recurring inserts in a loop. If any slot fails (conflict, closure), skip that slot and report which dates succeeded vs failed. Don't roll back successful slots.

## Notification Delivery Failure

**Current behavior:** All notification sends are wrapped in try/catch and are non-blocking. The booking/action succeeds even if push delivery fails.

**Mitigation:**
- In-app notification record is always created (even if push fails)
- Push failures are logged to console
- The `communication_log` table can track delivery status

**Future improvement:** Add retry logic for failed pushes. Monitor `communication_log` for `status = 'failed'`.

## Edge Function Timeout

**Current behavior:** If an edge function times out (default 60s), the Supabase gateway returns an error. The mobile client shows "Edge Function returned a non-2xx status code" or the specific error from the function.

**Mitigation:**
- `validate-booking` returns 200 with error details (never 500)
- `create-payment-intent` returns 200 with error details
- Booking flow logs warnings and proceeds if validation service is unavailable

## Database Connection Limits

**Risk:** Supabase free tier has limited connections. Heavy load could exhaust the pool.

**Mitigation:**
- Use `.single()` where expecting one row
- Limit queries with `.limit()`
- Avoid N+1 queries (prefer joins or batch fetches)

## Stale Data After Mutations

**Current behavior:** After booking/cancelling/joining, the screen calls `fetchData()` to refresh. If the user navigates away before refresh completes, they may see stale data.

**Mitigation:** Pull-to-refresh on all list screens. Data refreshes on tab focus via useEffect dependencies.
