import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useMembershipStore = create((set) => ({
  membership: null,
  tier: null,
  loading: false,
  error: null,

  fetchMembershipTier: async (userId, clubId) => {
    if (!userId || !clubId) {
      set({ membership: null, tier: null, loading: false, error: null })
      return
    }
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('memberships')
        .select('id, tier, tier_id, is_active, status, guest_allowance, renewal_date, membership_tier:membership_tiers(id, name, discount_percent, can_book_free, color)')
        .eq('user_id', userId)
        .eq('club_id', clubId)
        .eq('is_active', true)
        .in('status', ['active', 'trial'])
        .maybeSingle()

      if (error) throw error

      if (data) {
        const tierData = data.membership_tier
        set({
          membership: {
            id: data.id,
            tier: data.tier,
            tier_id: data.tier_id,
            is_active: data.is_active,
            status: data.status,
            guest_allowance: data.guest_allowance,
            renewal_date: data.renewal_date,
          },
          tier: tierData
            ? {
                id: tierData.id,
                name: tierData.name,
                discount_percent: tierData.discount_percent,
                can_book_free: tierData.can_book_free,
                color: tierData.color,
              }
            : null,
          loading: false,
        })
      } else {
        set({ membership: null, tier: null, loading: false })
      }
    } catch (err) {
      console.error('Error fetching membership tier:', err)
      set({
        error: err instanceof Error ? err.message : 'Failed to load membership',
        loading: false,
      })
    }
  },

  clearMembership: () => set({
    membership: null,
    tier: null,
    loading: false,
    error: null,
  }),
}))
