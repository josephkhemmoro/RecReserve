# RecReserve Data Model

## Core Entities

### Users & Auth
- `auth.users` — Supabase auth (email/password)
- `users` — App profiles (full_name, email, role, club_id, avatar_url, phone, push_token, credit_balance)
- **Roles:** admin, owner, club_admin, manager, front_desk, coach, finance, readonly_staff, player

### Clubs
- `clubs` — Organizations (name, location, logo_url, stripe_account_id, stripe_account_status, subscription_status)

### Courts
- `courts` — Bookable spaces (name, hourly_rate, is_free, is_active)
- `court_availability` — Weekly open/close hours per court per day
- `court_closures` — Temporary closures (weather, maintenance) with reason and time range

## Booking System

### Reservations
- `reservations` — Court bookings
  - Status: draft → pending_payment → confirmed → completed | cancelled | no_show → refunded
  - Supports recurring (recurring_group_id, is_recurring)
  - Tracks: amount_paid, guest_count, booking_source, validated_at, cancelled_at/by
- `reservation_participants` — Players who joined (via open spots, invites)
- `reservation_checkins` — Front desk check-in records

### Booking Rules
- `booking_rules` — Club-wide defaults (max duration, advance days, cutoff hours, max active)
- `booking_policies` — Tier/court-specific overrides with priority system
  - Supports: blackout dates, prime time surcharges, guest limits, recurring eligibility

### Waitlist
- `waitlist` — Court waitlist with position, notification tracking, expiry

## Payments

### Payment Records
- `payment_records` — Full payment lifecycle tracking
  - Entity types: reservation, event_registration, membership, cancellation_fee, no_show_fee, credit_purchase
  - Status: pending → processing → succeeded → refunded | partially_refunded | disputed | failed | cancelled
  - Tracks: amount_cents, platform_fee_cents, stripe IDs, idempotency_key
- `credit_transactions` — Admin-issued credit ledger

## Memberships

### Membership Lifecycle
- `memberships` — User-club relationship
  - Status: trial → active → suspended | expired | cancelled
  - Fields: tier_id, start_date, end_date, renewal_date, guest_allowance, booking_credits
- `membership_tiers` — Tier definitions (discount_percent, can_book_free, color)

## Events & Programs

### Events
- `events` — Single sessions (open_play, clinic, tournament, lesson, camp, league_match, etc.)
  - Extended with: instructor_id, program_id, skill_level, status, member_price, recurring support
- `event_registrations` — User registrations with payment tracking
- `event_attendance` — Check-in/no-show tracking per event

### Programs
- `programs` — Multi-session series (lesson_series, clinic_series, camp, academy, drop_in_series)
  - Fields: instructor, court, pricing (regular/member/drop-in), capacity, skill level, schedule
  - Status: draft → published → registration_open → in_progress → completed | cancelled
- `program_registrations` — User registrations

## Organized Play

### Leagues
- `leagues` — Competitive structures (ladder, round_robin, league, knockout)
  - Scoring config: points_for_win/draw/loss
  - Fields: entry_fee, member_entry_fee, skill_level, schedule
- `league_players` — Roster with seed, status, payment
- `league_matches` — Match scheduling, scoring, substitutes
- `league_standings` — Rank, W/L/D, points

## Social Layer

### Open Spots (Existing Reservations)
- `open_spots` — "Looking for players" posts linked to reservations
- `spot_requests` — Join requests with accept/decline workflow

### Open Games (Standalone)
- `open_games` — Game requests not tied to a reservation
  - Fields: sport, format, skill_level, date, time, court, capacity
  - Status: open → full → confirmed → completed | cancelled
- `game_participants` — Joined/invited/requested players

### Play Groups
- `play_groups` — Recurring social groups
  - Fields: sport, skill_level, recurring schedule, max_members
- `play_group_members` — Group roster with role (admin/member)

### Social Graph
- `play_connections` — Who plays with whom (auto-tracked from games)
  - Fields: times_played, last_played_at, is_favorite, is_blocked
- `player_profiles` — Extended identity (sports, skill_levels, preferred_formats, play_style, availability, privacy)
- `player_availability` — Specific weekly time slots

## Community & Engagement

### Streaks & Kudos
- `player_streaks` — Weekly play streak tracking with freeze system
- `streak_milestones` — Achievement badges (4, 8, 12, 26, 52 weeks)
- `kudos` — Per-reservation appreciation between players

### Activity Feed
- `feed_events` — Club activity stream (bookings, kudos, milestones, games, joins)

### Club Profile
- `club_photos` — Photo gallery
- `club_announcements` — Club-wide announcements with images

## Communication

### Notifications
- `notifications` — In-app notifications with type, read status
- `push_campaigns` — Admin-targeted push by audience segment

### Templates & History
- `message_templates` — Reusable message templates with merge fields
- `communication_log` — Record of all messages sent (channel, trigger, status)

## Admin & Audit

### Audit Trail
- `audit_logs` — Append-only log of all mutations
  - Auto-triggered on: reservation status changes, membership changes, payment changes
  - Manual entries on: admin actions (cancel, no-show, rule changes, pricing changes)

## Server-Side Functions

### SQL Functions (SECURITY DEFINER)
- `validate_booking()` — Server-side booking policy engine
- `validate_cancellation()` — Cancellation rule enforcement
- `create_guest_reservation()` — Add participant to existing reservation (bypasses RLS)
- `leave_reservation()` — Clean participant removal with spot cleanup
- `seed_default_templates()` — Bootstrap message templates for a club

### Relationship Diagram (simplified)
```
clubs ←── courts ←── court_availability
  │         │ ←── court_closures
  │         │ ←── reservations ←── reservation_participants
  │         │         │ ←── open_spots ←── spot_requests
  │         │         │ ←── reservation_checkins
  │         │
  │         ├── events ←── event_registrations
  │         │         ←── event_attendance
  │         │
  │         ├── programs ←── program_registrations
  │         ├── leagues ←── league_players
  │                    ←── league_matches
  │                    ←── league_standings
  │
  ├── memberships ←── membership_tiers
  ├── booking_rules
  ├── booking_policies
  ├── payment_records
  ├── audit_logs
  ├── notifications
  ├── push_campaigns
  ├── message_templates
  ├── communication_log
  │
  users ←── player_profiles
        ←── player_availability
        ←── play_connections
        ←── open_games ←── game_participants
        ←── play_groups ←── play_group_members
        ←── kudos
        ←── player_streaks ←── streak_milestones
        ←── feed_events
```
