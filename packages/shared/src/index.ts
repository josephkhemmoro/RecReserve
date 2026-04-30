// DEPRECATED: sport column is no longer used in the UI
export type Sport = 'tennis' | 'pickleball' | 'both'

export type UserRole = 'admin' | 'player'

export type ReservationStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'

export type MembershipTierName = 'standard' | 'premium' | 'guest'

export type EventType = 'open_play' | 'clinic' | 'tournament' | 'lesson' | 'camp' | 'league_match' | 'round_robin' | 'drop_in' | 'private_lesson' | 'group_lesson'

export type NotificationType =
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'cancellation'
  | 'waitlist_promotion'
  | 'event_reminder'
  | 'general'
  | 'announcement'
  | 'spot_request'
  | 'spot_accepted'
  | 'spot_declined'
  | 'streak_milestone'
  | 'lapsed_reminder'
  | 'push_campaign'

export type EventRegistrationStatus = 'registered' | 'cancelled' | 'waitlisted'

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Club {
  id: string
  name: string
  location?: string
  logo_url?: string
  stripe_account_id?: string
  stripe_account_status?: 'not_started' | 'pending' | 'active'
  subscription_status: 'active' | 'inactive' | 'trialing'
  requires_paid_membership?: boolean
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
  recurring_group_id?: string
  is_recurring?: boolean
  cancelled_at?: string
  cancelled_by?: string
  validated_at?: string
  validation_token?: string
  payment_record_id?: string
  cancellation_fee_cents?: number
  created_at: string
  court?: Court
}

export interface Waitlist {
  id: string
  reservation_id: string
  user_id: string
  position: number
  notified_at?: string
  expires_at?: string
  club_id?: string
  court_id?: string
  desired_start?: string
  desired_end?: string
  created_at: string
}

export interface MembershipTier {
  id: string
  club_id: string
  name: string
  discount_percent: number
  can_book_free: boolean
  color?: string
  // Paid memberships
  is_paid?: boolean
  monthly_price_cents?: number
  stripe_product_id?: string | null
  stripe_price_id?: string | null
  is_default?: boolean
  sort_order?: number
  description?: string | null
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
  status?: MembershipStatus
  renewal_date?: string
  trial_ends_at?: string
  suspended_at?: string
  suspended_reason?: string
  cancelled_at?: string
  guest_allowance?: number
  booking_credits?: number
  // Paid memberships (Stripe subscription linkage)
  stripe_customer_id?: string | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean
  pending_tier_id?: string | null
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
  instructor_id?: string
  program_id?: string
  skill_level?: string
  min_participants?: number
  notes?: string
  is_recurring?: boolean
  recurring_rule?: string
  series_id?: string
  member_price?: number
  status?: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string
}

export interface EventRegistration {
  id: string
  event_id: string
  user_id: string
  status: EventRegistrationStatus
  stripe_payment_id?: string
  amount_paid?: number
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
  expires_at?: string
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

// --- Court Closures ---

export interface CourtClosure {
  id: string
  court_id: string
  club_id: string
  starts_at: string
  ends_at: string
  reason: string
  closed_by?: string
  created_at: string
}

// --- Credit Transactions ---

export interface CreditTransaction {
  id: string
  user_id: string
  club_id: string
  amount: number
  type: 'credit' | 'debit'
  description?: string
  created_by?: string
  created_at: string
}

// --- Push Campaigns ---

export type PushCampaignAudience = 'all' | 'no_show' | 'lapsed' | 'tier'

export interface PushCampaign {
  id: string
  club_id: string
  title: string
  body: string
  audience: PushCampaignAudience
  audience_tier_id?: string
  sent_count: number
  sent_at?: string
  created_by?: string
  created_at: string
}

// --- Granular Roles ---

export type StaffRole = 'owner' | 'club_admin' | 'manager' | 'front_desk' | 'coach' | 'finance' | 'readonly_staff'
export type AppRole = StaffRole | 'player' | 'admin' // 'admin' kept for backward compat

export const STAFF_ROLES: readonly StaffRole[] = ['owner', 'club_admin', 'manager', 'front_desk', 'coach', 'finance', 'readonly_staff']

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  club_admin: 'Club Admin',
  manager: 'Manager',
  front_desk: 'Front Desk',
  coach: 'Coach / Pro',
  finance: 'Finance',
  readonly_staff: 'Read-Only Staff',
  player: 'Player',
}

// Permission check helpers
export const ROLE_CAN_MANAGE_BOOKINGS: AppRole[] = ['owner', 'admin', 'club_admin', 'manager', 'front_desk']
export const ROLE_CAN_MANAGE_MEMBERS: AppRole[] = ['owner', 'admin', 'club_admin', 'manager']
export const ROLE_CAN_MANAGE_FINANCE: AppRole[] = ['owner', 'admin', 'club_admin', 'finance']
export const ROLE_CAN_MANAGE_SETTINGS: AppRole[] = ['owner', 'admin', 'club_admin']

// --- Booking Policies ---

export interface BookingPolicy {
  id: string
  club_id: string
  tier_id?: string
  court_id?: string
  name: string
  priority: number
  is_active: boolean

  // Booking windows
  advance_booking_days?: number
  same_day_cutoff_minutes?: number
  max_booking_duration_mins?: number
  min_booking_duration_mins?: number

  // Limits
  max_active_reservations?: number
  max_daily_reservations?: number
  max_weekly_reservations?: number
  max_guest_count?: number

  // Cancellation
  cancellation_cutoff_hours?: number
  cancellation_fee_cents?: number
  no_show_fee_cents?: number

  // Recurring
  allow_recurring?: boolean
  max_recurring_weeks?: number

  // Prime time
  prime_time_start?: string
  prime_time_end?: string
  prime_time_days?: number[]
  prime_time_surcharge_cents?: number
  prime_time_tier_only?: boolean

  // Blackout
  blackout_start?: string
  blackout_end?: string
  blackout_reason?: string

  created_at: string
  updated_at: string
}

// --- Payment Records ---

export type PaymentEntityType = 'reservation' | 'event_registration' | 'membership' | 'cancellation_fee' | 'no_show_fee' | 'credit_purchase'

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refund_pending'
  | 'refunded'
  | 'partially_refunded'
  | 'disputed'
  | 'cancelled'

export interface PaymentRecord {
  id: string
  club_id: string
  user_id: string
  entity_type: PaymentEntityType
  entity_id?: string
  amount_cents: number
  platform_fee_cents: number
  net_amount_cents: number
  currency: string
  stripe_payment_intent_id?: string
  stripe_refund_id?: string
  stripe_transfer_id?: string
  idempotency_key?: string
  status: PaymentStatus
  refund_amount_cents: number
  refund_reason?: string
  metadata: Record<string, unknown>
  failure_reason?: string
  created_at: string
  updated_at: string
}

// --- Audit Logs ---

export interface AuditLog {
  id: string
  club_id?: string
  actor_id: string
  actor_role?: string
  action: string
  entity_type: string
  entity_id?: string
  changes?: Record<string, { old: unknown; new: unknown }>
  metadata: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  created_at: string
}

// Common audit actions
export const AUDIT_ACTIONS = {
  RESERVATION_CREATE: 'reservation.create',
  RESERVATION_CANCEL: 'reservation.cancel',
  RESERVATION_STATUS_CHANGE: 'reservation.status_change',
  RESERVATION_NO_SHOW: 'reservation.no_show',
  PAYMENT_CREATE: 'payment.create',
  PAYMENT_REFUND: 'payment.refund',
  PAYMENT_STATUS_CHANGE: 'payment.status_change',
  MEMBER_JOIN: 'membership.join',
  MEMBER_SUSPEND: 'membership.suspend',
  MEMBER_ACTIVATE: 'membership.activate',
  MEMBER_CANCEL: 'membership.cancel',
  MEMBER_STATUS_CHANGE: 'membership.status_change',
  TIER_UPDATE: 'membership.tier_update',
  BOOKING_RULE_UPDATE: 'booking_rule.update',
  BOOKING_POLICY_CREATE: 'booking_policy.create',
  BOOKING_POLICY_UPDATE: 'booking_policy.update',
  BOOKING_POLICY_DELETE: 'booking_policy.delete',
  PRICING_CHANGE: 'pricing.change',
  CREDIT_ADD: 'credit.add',
  CREDIT_DEDUCT: 'credit.deduct',
} as const

// --- Membership Lifecycle ---

export type MembershipStatus = 'trial' | 'active' | 'suspended' | 'expired' | 'cancelled'

export const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatus, string> = {
  trial: 'Trial',
  active: 'Active',
  suspended: 'Suspended',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

// --- Booking Validation Result ---

export interface BookingValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  membership_id?: string
  tier_id?: string
  discount_percent?: number
  can_book_free?: boolean
}

export interface CancellationValidationResult {
  valid: boolean
  errors: string[]
  cancellation_fee_cents: number
  hours_until_start: number
  has_payment: boolean
  amount_paid_cents: number
}

// --- Reservation State Machine ---

export type ReservationState = 'draft' | 'pending_payment' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'refunded'

export const VALID_RESERVATION_TRANSITIONS: Record<ReservationState, ReservationState[]> = {
  draft: ['pending_payment', 'confirmed', 'cancelled'],
  pending_payment: ['confirmed', 'cancelled', 'draft'],
  confirmed: ['cancelled', 'completed', 'no_show'],
  cancelled: ['refunded'],
  completed: ['no_show', 'refunded'],
  no_show: ['refunded'],
  refunded: [],
}

// --- Programs ---

export type ProgramType = 'lesson_series' | 'clinic_series' | 'camp' | 'academy' | 'drop_in_series'
export type ProgramStatus = 'draft' | 'published' | 'registration_open' | 'in_progress' | 'completed' | 'cancelled'

export const PROGRAM_TYPE_LABELS: Record<ProgramType, string> = {
  lesson_series: 'Lesson Series',
  clinic_series: 'Clinic Series',
  camp: 'Camp',
  academy: 'Academy',
  drop_in_series: 'Drop-In Series',
}

export interface Program {
  id: string
  club_id: string
  title: string
  description?: string
  program_type: ProgramType
  start_date: string
  end_date?: string
  day_of_week?: number[]
  start_time?: string
  end_time?: string
  max_participants?: number
  min_participants?: number
  price: number
  member_price?: number
  drop_in_price?: number
  instructor_id?: string
  court_id?: string
  skill_level?: string
  status: ProgramStatus
  registration_opens_at?: string
  registration_closes_at?: string
  created_at: string
  updated_at: string
}

export type ProgramRegistrationStatus = 'registered' | 'waitlisted' | 'cancelled' | 'completed' | 'dropped'

export interface ProgramRegistration {
  id: string
  program_id: string
  user_id: string
  status: ProgramRegistrationStatus
  stripe_payment_id?: string
  amount_paid: number
  registered_at: string
  cancelled_at?: string
  created_at: string
}

// --- Event Attendance ---

export type AttendanceStatus = 'registered' | 'checked_in' | 'no_show' | 'late' | 'excused'

export interface EventAttendance {
  id: string
  event_id: string
  user_id: string
  status: AttendanceStatus
  checked_in_at?: string
  checked_in_by?: string
  notes?: string
  created_at: string
}

// --- Leagues / Organized Play ---

export type LeagueFormat = 'ladder' | 'round_robin' | 'league' | 'knockout'
export type LeagueStatus = 'draft' | 'registration_open' | 'in_progress' | 'completed' | 'cancelled'

export const LEAGUE_FORMAT_LABELS: Record<LeagueFormat, string> = {
  ladder: 'Ladder',
  round_robin: 'Round Robin',
  league: 'League',
  knockout: 'Knockout',
}

export interface League {
  id: string
  club_id: string
  name: string
  description?: string
  format: LeagueFormat
  sport?: string
  skill_level?: string
  start_date: string
  end_date?: string
  match_duration_mins: number
  max_players?: number
  min_players?: number
  entry_fee: number
  member_entry_fee?: number
  points_for_win: number
  points_for_draw: number
  points_for_loss: number
  status: LeagueStatus
  created_at: string
  updated_at: string
}

export type LeaguePlayerStatus = 'active' | 'inactive' | 'substitute' | 'withdrawn'

export interface LeaguePlayer {
  id: string
  league_id: string
  user_id: string
  status: LeaguePlayerStatus
  seed?: number
  stripe_payment_id?: string
  amount_paid: number
  joined_at: string
}

export type MatchStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'forfeit' | 'postponed'

export interface LeagueMatch {
  id: string
  league_id: string
  round?: number
  player1_id?: string
  player2_id?: string
  court_id?: string
  reservation_id?: string
  scheduled_at?: string
  player1_score?: string
  player2_score?: string
  winner_id?: string
  status: MatchStatus
  player1_substitute_id?: string
  player2_substitute_id?: string
  notes?: string
  completed_at?: string
  created_at: string
}

export interface LeagueStanding {
  id: string
  league_id: string
  user_id: string
  rank?: number
  wins: number
  losses: number
  draws: number
  points: number
  matches_played: number
  sets_won: number
  sets_lost: number
  updated_at: string
}

// --- Front Desk ---

export type CheckInMethod = 'manual' | 'qr_code' | 'auto'
export type BookingSource = 'mobile' | 'admin' | 'front_desk' | 'walk_in' | 'system'

export interface ReservationCheckIn {
  id: string
  reservation_id: string
  user_id: string
  checked_in_at: string
  checked_in_by?: string
  method: CheckInMethod
  notes?: string
}

// --- Communications ---

export type MessageCategory =
  | 'booking_reminder'
  | 'booking_confirmation'
  | 'cancellation'
  | 'event_reminder'
  | 'weather_closure'
  | 'membership_welcome'
  | 'membership_expiring'
  | 'no_show_warning'
  | 'payment_receipt'
  | 'general'
  | 'custom'

export type CommunicationChannel = 'push' | 'email' | 'sms' | 'in_app'
export type CommunicationTrigger = 'manual' | 'automated' | 'scheduled' | 'system'
export type CommunicationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced'

export const MESSAGE_CATEGORY_LABELS: Record<MessageCategory, string> = {
  booking_reminder: 'Booking Reminder',
  booking_confirmation: 'Booking Confirmation',
  cancellation: 'Cancellation Notice',
  event_reminder: 'Event Reminder',
  weather_closure: 'Weather Closure',
  membership_welcome: 'Welcome Message',
  membership_expiring: 'Membership Expiring',
  no_show_warning: 'No-Show Warning',
  payment_receipt: 'Payment Receipt',
  general: 'General',
  custom: 'Custom',
}

export const TEMPLATE_MERGE_FIELDS = [
  'member_name', 'club_name', 'court_name', 'date', 'time',
  'amount', 'event_name', 'program_name', 'reason',
] as const

export type TemplateMergeField = typeof TEMPLATE_MERGE_FIELDS[number]

export interface MessageTemplate {
  id: string
  club_id: string
  name: string
  subject: string
  body: string
  category: MessageCategory
  variables: string[]
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CommunicationLogEntry {
  id: string
  club_id: string
  recipient_id?: string
  recipient_email?: string
  channel: CommunicationChannel
  subject?: string
  body: string
  template_id?: string
  trigger_type: CommunicationTrigger
  trigger_source?: string
  entity_type?: string
  entity_id?: string
  status: CommunicationStatus
  failure_reason?: string
  sent_by?: string
  sent_at: string
  created_at: string
}

// --- Player Profiles ---

export type PlayStyle = 'casual' | 'social' | 'competitive' | 'intense'
export type ProfileVisibility = 'public' | 'club_members' | 'connections_only' | 'private'
export type GameFormat = 'singles' | 'doubles' | 'mixed_doubles' | 'social' | 'round_robin'
export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

export const PLAY_STYLE_LABELS: Record<PlayStyle, string> = {
  casual: 'Casual',
  social: 'Social',
  competitive: 'Competitive',
  intense: 'Intense',
}

export const GAME_FORMAT_LABELS: Record<GameFormat, string> = {
  singles: 'Singles',
  doubles: 'Doubles',
  mixed_doubles: 'Mixed Doubles',
  social: 'Social Play',
  round_robin: 'Round Robin',
}

export interface PlayerProfile {
  id: string
  user_id: string
  sports: string[]
  skill_levels: Record<string, string>
  preferred_formats: string[]
  play_style?: PlayStyle
  bio?: string
  years_playing?: number
  preferred_days: number[]
  preferred_time_of_day: string[]
  looking_for_game: boolean
  open_to_sub: boolean
  looking_for_partner: boolean
  profile_visibility: ProfileVisibility
  show_skill_level: boolean
  show_availability: boolean
  updated_at: string
  created_at: string
}

export interface PlayerAvailability {
  id: string
  user_id: string
  day_of_week: number
  start_time: string
  end_time: string
  sport?: string
  note?: string
  is_active: boolean
  created_at: string
}

// --- Open Games ---

export type OpenGameStatus = 'open' | 'full' | 'confirmed' | 'cancelled' | 'completed'
export type GameParticipantStatus = 'joined' | 'invited' | 'requested' | 'declined' | 'removed'

export interface OpenGame {
  id: string
  creator_id: string
  club_id: string
  title?: string
  sport: string
  format: GameFormat
  skill_level: string
  date: string
  start_time: string
  end_time: string
  court_id?: string
  players_needed: number
  max_players: number
  status: OpenGameStatus
  reservation_id?: string
  description?: string
  is_invite_only: boolean
  created_at: string
  updated_at: string
}

export interface OpenGameWithDetails extends OpenGame {
  creator: {
    id: string
    full_name: string
    avatar_url: string | null
  }
  court?: { name: string }
  participants: GameParticipant[]
  joined_count: number
}

export interface GameParticipant {
  id: string
  game_id: string
  user_id: string
  status: GameParticipantStatus
  invited_by?: string
  message?: string
  joined_at: string
  user?: {
    id: string
    full_name: string
    avatar_url: string | null
  }
}

// --- Play Groups ---

export type PlayGroupMemberRole = 'admin' | 'member'
export type PlayGroupMemberStatus = 'active' | 'invited' | 'requested' | 'inactive' | 'removed'

export interface PlayGroup {
  id: string
  club_id: string
  creator_id: string
  name: string
  description?: string
  sport?: string
  skill_level?: string
  recurring_day?: number
  recurring_time?: string
  recurring_duration_mins: number
  preferred_court_id?: string
  max_members: number
  is_public: boolean
  is_active: boolean
  next_session_date?: string
  next_reservation_id?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface PlayGroupMember {
  id: string
  group_id: string
  user_id: string
  role: PlayGroupMemberRole
  status: PlayGroupMemberStatus
  joined_at: string
  user?: {
    id: string
    full_name: string
    avatar_url: string | null
  }
}

// --- Play Connections (Social Graph) ---

export interface PlayConnection {
  id: string
  user_id: string
  partner_id: string
  club_id: string
  times_played: number
  last_played_at: string
  is_favorite: boolean
  is_blocked: boolean
  created_at: string
  updated_at: string
  partner?: {
    id: string
    full_name: string
    avatar_url: string | null
  }
}

// --- Social Notification Types ---
export const SOCIAL_NOTIFICATION_TYPES = [
  'game_invite',
  'game_join',
  'game_full',
  'game_confirmed',
  'group_invite',
  'group_session',
  'group_booking',
  'partner_request',
  'partner_match',
] as const

export type SocialNotificationType = typeof SOCIAL_NOTIFICATION_TYPES[number]
