import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useOpenSpotsStore = create((set, get) => ({
  openSpots: [],
  isLoading: false,
  mySpots: [],
  mySpotRequests: {},
  mySentRequests: [],
  isSending: false,
  error: null,

  fetchOpenSpots: async (clubId) => {
    if (!clubId) return
    set({ isLoading: true, error: null })
    try {
      const now = new Date().toISOString()

      const { data, error } = await supabase
        .from('open_spots')
        .select(`
          *,
          poster:users!open_spots_user_id_fkey(id, full_name, avatar_url),
          reservation:reservations!open_spots_reservation_id_fkey(
            start_time, end_time,
            court:courts(name)
          )
        `)
        .eq('club_id', clubId)
        .eq('is_active', true)
        .gt('reservation.start_time', now)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Filter out spots where reservation join returned null (past reservations)
      const validSpots = (data || []).filter((s) => s.reservation)

      // Fetch request counts for each spot
      const spotIds = validSpots.map((s) => s.id)
      let requestCounts = {}
      let acceptedCounts = {}

      if (spotIds.length > 0) {
        const { data: requests } = await supabase
          .from('spot_requests')
          .select('open_spot_id, status')
          .in('open_spot_id', spotIds)

        for (const req of requests || []) {
          if (req.status === 'pending') {
            requestCounts[req.open_spot_id] = (requestCounts[req.open_spot_id] || 0) + 1
          }
          if (req.status === 'accepted') {
            acceptedCounts[req.open_spot_id] = (acceptedCounts[req.open_spot_id] || 0) + 1
          }
        }
      }

      const enriched = validSpots.map((s) => ({
        ...s,
        request_count: requestCounts[s.id] || 0,
        accepted_count: acceptedCounts[s.id] || 0,
      }))

      set({ openSpots: enriched, isLoading: false })
    } catch (err) {
      console.error('Error fetching open spots:', err)
      set({ error: err.message || 'Failed to load open spots', isLoading: false })
    }
  },

  fetchMySpots: async (userId, clubId) => {
    if (!userId || !clubId) return
    try {
      const { data, error } = await supabase
        .from('open_spots')
        .select(`
          *,
          poster:users!open_spots_user_id_fkey(id, full_name, avatar_url),
          reservation:reservations!open_spots_reservation_id_fkey(
            start_time, end_time,
            court:courts(name)
          )
        `)
        .eq('user_id', userId)
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const spots = (data || []).filter((s) => s.reservation)

      // Get request counts
      const spotIds = spots.map((s) => s.id)
      let requestCounts = {}
      let acceptedCounts = {}

      if (spotIds.length > 0) {
        const { data: requests } = await supabase
          .from('spot_requests')
          .select('open_spot_id, status')
          .in('open_spot_id', spotIds)

        for (const req of requests || []) {
          if (req.status === 'pending') {
            requestCounts[req.open_spot_id] = (requestCounts[req.open_spot_id] || 0) + 1
          }
          if (req.status === 'accepted') {
            acceptedCounts[req.open_spot_id] = (acceptedCounts[req.open_spot_id] || 0) + 1
          }
        }
      }

      set({
        mySpots: spots.map((s) => ({
          ...s,
          request_count: requestCounts[s.id] || 0,
          accepted_count: acceptedCounts[s.id] || 0,
        })),
      })
    } catch (err) {
      console.error('Error fetching my spots:', err)
    }
  },

  fetchRequestsForSpot: async (spotId) => {
    try {
      const { data, error } = await supabase
        .from('spot_requests')
        .select('*, requester:users!spot_requests_requester_id_fkey(id, full_name, avatar_url)')
        .eq('open_spot_id', spotId)
        .order('created_at', { ascending: true })

      if (error) throw error

      set((state) => ({
        mySpotRequests: { ...state.mySpotRequests, [spotId]: data || [] },
      }))
    } catch (err) {
      console.error('Error fetching spot requests:', err)
    }
  },

  fetchMySentRequests: async (userId) => {
    if (!userId) return
    try {
      const { data, error } = await supabase
        .from('spot_requests')
        .select('*')
        .eq('requester_id', userId)

      if (error) throw error
      set({ mySentRequests: data || [] })
    } catch (err) {
      console.error('Error fetching sent requests:', err)
    }
  },

  createOpenSpot: async (params) => {
    const { reservationId, userId, clubId, spotsNeeded, description, skillLevel } = params
    set({ isSending: true, error: null })
    try {
      // Remove any existing inactive spot for this reservation (handles legacy soft-closed rows)
      await supabase
        .from('open_spots')
        .delete()
        .eq('reservation_id', reservationId)
        .eq('is_active', false)

      const { error } = await supabase.from('open_spots').insert({
        reservation_id: reservationId,
        user_id: userId,
        club_id: clubId,
        spots_needed: spotsNeeded,
        description: description || null,
        skill_level: skillLevel || null,
      })

      if (error) throw error

      set({ isSending: false })
      // Re-fetch
      await Promise.all([
        get().fetchOpenSpots(clubId),
        get().fetchMySpots(userId, clubId),
      ])
      return true
    } catch (err) {
      console.error('Error creating open spot:', err)
      set({ error: err.message || 'Failed to create open spot', isSending: false })
      return false
    }
  },

  closeSpot: async (spotId) => {
    try {
      const { error } = await supabase
        .from('open_spots')
        .delete()
        .eq('id', spotId)

      if (error) throw error
      // Update local state — remove entirely so the reservation can be reposted
      set((state) => ({
        openSpots: state.openSpots.filter((s) => s.id !== spotId),
        mySpots: state.mySpots.filter((s) => s.id !== spotId),
      }))
      return true
    } catch (err) {
      console.error('Error closing spot:', err)
      return false
    }
  },

  sendRequest: async (spotId, requesterId, message) => {
    set({ isSending: true, error: null })
    try {
      const { error: insertError } = await supabase.from('spot_requests').insert({
        open_spot_id: spotId,
        requester_id: requesterId,
        message: message || null,
      })

      if (insertError) throw insertError

      // Notify spot owner
      try {
        const { data: spot } = await supabase
          .from('open_spots')
          .select('user_id, club_id')
          .eq('id', spotId)
          .single()

        const { data: requester } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', requesterId)
          .single()

        if (spot?.user_id) {
          await supabase.from('notifications').insert({
            user_id: spot.user_id,
            club_id: spot.club_id,
            title: 'Player wants to join! 🎾',
            body: `${requester?.full_name || 'Someone'} wants to join your court session`,
            type: 'spot_request',
            read: false,
          })
        }
      } catch (notifErr) {
        console.warn('Spot request notification failed:', notifErr)
      }

      // Update local state
      set((state) => ({
        mySentRequests: [
          ...state.mySentRequests,
          { id: '', open_spot_id: spotId, requester_id: requesterId, status: 'pending', message: message || null, created_at: new Date().toISOString() },
        ],
        isSending: false,
      }))
      return true
    } catch (err) {
      console.error('Error sending request:', err)
      set({ error: err.message || 'Failed to send request', isSending: false })
      return false
    }
  },

  respondToRequest: async (requestId, status, spotOwnerName) => {
    try {
      // Get the request first for requester_id and spot info
      const { data: reqData } = await supabase
        .from('spot_requests')
        .select('requester_id, open_spot_id, open_spot:open_spots(club_id)')
        .eq('id', requestId)
        .single()

      const { error: updateError } = await supabase
        .from('spot_requests')
        .update({ status })
        .eq('id', requestId)

      if (updateError) throw updateError

      // Notify requester
      if (reqData?.requester_id) {
        const title = status === 'accepted' ? "You're in! 🎾" : 'Spot update'
        const body = status === 'accepted'
          ? `${spotOwnerName} accepted your request to play!`
          : `${spotOwnerName} couldn't accommodate your request this time`
        const type = status === 'accepted' ? 'spot_accepted' : 'spot_declined'

        try {
          await supabase.from('notifications').insert({
            user_id: reqData.requester_id,
            club_id: reqData.open_spot?.club_id || null,
            title,
            body,
            type,
            read: false,
          })
        } catch (notifErr) {
          console.warn('Response notification failed:', notifErr)
        }
      }

      // If accepted, check if spot should auto-close
      if (status === 'accepted' && reqData?.open_spot_id) {
        const { data: spot } = await supabase
          .from('open_spots')
          .select('spots_needed')
          .eq('id', reqData.open_spot_id)
          .single()

        const { count } = await supabase
          .from('spot_requests')
          .select('*', { count: 'exact', head: true })
          .eq('open_spot_id', reqData.open_spot_id)
          .eq('status', 'accepted')

        if (spot && count >= spot.spots_needed) {
          await supabase
            .from('open_spots')
            .update({ is_active: false })
            .eq('id', reqData.open_spot_id)
        }

        // Re-fetch requests for this spot
        await get().fetchRequestsForSpot(reqData.open_spot_id)
      }

      return true
    } catch (err) {
      console.error('Error responding to request:', err)
      return false
    }
  },

  reset: () =>
    set({
      openSpots: [],
      isLoading: false,
      mySpots: [],
      mySpotRequests: {},
      mySentRequests: [],
      isSending: false,
      error: null,
    }),
}))
