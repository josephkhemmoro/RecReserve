import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useClubProfileStore = create((set) => ({
  profileData: null,
  isLoading: false,
  error: null,

  fetchClubProfile: async (clubId, currentUserId) => {
    if (!clubId) return
    set({ isLoading: true, error: null })

    try {
      // Public data - all fetched in parallel
      const [clubRes, courtCountRes, memberCountRes, photosRes, tiersRes, membershipRes] =
        await Promise.all([
          supabase
            .from('clubs')
            .select('id, name, description, location, phone, website, logo_url')
            .eq('id', clubId)
            .single(),
          supabase
            .from('courts')
            .select('id', { count: 'exact', head: true })
            .eq('club_id', clubId)
            .eq('is_active', true),
          supabase
            .from('memberships')
            .select('id', { count: 'exact', head: true })
            .eq('club_id', clubId)
            .eq('is_active', true),
          supabase
            .from('club_photos')
            .select('*')
            .eq('club_id', clubId)
            .order('sort_order', { ascending: true })
            .limit(20),
          supabase
            .from('membership_tiers')
            .select('id, name, discount_percent, can_book_free, color')
            .eq('club_id', clubId),
          supabase
            .from('memberships')
            .select('id')
            .eq('user_id', currentUserId)
            .eq('club_id', clubId)
            .eq('is_active', true)
            .maybeSingle(),
        ])

      if (clubRes.error) throw clubRes.error

      const isMember = !!membershipRes.data

      // Members-only data
      let announcements = null
      let upcomingEvents = null
      let pastEvents = null

      if (isMember) {
        const now = new Date().toISOString()

        const [annRes, upcomingRes, pastRes] = await Promise.all([
          supabase
            .from('club_announcements')
            .select('*')
            .eq('club_id', clubId)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('events')
            .select('id, title, event_type, start_time, end_time, max_participants, price, description')
            .eq('club_id', clubId)
            .gt('start_time', now)
            .order('start_time', { ascending: true })
            .limit(10),
          supabase
            .from('events')
            .select('id, title, event_type, start_time, price')
            .eq('club_id', clubId)
            .lte('start_time', now)
            .order('start_time', { ascending: false })
            .limit(10),
        ])

        announcements = annRes.data || []

        // Get registered counts for upcoming events
        const upcoming = upcomingRes.data || []
        if (upcoming.length > 0) {
          const eventIds = upcoming.map((e) => e.id)
          const { data: regData } = await supabase
            .from('event_registrations')
            .select('event_id')
            .in('event_id', eventIds)
            .eq('status', 'registered')

          const regCounts = {}
          for (const r of regData || []) {
            regCounts[r.event_id] = (regCounts[r.event_id] || 0) + 1
          }

          upcomingEvents = upcoming.map((e) => ({
            ...e,
            registered_count: regCounts[e.id] || 0,
          }))
        } else {
          upcomingEvents = []
        }

        pastEvents = pastRes.data || []
      }

      set({
        profileData: {
          club: clubRes.data,
          courtCount: courtCountRes.count || 0,
          memberCount: memberCountRes.count || 0,
          photos: photosRes.data || [],
          tiers: tiersRes.data || [],
          announcements,
          upcomingEvents,
          pastEvents,
          isMember,
        },
        isLoading: false,
      })
    } catch (err) {
      console.error('Error fetching club profile:', err)
      set({
        error: err.message || 'Failed to load club profile',
        isLoading: false,
      })
    }
  },

  reset: () => set({ profileData: null, isLoading: false, error: null }),
}))
