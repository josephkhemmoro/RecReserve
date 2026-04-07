import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useAnalyticsStore = create((set, get) => ({
  events: [],

  track: (eventName, properties = {}) => {
    const event = { name: eventName, properties, timestamp: new Date().toISOString() }
    if (__DEV__) console.log('[Analytics]', eventName, properties)
    set((state) => ({ events: [...state.events.slice(-99), event] }))

    // Log social events to feed_events for admin insights (fire-and-forget)
    if (['game_created', 'game_joined', 'group_joined', 'booking_completed', 'invite_sent'].includes(eventName) && properties.club_id && properties.user_id) {
      ;(async () => {
        try {
          await supabase.from('feed_events').insert({
            club_id: properties.club_id, actor_id: properties.user_id,
            event_type: eventName, metadata: properties,
          })
        } catch (_) { /* non-blocking */ }
      })()
    }
  },

  trackBookingCompleted: (userId, clubId, courtId) => get().track('booking_completed', { user_id: userId, club_id: clubId, court_id: courtId }),
  trackGameCreated: (userId, clubId, gameId, format, sport) => get().track('game_created', { user_id: userId, club_id: clubId, game_id: gameId, format, sport }),
  trackGameJoined: (userId, clubId, gameId) => get().track('game_joined', { user_id: userId, club_id: clubId, game_id: gameId }),
  trackGroupJoined: (userId, clubId, groupId) => get().track('group_joined', { user_id: userId, club_id: clubId, group_id: groupId }),
  trackInviteSent: (userId, clubId, targetUserId) => get().track('invite_sent', { user_id: userId, club_id: clubId, target_user_id: targetUserId }),
  trackRebookTapped: (userId, clubId) => get().track('rebook_tapped', { user_id: userId, club_id: clubId }),
  trackPlayAgainTapped: (userId, clubId, reservationId) => get().track('play_again_tapped', { user_id: userId, club_id: clubId, reservation_id: reservationId }),

  reset: () => set({ events: [] }),
}))
