# RecReserve

Court reservation platform for tennis and pickleball clubs. Players find and join clubs, browse courts, and book time slots. Club admins manage courts, members, events, and reservations from a web dashboard.

## Apps

### Mobile — `apps/mobile`
Expo React Native app for players.

- Find and join clubs
- Browse available courts by sport
- Book time slots with date/time picker
- Pay via Stripe
- View and cancel reservations
- Join waitlists for booked slots
- Multi-club support — switch between clubs

### Admin Dashboard — `apps/admin`
Next.js web app for club administrators.

- Dashboard with live stats (courts, members, reservations, revenue)
- Court management with weekly availability scheduling
- Booking rules configuration
- Member management with tier assignment and suspend/unsuspend
- Reservation calendar grid with cancellation
- Weather closure with bulk cancellation and player notifications
- Event management with registration tracking

### Shared Types — `packages/shared`
TypeScript type definitions shared across apps.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo, React Native, Expo Router, Zustand |
| Admin | Next.js (App Router), Tailwind CSS, TypeScript |
| Backend | Supabase (Postgres, Auth, Realtime, Edge Functions) |
| Payments | Stripe React Native SDK |
| Monorepo | npm workspaces |

## Project Structure

```
├── apps/
│   ├── mobile/          # Expo React Native app
│   │   ├── app/         # Expo Router screens
│   │   ├── store/       # Zustand stores
│   │   └── lib/         # Supabase client
│   └── admin/           # Next.js admin dashboard
│       └── src/
│           ├── app/     # App Router pages
│           ├── lib/     # Shared hooks
│           └── utils/   # Supabase clients
├── packages/
│   └── shared/          # Shared TypeScript types
└── package.json         # Workspace root
```

## Getting Started

### Prerequisites
- Node.js 20+
- npm 9+
- Expo Go app (for mobile testing) or Xcode/Android Studio
- Supabase project

### Install

```bash
npm install
```

### Environment Variables

**Mobile** — `apps/mobile/.env`
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Admin** — `apps/admin/.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Run

```bash
# Mobile
cd apps/mobile
npx expo start

# Admin
cd apps/admin
npm run dev
```

## Database

Supabase Postgres with Row Level Security enabled on all tables. Key tables: `clubs`, `users`, `courts`, `court_availability`, `booking_rules`, `memberships`, `reservations`, `waitlists`, `events`, `event_registrations`, `notifications`.

The `reservations` table uses a `btree_gist` exclusion constraint to prevent double bookings at the database level.

## License

Private — all rights reserved.
