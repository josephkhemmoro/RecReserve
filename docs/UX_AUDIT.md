# UX Audit Findings

## Mobile App

### Navigation
- **Current:** 4 tabs — Home, Bookings, Discover, Profile
- **Finding:** Games, Groups, Open Spots, Programs, Leagues are all buried behind sub-navigation (Play tab on Home, or deep links). Users won't discover them organically.
- **Recommendation:** Consider adding a 5th "Play" bottom tab that surfaces games, groups, and open spots directly. Or add a floating action button on the Home screen.

### Booking Flow
- **Good:** Clear court selection → time selection → confirm → success path
- **Good:** Price breakdown with tier discount visibility
- **Good:** Policy info card explaining charges and cancellation
- **Issue:** Demand heatmap on court selection is useful but not explained — add a one-line helper
- **Issue:** After booking, `clearBooking()` timing caused flash of empty state (fixed with setTimeout)

### Social Flow
- **Good:** Open spots browse → request → accept/decline is clear
- **Good:** Open games create flow has chip-based selectors (fast)
- **Issue:** No way to get to open spots from the main nav without going through Play tab
- **Issue:** "My Open Spots" requires knowing to tap "My Posts" — not discoverable
- **Recommendation:** Add a notification badge or tab indicator when you have pending spot requests

### Call-to-Action Visibility
- **Good:** Sticky footer buttons on detail screens (Register, Confirm Booking, etc.)
- **Good:** Empty states all have actionable CTAs
- **Issue:** "Find Players" link on reservations is easy to miss (small text)

### Loading States
- **Good:** All list screens show ActivityIndicator centered
- **Good:** Pull-to-refresh on all FlatLists
- **Issue:** Home screen shows 13+ parallel queries — initial load can feel slow

### Empty States
- **Good:** Every list has a descriptive empty state with icon + title + subtitle
- **Good:** Most empty states have a CTA button (Create a Game, etc.)
- **Issue:** Some empty states are generic — "No data" could be more helpful

### Error States
- **Good:** Booking errors show structured "Booking Not Available" card with specific message
- **Issue:** Some errors still show raw JSON or technical messages (e.g., constraint violation codes)
- **Recommendation:** Add an error message mapping layer that converts common Supabase error codes to plain language

### Touch Targets
- **Issue:** Some chip selectors on the game creation screen are small
- **Recommendation:** Minimum 44x44 touch targets per Apple HIG
- **Status:** Most buttons and cards meet the minimum

### Accessibility
- **Issue:** No `accessibilityLabel` props on icons used as buttons
- **Issue:** Color-only indicators (demand dots, status colors) need text alternatives
- **Recommendation:** Add `accessibilityRole="button"` to all TouchableOpacity wrappers

## Admin App

### Dashboard
- **Good:** Setup checklist for new clubs
- **Good:** Stat cards with clear labels
- **Good:** Social activity stats added
- **Issue:** Dashboard loads 15+ queries — can feel slow
- **Recommendation:** Add skeleton loading for each section independently

### Tables
- **Good:** Consistent table layout across all pages
- **Good:** Badge components for status visualization
- **Issue:** No sorting on table columns
- **Issue:** No bulk selection for operations like "cancel all selected"
- **Recommendation:** Add column header sorting for high-traffic tables (reservations, members)

### Forms
- **Good:** Inline forms with clear Save/Cancel buttons
- **Good:** Confirmation dialogs on destructive actions (delete, cancel, no-show)
- **Issue:** Long forms (programs, booking policies) could benefit from section headers
- **Issue:** No form validation messages — just disabled buttons when required fields are empty
- **Recommendation:** Add inline validation with red border + helper text on blur

### Filters
- **Good:** Reservations page has status + date range filters
- **Good:** Reports page has time range selector
- **Good:** Audit log has entity type + date filter
- **Issue:** Members page search is name/email only — add tier filter
- **Issue:** No filter persistence across navigation (filters reset when leaving page)

### Information Hierarchy
- **Good:** PageHeader + Card pattern is consistent
- **Good:** StatCard grids for KPIs
- **Issue:** Reports page has 12 stat cards — overwhelming at first glance. Group them into titled sections.

### Destructive Actions
- **Good:** All destructive actions (delete, cancel, no-show, remove) use `confirm()` dialogs
- **Good:** Audit logging on destructive actions
- **Recommendation:** Consider using a Modal component instead of `confirm()` for better styling

## Priority Fixes

| Fix | Impact | Effort |
|---|---|---|
| Add accessibilityLabel to icon buttons | Accessibility | Small |
| Add sorting to admin tables | Usability | Medium |
| Add inline form validation | Trust | Medium |
| Group report stat cards into sections | Clarity | Small |
| Add tier filter to members page | Usability | Small |
| Add error message mapping for Supabase codes | UX | Medium |
| Surface open spots/games in main navigation | Discovery | Medium |
