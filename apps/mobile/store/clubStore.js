import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import { useMembershipStore } from './membershipStore'

export const useClubStore = create(
  persist(
    (set, get) => ({
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
    }),
    {
      name: 'recreserve-club',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        selectedClub: state.selectedClub,
        memberships: state.memberships,
        clubDetail: state.clubDetail,
      }),
    }
  )
)
