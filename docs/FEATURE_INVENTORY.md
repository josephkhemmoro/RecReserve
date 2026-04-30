# RecReserve Feature Inventory

_Generated 2026-04-20 — a full audit of what's currently built, wired up, and shipping vs. what exists in the code but isn't in use._

This is a practical snapshot so we can see exactly what we're working with before moving forward. Every feature is categorized as:

- **ACTIVE** — fully built and reachable from the app's main navigation
- **PARTIAL** — built but incomplete or has missing pieces / broken links
- **ORPHANED** — code exists but nothing navigates to it, or it's a stub

---

## 1. Mobile App (`apps/mobile`)

Expo React Native app for players. Routes live under `apps/mobile/app/` (Expo Router).

### 1.1 Main Tabs — all ACTIVE

Defined in `app/(tabs)/_layout.jsx`. Four visible tabs + one hidden notifications screen.

| Tab | File | Status | Summary |
|---|---|---|---|
| Home | `app/(tabs)/index.jsx` | ACTIVE | Hero carousel, streak strip, 5 sub-tabs (About / Play / Book / Memberships / Events), floating book button, next-session card |
| Bookings | `app/(tabs)/reservations.jsx` | ACTIVE | Upcoming + past reservations, cancel (single or series), participant management, kudos prompts, play-again, leave reservation |
| Discover | `app/(tabs)/clubs.jsx` | ACTIVE | My clubs, search, join / leave / switch clubs (multi-club support) |
| Profile | `app/(tabs)/profile.jsx` | ACTIVE | Edit info, avatar upload, membership tier + benefits, streak, kudos, switch club, sign out |
| Notifications | `app/(tabs)/notifications.jsx` | ACTIVE (hidden tab, `href: null`) | History + realtime updates, mark read, tap-to-navigate |

### 1.2 Home Sub-tabs — all ACTIVE

| Sub-tab | Component | Summary |
|---|---|---|
| About | `components/home/AboutTab.jsx` | Next session, announcements, open spots, browse players |
| Play | `components/home/PlayTab.jsx` | Quick actions (Create Game / Open Games / Open Spots / Groups), games needing players, my groups |
| Book | `components/home/BookTab.jsx` | Demand heatmap, court list, duration picker, link into booking flow |
| Memberships | `components/home/MembershipsTab.jsx` | Tier list + benefits, upgrade CTA |
| Events | `components/home/EventsTab.jsx` | Upcoming + past events, registration status |

### 1.3 Court Booking Flow — ACTIVE end-to-end

1. `app/courts/select.jsx` — date picker (today + 90 days), court list, hourly rate, tier discount, demand heatmap
2. `app/courts/[courtId]/book.jsx` — time + duration picker, realtime availability via Supabase subscription, price with tier benefits
3. `app/booking/confirm.jsx` — full confirmation, server-side `validate-booking`, Stripe payment sheet, streak update
4. `app/booking/success.jsx` — animated success, recent partners, next-step CTAs

### 1.4 Social & Community Features

| Feature | Files | Status | Notes |
|---|---|---|---|
| Open Spots (feed) | `app/open-spots/index.jsx` | ACTIVE | Browse + join spots, track own requests |
| My Open Spots | `app/open-spots/my-spots.jsx` | ACTIVE | Manage posted spots, accept/decline requests |
| Create Open Spot | `components/openSpots/CreateOpenSpotModal` | ACTIVE | Triggered from reservation cards |
| Games — list | `app/games/index.jsx` | ACTIVE | Browse + join open games |
| Games — create | `app/games/create.jsx` | ACTIVE | Pick sport / format / skill / date / time |
| Games — detail | `app/games/[gameId].jsx` | **MISSING** | List + PlayTab navigate here, screen doesn't exist → **crash** |
| Groups — list | `app/groups/index.jsx` | ACTIVE | Browse + join public play groups |
| Groups — detail | `app/groups/[groupId].jsx` | **MISSING** | Navigation exists, screen doesn't → **crash** |
| Groups — create | `app/groups/create.jsx` | **MISSING** | Button links to it, screen doesn't → **crash** |
| Leagues — list | `app/leagues/index.jsx` | ACTIVE | Browse leagues with format + entry fee |
| Leagues — detail | `app/leagues/[leagueId].jsx` | **MISSING** | Would show standings, registration, matchups → **crash** |
| Programs — list | `app/programs/index.jsx` | ACTIVE | Browse lesson series, clinics, camps, academy, drop-in |
| Programs — detail | `app/programs/[programId].jsx` | ACTIVE | Register / unregister, capacity enforcement (no payment yet) |
| Events — detail | `app/events/[eventId].jsx` | ACTIVE | Register with Stripe (`create-event-payment`), capacity, unregister |
| Players — list | `app/players/index.jsx` | ACTIVE | Browse members, search, sort by streak/kudos |
| Player profile | `app/player/[userId].jsx` | ACTIVE | Stats, streak, kudos, attendance, top partners |
| Club profile | `app/club/[clubId].jsx` | PARTIAL | **Doesn't show a profile** — just selects the club and redirects home. No amenities/hours/contact/gallery view |

### 1.5 Authentication — ACTIVE

- `app/(auth)/login.jsx` — email/password
- `app/(auth)/register.jsx` — sign-up
- `app/_layout.jsx` — session init, conditional routing, push registration, membership auto-setup

### 1.6 Zustand Stores (`store/`)

| Store | Status |
|---|---|
| authStore, clubStore, bookingStore, notificationStore, streakStore, membershipStore, openSpotsStore, kudosStore, analyticsStore | ACTIVE |
| feedStore | PARTIAL — exists but not clearly wired into visible UI |
| clubProfileStore | PARTIAL — superseded by inline pattern |

### 1.7 Orphaned Mobile Code

- `app/booking/detail/[reservationId].jsx` — full reservation detail screen exists but is never navigated to (UI uses inline cards + modals)
- `components/feed/*` (ActivityFeed, FeedItem, OpenSpotFeedItem, EventFeedItem) — built but not rendered in any active screen
- `components/clubProfile/*` (ClubTiersList, ClubPhotoGallery, ClubEventsList) — built but only partial use since `/club/[clubId]` doesn't render a profile

---

## 2. Admin Dashboard (`apps/admin`)

Next.js App Router dashboard. All pages under `src/app/(dashboard)/`. Nav sidebar defined in `src/app/(dashboard)/layout.tsx`.

### 2.1 Sidebar Navigation — 6 sections, 19 linked pages

| Section | Items |
|---|---|
| **Overview** | Dashboard |
| **Operations** | Courts, Reservations, Events, Programs, Leagues, Front Desk, Weather Closure, Booking Policies |
| **Members** | Members, Membership Tiers |
| **Engagement** | Announcements, Push Campaigns, Templates, Comm History |
| **Analytics** | Reports |
| **Configuration** | Booking Rules, Club Settings, Audit Log |

### 2.2 All Admin Features — ACTIVE

| Feature | File | Summary |
|---|---|---|
| Dashboard | `(dashboard)/page.tsx` | Live stat cards (utilization, members, reservations, revenue, no-shows), 7-day sparkline trends, social activity, court occupancy heatmap, revenue-by-court chart, today's schedule with mark no-show, setup checklist, Stripe connect banner |
| Courts | `(dashboard)/courts/page.tsx` | CRUD + weekly availability per day, free court toggle, quick apply (all/weekdays) |
| Reservations | `(dashboard)/reservations/page.tsx` | List + filter (status, date range), mark no-show, cancel, audit-log entries |
| Members | `(dashboard)/members/page.tsx` | Search, tier assignment, status control (active/trial/suspended/cancelled), add credit modal, realtime sync |
| Member detail | `(dashboard)/members/[memberId]/page.tsx` | Individual profile (stats, streak, bookings, kudos, credit) — reached only via "View" button in Members table |
| Membership Tiers | `(dashboard)/tier-pricing/page.tsx` | CRUD tiers with discount %, free-courts toggle, color picker |
| Booking Rules | `(dashboard)/booking-rules/page.tsx` | Global caps: max duration, advance window, cancel cutoff, max active bookings |
| Booking Policies | `(dashboard)/booking-policies/page.tsx` | Granular per-tier/per-court overrides, priority ordering, blackout periods, recurring booking settings, cancellation fees |
| Events | `(dashboard)/events/page.tsx` | CRUD events (open play, clinic, tournament, lesson), registrant list |
| Programs | `(dashboard)/programs/page.tsx` | CRUD lesson series/clinics/camps/academy/drop-in, instructor + court assignment, member pricing, status workflow |
| Leagues | `(dashboard)/leagues/page.tsx` | CRUD leagues (ladder, round robin, knockout, league), scoring system, entry fees |
| Weather Closure | `(dashboard)/weather-closure/page.tsx` | Single/all-courts closure, auto-cancels affected reservations, notifies players via push + in-app |
| Announcements | `(dashboard)/announcements/page.tsx` | Compose, target audience (all / tier), push + in-app, optional image, send history |
| Push Campaigns | `(dashboard)/push-campaigns/page.tsx` | Targeted pushes (all, lapsed 14+d, no-shows 30d, specific tier) |
| Message Templates | `(dashboard)/message-templates/page.tsx` | Template library with merge fields + seed-defaults button |
| Comm History | `(dashboard)/communications/page.tsx` | Audit of every message (push/email/SMS/in-app) with channel + status filters |
| Front Desk | `(dashboard)/front-desk/page.tsx` | Today's schedule, member search, check-in action |
| Reports | `(dashboard)/reports/page.tsx` | Revenue / booking / member metrics with 7d/30d/90d/all ranges, utilization by hour + day, program fill rates |
| Club Settings | `(dashboard)/settings/page.tsx` | Club info, logo upload with compression |
| Audit Log | `(dashboard)/audit-log/page.tsx` | All admin actions with entity type + date filters |

### 2.3 Unlisted (but intentionally) Pages — ACTIVE

Not in the sidebar by design — they're entry/callback points:

| Page | File | How it's reached |
|---|---|---|
| Onboarding wizard | `(dashboard)/onboarding/page.tsx` | Auto-redirected if admin has no `club_id` (4 steps: club → first court → booking rules → done) |
| Stripe return | `(dashboard)/stripe-return/page.tsx` | Callback URL after Stripe Connect onboarding |
| Login | `(auth)/login/page.tsx` | Unauthenticated entry, role-gated to admins |

### 2.4 Admin API Routes

| Route | Purpose |
|---|---|
| `POST /api/push` | Proxies Expo push notifications (used by announcements + automated notifications) |

### 2.5 Admin — Identified Gaps (not blockers)

- CSV export buttons on Reports but full export implementation partial
- No bulk operations (bulk suspend, bulk closure)
- No standalone coach/instructor management page (coaches referenced in Programs only)
- No refund UI surfaced in Reservations or Reports (refund logic lives in `process-refund` edge function)
- No pagination — all list pages capped at 200–250 rows

---

## 3. Backend (`supabase/`)

### 3.1 Edge Functions — 21 total, all deployed

| Category | Functions |
|---|---|
| Payments | `create-payment-intent`, `create-event-payment`, `process-refund`, `finalize-booking` |
| Club setup | `create-club-subscription`, `create-connect-account` |
| Notifications | `notify-booking-confirmation`, `notify-booking-reminder`, `notify-cancellation`, `notify-event-reminder`, `notify-waitlist-promotion`, `daily-digest`, `nudge-lapsed-players`, `smart-notifications`, `send-announcement`, `send-push-campaign` |
| Webhooks | `stripe-connect-webhook`, `subscription-webhook` |
| Booking/game logic | `validate-booking`, `promote-waitlist`, `update-streaks` |

### 3.2 Migrations

30 migrations total. Most recent:

- `20260409_social_play_layer.sql` — open games + play groups
- `20260409_reservation_participants.sql` — participants table for spot requests
- `20260408_programs_and_organized_play.sql` — programs, leagues, league matches, standings
- `20260407_events_rls.sql` — event RLS policies
- `20260406_club_member_reservations_select.sql` — member visibility rules
- `20260331_club_profile.sql` — club photos + announcements
- `20260330_feed_and_open_spots.sql` — activity feed + open spot listings

### 3.3 Core Tables

Users, Clubs, Courts, Court Availability, Court Closures, Reservations, Reservation Participants, Reservation Check-Ins, Booking Rules, Booking Policies, Events, Event Registrations, Event Attendance, Memberships, Membership Tiers, Programs, Program Registrations, Leagues, League Players, League Matches, Notifications, Payment Records, Audit Logs, Open Games, Open Spots, Spot Requests, Play Groups, Play Connections, Player Profiles, Player Streaks, Kudos, Feed Events, Announcements, Push Campaigns.

Reservations use a `btree_gist` exclusion constraint to make double-booking structurally impossible.

---

## 4. What's Actually Being Used Right Now

### 4.1 Mobile — actively shipping

Auth · Club discovery / join / switch · Full booking flow (select → time → confirm → pay → success) · Reservations list + cancel + series-cancel · Open spots (post/browse/join/manage) · Games (browse + create) · Groups browse · Leagues browse · Programs browse + register · Events register + pay · Players directory + profiles · Home + all 5 sub-tabs · Notifications (history + realtime) · Profile (edit, avatar, tier, streak, kudos) · Play streak tracking + milestones + freezes · Kudos give/receive

### 4.2 Admin — actively shipping

Every sidebar item works. All 19 primary admin pages plus onboarding, Stripe return, and login are production-ready. CRUD + filters + audit logging across the board.

### 4.3 Mobile — broken / will crash when tapped

- `/games/[gameId]` — games list + PlayTab link here, **screen missing**
- `/groups/[groupId]` — groups list + PlayTab link here, **screen missing**
- `/groups/create` — "Create group" button, **screen missing**
- `/leagues/[leagueId]` — leagues list links here, **screen missing**

### 4.4 Mobile — orphaned (code exists, nothing uses it)

- `app/booking/detail/[reservationId].jsx` — full detail screen, never linked
- `components/feed/*` — ActivityFeed + items, not rendered anywhere
- `components/clubProfile/*` — built, but `/club/[clubId]` doesn't show a profile
- `clubProfileStore`, `feedStore` — defined but not driving any live UI

### 4.5 Mobile — partial

- `/club/[clubId]` — selects club + redirects home instead of showing a real club profile page (amenities, hours, contact, gallery all missing from the UI)

---

## 5. Known Technical Debt (from `TODO_TRUST_HARDENING.md`)

**High priority — blocking production payments:**
1. End-to-end test of `finalize-booking` edge function
2. Add webhook handler for `payment_intent.succeeded/failed`

**Medium:**
3. `process-refund` should track `payment_records` status
4. Role-based admin permission gates
5. Tests for `validate_booking`, state transitions, payment consistency, refunds

**Low:**
6. Stabilize `validate-booking` JWT handling (fallback works)

---

## 6. Docs in `docs/`

| File | What it covers |
|---|---|
| `DATA_MODEL.md` | Entity relationships, reservation state machine |
| `FAILURE_MODES.md` | Payment-success/write-failure, duplicates, concurrent bookings, idempotency |
| `LAUNCH_CHECKLIST.md` | Stripe + Supabase env setup, webhook registration |
| `PERFORMANCE_NOTES.md` | Query benchmarks, materialized-view recommendations |
| `QA_MATRIX.md` | Test cases for booking, cancel, membership, refund, no-show, events, leagues |
| `UX_AUDIT.md` | Mobile nav issues, booking UX strengths, social-flow discoverability |
| `FEATURE_INVENTORY.md` | **This file** |

---

## 7. Bottom Line

**What works today:** the full admin surface (every sidebar page) and the core mobile loop (auth → find club → book court → pay → manage reservations → cancel → receive notifications). Social features (open spots, games create/browse, groups browse, leagues browse, programs, events, players, kudos, streaks) are all live.

**What blocks a polished ship:** four missing mobile detail screens (`games/[gameId]`, `groups/[groupId]`, `groups/create`, `leagues/[leagueId]`) that will crash the app when tapped, and the `/club/[clubId]` profile that currently just redirects instead of rendering.

**What we've built but aren't showing users:** the reservation detail screen, the activity feed component set, and the club-profile component set. Each represents a feature that's mostly coded but not plugged into navigation.

**What's at risk in prod:** payment finalization + webhook handling per `TODO_TRUST_HARDENING.md`.
