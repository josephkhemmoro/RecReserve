import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useMembershipStore } from './membershipStore'

export const useClubStore = create((set, get) => ({
  selectedClub: null,
  memberships: [],
  clubDetail: null,
  clubDetailLoading: false,
  clubDetailError: null,

  setSelectedClub: (club) => {
    set({ selectedClub: club })
    if (club?.id) {
      get().fetchClubDetail(club.id)
    } else {
      set({ clubDetail: null, clubDetailError: null })
      useMembershipStore.getState().clearMembership()
    }
  },

  setMemberships: (memberships) => set({ memberships }),

  fetchClubDetail: async (clubId) => {
    set({ clubDetailLoading: true, clubDetailError: null })
    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, location, logo_url, description, phone, website')
        .eq('id', clubId)
        .single()

      if (error) throw error

      // Also fetch the primary sport from courts
      const { data: courts } = await supabase
        .from('courts')
        .select('sport')
        .eq('club_id', clubId)
        .eq('is_active', true)

      const sports = new Set((courts || []).map((c) => c.sport))
      let sport = 'both'
      if (sports.size === 1) {
        sport = [...sports][0]
      } else if (sports.has('tennis') && sports.has('pickleball')) {
        sport = 'both'
      } else if (sports.has('tennis')) {
        sport = 'tennis'
      } else if (sports.has('pickleball')) {
        sport = 'pickleball'
      }

      set({
        clubDetail: { ...data, sport },
        clubDetailLoading: false,
      })
    } catch (err) {
      console.error('Error fetching club detail:', err)
      set({
        clubDetailError: err instanceof Error ? err.message : 'Failed to load club info',
        clubDetailLoading: false,
      })
    }
  },

  clearClub: () => set({
    selectedClub: null,
    memberships: [],
    clubDetail: null,
    clubDetailError: null,
    clubDetailLoading: false,
  }),
}))
