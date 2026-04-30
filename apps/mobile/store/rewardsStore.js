import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'

// Helpers to classify a reward row by status
const isRedeemed = (r) => !!r.redeemed_at
const isExpired = (r) => {
  if (r.redeemed_at) return false
  if (!r.expires_at) return false
  return new Date(r.expires_at).getTime() <= Date.now()
}
const isAvailable = (r) => !isRedeemed(r) && !isExpired(r)

export const useRewardsStore = create(
  persist(
    (set, get) => ({
      rewards: [],
      loading: false,
      error: null,

      fetchRewards: async (userId, clubId) => {
        if (!userId || !clubId) {
          set({ rewards: [], loading: false, error: null })
          return
        }
        set({ loading: true, error: null })
        try {
          const { data, error } = await supabase
            .from('player_rewards')
            .select('*')
            .eq('user_id', userId)
            .eq('club_id', clubId)
            .order('granted_at', { ascending: false })

          if (error) throw error
          set({ rewards: data || [], loading: false })
        } catch (err) {
          console.error('Error fetching player rewards:', err)
          set({
            error: err instanceof Error ? err.message : 'Failed to load rewards',
            loading: false,
          })
        }
      },

      // Derived getters
      availableRewards: () => (get().rewards || []).filter(isAvailable),
      redeemedRewards: () => (get().rewards || []).filter(isRedeemed),
      expiredRewards: () => (get().rewards || []).filter(isExpired),

      clearRewards: () => set({ rewards: [], loading: false, error: null }),
    }),
    {
      name: 'recreserve-rewards',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        rewards: state.rewards,
      }),
    }
  )
)

// Re-exported helpers for use outside the store (e.g. filtering inline)
export const rewardHelpers = { isRedeemed, isExpired, isAvailable }
