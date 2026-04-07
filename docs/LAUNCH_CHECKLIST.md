# RecReserve Launch Checklist

## 1. Environment Variables

### Supabase Edge Function Secrets
```
STRIPE_SECRET_KEY=sk_live_...              # Stripe live secret key
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...    # Stripe Connect webhook signing secret
STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_... # Subscription webhook secret
PLATFORM_FEE_PERCENT=5                     # Platform fee percentage
SUPABASE_URL=https://xxx.supabase.co       # Auto-set
SUPABASE_SERVICE_ROLE_KEY=...              # Auto-set
SUPABASE_ANON_KEY=...                      # Auto-set
```

### Mobile App (.env)
```
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Admin App (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## 2. Database Migrations (in order)

Run all migrations in this order:
1. `20260327_add_club_settings_fields.sql`
2. `20260327_add_court_pricing_and_membership_tiers.sql`
3. `20260327_add_user_credit_balance.sql`
4. `20260328_add_memberships_rls_policies.sql`
5. `20260328_add_notifications_delete_policy.sql`
6. `20260328_add_notifications_rls_policies.sql`
7. `20260329_kudos.sql`
8. `20260329_player_streaks.sql`
9. `20260330_feed_and_open_spots.sql`
10. `20260330_no_show_index.sql`
11. `20260330_remove_sport_from_feed_trigger.sql`
12. `20260331_announcement_images.sql`
13. `20260331_club_profile.sql`
14. `20260331_events_rls.sql`
15. `20260331_notification_club_id.sql`
16. `20260331_notification_image.sql`
17. `20260401_club_member_reservations_select.sql`
18. `20260401_club_members_can_view_users.sql`
19. `20260401_fix_membership_self_service.sql`
20. `20260401_fix_users_rls_recursion.sql`
21. `20260406_phase1_comprehensive_schema.sql`
22. `20260406_players_can_view_club_memberships.sql`
23. `20260407_trust_foundation.sql`
24. `20260408_fix_validate_booking.sql`
25. `20260408_programs_and_organized_play.sql`
26. `20260408_communications.sql`
27. `20260409_social_play_layer.sql`
28. `20260409_create_guest_reservation_fn.sql`
29. `20260409_reservation_participants.sql`
30. `20260409_leave_reservation_fn.sql`

## 3. Stripe Setup

### Platform Account
- [ ] Create Stripe account at dashboard.stripe.com
- [ ] Switch to LIVE mode (not test/sandbox)
- [ ] Get live secret key → set as `STRIPE_SECRET_KEY`
- [ ] Get live publishable key → set in mobile .env

### Stripe Connect (for club payouts)
- [ ] Enable Connect in Stripe Dashboard → Settings → Connect
- [ ] Set platform profile/branding
- [ ] Set up Connect webhooks:
  - URL: `https://xxx.supabase.co/functions/v1/stripe-connect-webhook`
  - Events: `account.updated`
  - Get webhook secret → set as `STRIPE_CONNECT_WEBHOOK_SECRET`

### Subscription Webhooks (if using)
- [ ] Set up subscription webhook endpoint
- [ ] Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`

### Apple Pay (optional)
- [ ] Register Merchant ID `merchant.com.recreserve` in Apple Developer
- [ ] Exchange certificates with Stripe (Dashboard → Settings → Apple Pay)
- [ ] Rebuild app with `npx expo prebuild --clean`

## 4. Edge Function Deployment

Deploy ALL functions with `--no-verify-jwt`:
```bash
supabase functions deploy create-payment-intent --no-verify-jwt
supabase functions deploy validate-booking --no-verify-jwt
supabase functions deploy finalize-booking --no-verify-jwt
supabase functions deploy process-refund --no-verify-jwt
supabase functions deploy create-connect-account --no-verify-jwt
supabase functions deploy create-event-payment --no-verify-jwt
supabase functions deploy stripe-connect-webhook --no-verify-jwt
supabase functions deploy subscription-webhook --no-verify-jwt
supabase functions deploy create-club-subscription --no-verify-jwt
supabase functions deploy notify-booking-confirmation --no-verify-jwt
supabase functions deploy notify-booking-reminder --no-verify-jwt
supabase functions deploy notify-cancellation --no-verify-jwt
supabase functions deploy notify-event-reminder --no-verify-jwt
supabase functions deploy notify-waitlist-promotion --no-verify-jwt
supabase functions deploy promote-waitlist --no-verify-jwt
supabase functions deploy nudge-lapsed-players --no-verify-jwt
supabase functions deploy send-push-campaign --no-verify-jwt
supabase functions deploy send-announcement --no-verify-jwt
supabase functions deploy update-streaks --no-verify-jwt
supabase functions deploy daily-digest --no-verify-jwt
supabase functions deploy smart-notifications --no-verify-jwt
```

## 5. Supabase RLS Verification

Verify these tables have RLS enabled and policies working:
- [ ] `reservations` — users see own + club members see club
- [ ] `memberships` — users see own, admins manage club
- [ ] `membership_tiers` — members view, admins manage
- [ ] `events` — members view, admins manage
- [ ] `event_registrations` — users manage own
- [ ] `booking_rules` — members view, admins manage
- [ ] `booking_policies` — members view active, admins manage
- [ ] `payment_records` — users see own, admins see club
- [ ] `audit_logs` — admins view, append-only
- [ ] `open_spots` — club members view, users manage own
- [ ] `spot_requests` — relevant parties view
- [ ] `reservation_participants` — users see own, owners manage, users can leave
- [ ] `open_games` — club members view, creators manage
- [ ] `game_participants` — club members view, creators/users manage
- [ ] `play_groups` — public groups visible to club members
- [ ] `play_group_members` — members and admins view
- [ ] `player_profiles` — visibility based on privacy setting
- [ ] `programs` — members view published, admins manage
- [ ] `leagues` — members view non-draft, admins manage
- [ ] `court_closures` — members view, admins manage
- [ ] `notifications` — users see own
- [ ] `communication_log` — users see own, admins see club
- [ ] `message_templates` — admins manage

## 6. Notification Setup

### Push Notifications
- [ ] Configure Expo push notification credentials
  - iOS: Upload APNs key to Expo
  - Android: Upload FCM server key to Expo
- [ ] Verify push tokens are being saved to `users.push_token`

### Scheduled Jobs (Cron)
Set up these Supabase cron jobs:
- [ ] `update-streaks` — weekly (Sunday midnight)
- [ ] `nudge-lapsed-players` — daily (9am local)
- [ ] `smart-notifications` — daily (8am local)
- [ ] `daily-digest` — daily (7am local)
- [ ] `notify-booking-reminder` — hourly (checks for bookings in next 24h)

## 7. Seed / Bootstrap

For each new club:
- [ ] Create admin user with `role = 'admin'`
- [ ] Create club record
- [ ] Set `users.club_id` for admin
- [ ] Create courts with availability
- [ ] Create booking rules (default limits)
- [ ] Create membership tiers
- [ ] Seed default message templates: `SELECT seed_default_templates(club_id, admin_user_id);`
- [ ] (Optional) Connect Stripe via admin dashboard

## 8. Smoke Tests

After deployment, verify these flows manually:
- [ ] Register new user
- [ ] Join a club
- [ ] Book a free court → success screen shown
- [ ] Book a paid court → Stripe payment sheet → success
- [ ] Cancel a booking → refund initiated
- [ ] Create open spot → accept request → participant sees booking
- [ ] Leave a reservation → spot request cleaned up
- [ ] Admin: view dashboard with stats
- [ ] Admin: create event
- [ ] Admin: mark no-show → audit log entry
- [ ] Admin: create court closure → affected bookings cancelled
- [ ] Notification appears in-app after booking

## 9. Monitoring

- [ ] Check Supabase Dashboard → Edge Functions → Logs for errors
- [ ] Check Stripe Dashboard → Events for webhook failures
- [ ] Set up Stripe webhook failure alerts
- [ ] Monitor `audit_logs` table for unusual patterns
- [ ] Monitor `payment_records` for `failed` or `disputed` status
