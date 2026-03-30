// DEPRECATED: sport column is no longer used in the UI
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
  | 'announcement'

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
  sport?: Sport
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
  club_id: string | null
  title: string
  body: string
  type: NotificationType
  read: boolean
  created_at: string
  club?: {
    name: string
    logo_url: string | null
  } | null
}

// --- Player Streaks ---

export interface PlayerStreak {
  id: string
  user_id: string
  club_id: string
  current_streak: number
  longest_streak: number
  last_play_week: string | null
  streak_frozen_until: string | null
  freezes_remaining: number
  freezes_reset_at: string | null
  updated_at: string
}

export interface StreakMilestone {
  id: string
  user_id: string
  club_id: string
  milestone: number
  achieved_at: string
}

export const STREAK_MILESTONES = [4, 8, 12, 26, 52] as const

export type StreakMilestoneValue = typeof STREAK_MILESTONES[number]

export const STREAK_MILESTONE_LABELS: Record<StreakMilestoneValue, string> = {
  4: '1 Month Strong',
  8: '2 Month Warrior',
  12: 'Quarter Master',
  26: 'Half-Year Hero',
  52: 'Year-Round Legend',
}

export const STREAK_MILESTONE_ICONS: Record<StreakMilestoneValue, string> = {
  4: '🔥',
  8: '⚡',
  12: '🏆',
  26: '👑',
  52: '🎾',
}

// --- Kudos ---

export interface Kudos {
  id: string
  sender_id: string
  receiver_id: string
  reservation_id: string
  club_id: string
  created_at: string
}

export interface KudosWithUsers extends Kudos {
  sender: {
    id: string
    full_name: string
    avatar_url: string | null
  }
  receiver: {
    id: string
    full_name: string
    avatar_url: string | null
  }
}

// --- Availability Heat Map ---

export type SlotDemandLevel = 'open' | 'filling' | 'busy' | 'almost_full'

export interface TimeSlotDemand {
  time: string
  totalCourts: number
  bookedCourts: number
  demandLevel: SlotDemandLevel
}

// --- Activity Feed ---

export type FeedEventType =
  | 'booking'
  | 'streak_milestone'
  | 'kudos'
  | 'event_created'
  | 'member_joined'

export interface FeedEvent {
  id: string
  club_id: string
  actor_id: string
  event_type: FeedEventType
  metadata: Record<string, unknown>
  created_at: string
}

export interface FeedEventWithActor extends FeedEvent {
  actor: {
    id: string
    full_name: string
    avatar_url: string | null
  }
}

// --- Open Spots (Looking for Players) ---

export interface OpenSpot {
  id: string
  reservation_id: string
  user_id: string
  club_id: string
  spots_needed: number
  description: string | null
  skill_level: string | null
  is_active: boolean
  created_at: string
}

export interface OpenSpotWithDetails extends OpenSpot {
  poster: {
    id: string
    full_name: string
    avatar_url: string | null
  }
  reservation: {
    start_time: string
    end_time: string
    court: {
      name: string
    }
  }
  request_count: number
  accepted_count: number
}

export type SpotRequestStatus = 'pending' | 'accepted' | 'declined'

export interface SpotRequest {
  id: string
  open_spot_id: string
  requester_id: string
  status: SpotRequestStatus
  message: string | null
  created_at: string
}

export interface SpotRequestWithUser extends SpotRequest {
  requester: {
    id: string
    full_name: string
    avatar_url: string | null
  }
}

export const SKILL_LEVELS = ['any', 'beginner', 'intermediate', 'advanced'] as const
export type SkillLevel = typeof SKILL_LEVELS[number]

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  any: 'All Levels Welcome',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

// --- Club Profile ---

export interface ClubPhoto {
  id: string
  club_id: string
  photo_url: string
  caption: string | null
  sort_order: number
  uploaded_by: string | null
  created_at: string
}

export interface ClubAnnouncement {
  id: string
  club_id: string
  title: string
  body: string
  audience: string
  image_url: string | null
  created_by: string | null
  created_at: string
}
