import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useKudosStore = create((set, get) => ({
  receivedKudos: [],
  totalReceived: 0,
  sentKudosReservationIds: [],
  isLoading: false,
  isSending: false,
  error: null,

  fetchReceivedKudos: async (userId, clubId) => {
    if (!userId || !clubId) return
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('kudos')
        .select('*, sender:users!kudos_sender_id_fkey(id, full_name, avatar_url)')
        .eq('receiver_id', userId)
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      set({
        receivedKudos: data || [],
        totalReceived: (data || []).length,
        isLoading: false,
      })
    } catch (err) {
      console.error('Error fetching received kudos:', err)
      set({ error: err.message || 'Failed to load kudos', isLoading: false })
    }
  },

  fetchSentKudosIds: async (userId) => {
    if (!userId) return
    try {
      const { data, error } = await supabase
        .from('kudos')
        .select('reservation_id')
        .eq('sender_id', userId)

      if (error) throw error

      set({
        sentKudosReservationIds: (data || []).map((k) => k.reservation_id),
      })
    } catch (err) {
      console.error('Error fetching sent kudos ids:', err)
    }
  },

  sendKudos: async (senderId, receiverId, reservationId, clubId) => {
    set({ isSending: true, error: null })
    try {
      const { error: insertError } = await supabase
        .from('kudos')
        .insert({
          sender_id: senderId,
          receiver_id: receiverId,
          reservation_id: reservationId,
          club_id: clubId,
        })

      if (insertError) throw insertError

      // Add to local sent list
      set((state) => ({
        sentKudosReservationIds: [...state.sentKudosReservationIds, reservationId],
      }))

      // Get sender name for notification
      try {
        const { data: sender } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', senderId)
          .single()

        const senderName = sender?.full_name || 'A fellow player'

        await supabase.from('notifications').insert({
          user_id: receiverId,
          club_id: clubId,
          title: 'Nice match! 🎾',
          body: `${senderName} sent you kudos!`,
          type: 'kudos',
          read: false,
        })
      } catch (notifErr) {
        console.warn('Kudos notification failed (non-blocking):', notifErr)
      }

      set({ isSending: false })
      return true
    } catch (err) {
      console.error('Error sending kudos:', err)
      set({ error: err.message || 'Failed to send kudos', isSending: false })
      return false
    }
  },

  reset: () =>
    set({
      receivedKudos: [],
      totalReceived: 0,
      sentKudosReservationIds: [],
      isLoading: false,
      isSending: false,
      error: null,
    }),
}))
