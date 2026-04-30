import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'

export const useMembershipStore = create(
  persist(
    (set) => ({
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
            .select(
              'id, tier, tier_id, is_active, status, stripe_subscription_id, stripe_customer_id, current_period_end, cancel_at_period_end, pending_tier_id, guest_allowance, renewal_date, membership_tier:membership_tiers!tier_id(id, name, discount_percent, can_book_free, color, is_paid, monthly_price_cents, description, is_default, benefits)'
            )
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
                stripe_subscription_id: data.stripe_subscription_id,
                stripe_customer_id: data.stripe_customer_id,
                current_period_end: data.current_period_end,
                cancel_at_period_end: data.cancel_at_period_end,
                pending_tier_id: data.pending_tier_id,
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
                    is_paid: tierData.is_paid,
                    monthly_price_cents: tierData.monthly_price_cents,
                    description: tierData.description,
                    is_default: tierData.is_default,
                    benefits: tierData.benefits,
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
    }),
    {
      name: 'recreserve-membership',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        membership: state.membership,
        tier: state.tier,
      }),
    }
  )
)
