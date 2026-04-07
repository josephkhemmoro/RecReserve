# Performance Notes

## Potentially Slow Queries

### 1. validate_booking() SQL Function
- Runs 5-8 queries internally (membership lookup, rules, conflicts, closures, policies)
- **Mitigation:** All queries use indexed columns. The function runs server-side so network latency is minimal.
- **Watch:** If booking_policies table grows large, the loop query could slow down. Currently fine for <100 policies per club.

### 2. Dashboard Stats (Admin)
- Fetches reservations, memberships, courts, court_availability, trends, occupancy, revenue all in parallel
- **Mitigation:** Uses `Promise.all` for parallel fetches. Each query is filtered by club_id (indexed).
- **Watch:** Revenue by court and occupancy heatmap scan all month's reservations. For high-volume clubs (1000+ bookings/month), consider adding a materialized view.

### 3. Reports Page
- Scans all reservations for the time range to compute utilization, revenue, no-show rate
- **Mitigation:** Filtered by club_id and date range. Most queries are aggregate counts.
- **Watch:** "All Time" range on a club with years of data could be slow. Consider adding a monthly aggregation table.

### 4. Open Spots / Games Browse
- Fetches spots/games, then does a second query for participant counts
- **Mitigation:** Limited to 20 items. Count queries use indexed columns.

### 5. Player Directory
- Fetches all club members, then enriches with streaks and kudos counts
- **Mitigation:** Limited by club size. For clubs with 500+ members, add pagination.

## Over-Fetched Screens

### Home Screen
- Fetches: next reservation, photos, tiers, announcements, upcoming events, past events, event registration counts, streaks, club detail, open spots, membership tier
- **13+ parallel queries** on mount
- **Recommendation:** Consider a single `get-home-data` edge function that batches these into one server round-trip.

### Reservations Screen
- Fetches own reservations + participant reservations + booking rules + sent kudos IDs + my spots
- **5 parallel queries** + additional participant reservation fetch
- **Status:** Acceptable for now. Participant join adds one extra query.

## Caching Opportunities

| Data | Cache Strategy | TTL |
|---|---|---|
| Club detail (name, logo, description) | Cache in clubStore, refresh on pull | 5 min |
| Membership tiers | Cache in membershipStore | 10 min |
| Booking rules | Cache in bookingStore | 5 min |
| Court list | Cache locally, refresh on mount | 2 min |
| Player profiles | Don't cache (privacy sensitive) | — |

## Pagination

| Screen | Current | Recommendation |
|---|---|---|
| Reservations | No limit (filtered by user + club) | Fine — typically <100 per user |
| Open Spots | No limit | Add `.limit(20)` + load more |
| Open Games | `.limit(5)` on home, no limit on browse | Add pagination on browse |
| Activity Feed | 20 per page with load more | Already paginated |
| Admin Reports | Scans all | Already has time range filter |
| Admin Reservations | `.limit(200)` | Fine for now |
| Admin Members | No limit | Add pagination for clubs >200 members |
| Audit Log | `.limit(100)` | Add load more |

## Indexes in Place

All critical query paths have covering indexes:
- `reservations(club_id, start_time)` — dashboard, availability
- `reservations(user_id, status, end_time)` — no-show tracking
- `reservations(recurring_group_id)` — series management
- `reservations(court_id)` — conflict detection (plus `no_overlap` exclusion)
- `memberships(user_id, club_id, is_active)` — membership lookup
- `booking_policies(club_id, is_active, priority DESC)` — policy resolution
- `payment_records(user_id)`, `(club_id)`, `(stripe_payment_intent_id)` — payment lookup
- `audit_logs(club_id, created_at DESC)` — audit browsing
- `feed_events(club_id, created_at DESC)` — feed queries
- `open_games(club_id, date, status)` — game browsing
- `play_connections(user_id, club_id)` — partner lookup
