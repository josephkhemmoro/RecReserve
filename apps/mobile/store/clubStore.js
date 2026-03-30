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

      set({
        clubDetail: data,
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
