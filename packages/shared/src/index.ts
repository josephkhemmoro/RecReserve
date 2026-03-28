export type Sport = 'tennis' | 'pickleball' | 'both'

export type UserRole = 'admin' | 'player'

export type ReservationStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show'

export type MembershipTierName = 'standard' | 'premium' | 'guest'

export type EventType = 'open_play' | 'clinic' | 'tournament' | 'lesson'

export type NotificationType =
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'cancellation'
  | 'waitlist_promotion'
  | 'event_reminder'
  | 'general'

export type EventRegistrationStatus = 'registered' | 'cancelled' | 'waitlisted'

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Club {
  id: string
  name: string
  location?: string
  logo_url?: string
  stripe_account_id?: string
  subscription_status: 'active' | 'inactive' | 'trialing'
  created_at: string
}

export interface User {
  id: string
  full_name: string
  email: string
  role: UserRole
  club_id?: string
  avatar_url?: string
  phone?: string
  push_token?: string
  created_at: string
}

export interface Court {
  id: string
  club_id: string
  name: string
  sport: Sport
  is_active: boolean
  hourly_rate: number
  is_free: boolean
  created_at: string
}

export interface CourtAvailability {
  id: string
  court_id: string
  day_of_week: DayOfWeek
  open_time: string
  close_time: string
  created_at: string
}

export interface BookingRules {
  id: string
  club_id: string
  max_booking_duration_mins: number
  advance_booking_days: number
  cancellation_cutoff_hours: number
  max_active_bookings_per_user: number
  created_at: string
}

export interface Reservation {
  id: string
  court_id: string
  user_id: string
  club_id: string
  start_time: string
  end_time: string
  status: ReservationStatus
  guest_count: number
  notes?: string
  stripe_payment_id?: string
  amount_paid: number
  reminder_sent?: boolean
  created_at: string
  court?: Court
}

export interface Waitlist {
  id: string
  reservation_id: string
  user_id: string
  position: number
  notified_at?: string
  created_at: string
}

export interface MembershipTier {
  id: string
  club_id: string
  name: string
  discount_percent: number
  can_book_free: boolean
  color?: string
  created_at: string
}

export interface Membership {
  id: string
  user_id: string
  club_id: string
  tier: MembershipTierName
  tier_id: string | null
  start_date: string
  end_date?: string
  is_active: boolean
  stripe_subscription_id?: string
  created_at: string
  membership_tier?: MembershipTier
}

export interface BookingPriceBreakdown {
  court_id: string
  hourly_rate: number
  duration_minutes: number
  discount_percent: number
  final_price: number
  is_free: boolean
}

export interface Event {
  id: string
  club_id: string
  court_id?: string
  title: string
  description?: string
  event_type: EventType
  start_time: string
  end_time: string
  max_participants?: number
  price: number
  created_at: string
}

export interface EventRegistration {
  id: string
  event_id: string
  user_id: string
  status: EventRegistrationStatus
  stripe_payment_id?: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  type: NotificationType
  read: boolean
  created_at: string
}
