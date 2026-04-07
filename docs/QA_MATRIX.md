# RecReserve QA Matrix

## Booking Flow

| Test Case | Steps | Expected | Priority |
|---|---|---|---|
| Free booking success | Select court → select time → confirm | Reservation created, success screen shown | P0 |
| Paid booking success | Select court → select time → confirm → Stripe payment | Payment intent created, reservation confirmed after payment | P0 |
| Booking validation - no membership | Log in as user with no membership → try to book | Error: "You must have an active membership" | P0 |
| Booking validation - court conflict | Book court A at 8am → try to book court A at 8am again | Error: "This time slot is already booked" | P0 |
| Booking validation - max active | Set max_active_bookings_per_user=2 → make 2 bookings → try 3rd | Error: "You already have 2 active reservations" | P0 |
| Booking validation - advance limit | Set advance_booking_days=7 → try to book 10 days out | Error: "Cannot book more than 7 days in advance" | P1 |
| Booking validation - duration limit | Set max_booking_duration_mins=60 → try 2h booking | Error: "Maximum booking duration is 60 minutes" | P1 |
| Booking validation - court closure | Create closure for court A → try to book court A during closure | Error: "This court is closed" | P1 |
| Booking validation - past time | Try to book a time that already passed | Error: "Cannot book a time that has already passed" | P1 |
| Booking - suspended membership | Suspend membership → try to book | Error: "You must have an active membership" | P1 |
| Booking - double tap prevention | Tap confirm twice quickly | Only one reservation created | P1 |
| Booking idempotency | If booking succeeds but client retries | Same reservation returned, no duplicate | P1 |

## Cancellation Flow

| Test Case | Steps | Expected | Priority |
|---|---|---|---|
| Cancel within window | Cancel reservation > cutoff hours before start | Status → cancelled, refund initiated if paid | P0 |
| Cancel outside window | Try to cancel < cutoff hours before start | Error: cannot cancel within cutoff window | P0 |
| Cancel series - single | Cancel one recurring reservation | Only that reservation cancelled | P1 |
| Cancel series - all | Cancel entire series | All future reservations in series cancelled | P1 |
| Cancel with refund | Cancel paid reservation | process-refund called, stripe_refund_id set | P0 |
| Cancel free booking | Cancel free reservation | Status → cancelled, no refund needed | P1 |
| Admin cancel | Admin cancels member's reservation | Reservation cancelled, member notified, audit log created | P1 |

## Payments

| Test Case | Steps | Expected | Priority |
|---|---|---|---|
| Stripe test card success | Use 4242 4242 4242 4242 | Payment succeeds, reservation confirmed | P0 |
| Stripe test card decline | Use 4000 0000 0000 0002 | Payment declined, reservation not created | P0 |
| Payment intent without club Connect | Book at club without Stripe Connect | Payment goes to platform account | P1 |
| Payment intent with club Connect | Book at club with Stripe Connect | Payment split with platform fee | P1 |
| Refund processing | Cancel paid reservation | Stripe refund created, amount returned | P0 |
| Free booking - no payment | Book with can_book_free tier | No Stripe call, reservation confirmed | P0 |
| Discounted booking | Book with discount_percent tier | Correct amount charged | P1 |

## Memberships

| Test Case | Steps | Expected | Priority |
|---|---|---|---|
| Active member can book | Member with status=active | Booking allowed | P0 |
| Trial member can book | Member with status=trial | Booking allowed | P0 |
| Suspended member cannot book | Member with status=suspended | Booking rejected | P0 |
| Expired member cannot book | Member with status=expired | Booking rejected | P0 |
| Admin change member status | Admin sets status to suspended | Member's is_active=false, audit log created | P1 |
| Member tier pricing | Premium tier with 50% discount | Price correctly calculated at 50% off | P1 |
| Free tier booking | Tier with can_book_free=true | $0 booking, no Stripe | P0 |

## Open Spots / Social

| Test Case | Steps | Expected | Priority |
|---|---|---|---|
| Create open spot | From reservation → Find Players → set spots needed | Open spot created, visible to club members | P0 |
| Request to join spot | Browse open spots → Request to Join | Request created, spot owner notified | P0 |
| Accept request | Spot owner → My Posts → Accept | Participant added to reservation, requester notified + push | P0 |
| Decline request | Spot owner → My Posts → Decline | Request declined, requester notified | P1 |
| Leave reservation | Joined player → Leave | Participant removed, guest count decremented, spot request cleaned up, spot reactivated | P0 |
| Remove participant | Owner → expand participants → Remove | Same as leave but initiated by owner | P0 |
| Auto-close when full | Accept enough requests to fill spots_needed | Spot auto-closes (is_active=false) | P1 |
| Re-request after leave | Player leaves → browses open spots | Can request again (no duplicate constraint) | P1 |

## Open Games

| Test Case | Steps | Expected | Priority |
|---|---|---|---|
| Create game | Play tab → Create Game → select options → post | Game created, appears in browse | P1 |
| Join game | Browse games → Join | Participant added, creator notified | P1 |
| Game auto-full | Join until max_players reached | Status → full | P1 |
| Duplicate join prevention | Try to join same game twice | Error or no-op | P1 |

## Play Groups

| Test Case | Steps | Expected | Priority |
|---|---|---|---|
| Join public group | Browse groups → Join Group | Member added | P1 |
| Duplicate join prevention | Try to join same group twice | Error or no-op | P1 |

## Programs

| Test Case | Steps | Expected | Priority |
|---|---|---|---|
| Register for program | Browse programs → Register | Registration created | P1 |
| Duplicate registration prevention | Register twice | Error: already registered | P1 |
| Cancel registration | Cancel from program detail | Status → cancelled | P1 |
| Full program | Program at max_participants | Shows "Full", register disabled | P1 |

## Notifications

| Test Case | Steps | Expected | Priority |
|---|---|---|---|
| Booking confirmation | Complete a booking | In-app notification created | P0 |
| Spot request notification | Request to join spot | Spot owner gets notification | P0 |
| Spot accepted push | Owner accepts request | Requester gets push notification | P0 |
| Weather closure notification | Admin creates closure | Affected members notified, bookings cancelled | P1 |

## Admin Workflows

| Test Case | Steps | Expected | Priority |
|---|---|---|---|
| Mark no-show | Admin → Reservations → No-Show | Status updated, audit log created | P1 |
| Create court closure | Admin → Weather Closure → Add | Closure created, affected reservations cancelled | P1 |
| Update booking rules | Admin → Booking Rules → Save | Rules saved, audit log created | P1 |
| Update tier pricing | Admin → Tier Pricing → Update | Tier updated, audit log created | P1 |
| Member lookup | Admin → Front Desk → Search | Members found by name/email | P1 |
| Check in | Admin → Front Desk → Check In | Check-in recorded | P1 |
| CSV export | Admin → Reports → Export | CSV downloaded with correct data | P2 |

## Edge Cases

| Test Case | Expected | Priority |
|---|---|---|
| Book during court closure being created | Booking rejected or closure wins | P1 |
| Two users book same slot simultaneously | Only one succeeds (exclusion constraint) | P0 |
| Payment succeeds but client disconnects | Reservation should still be created on retry (idempotency) | P1 |
| Notification delivery failure | Booking still succeeds, notification failure logged | P1 |
| Edge function timeout | Graceful error shown to user | P1 |
