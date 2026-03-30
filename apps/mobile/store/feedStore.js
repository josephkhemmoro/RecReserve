import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 20

export const useFeedStore = create((set, get) => ({
  feedEvents: [],
  isLoading: false,
  isRefreshing: false,
  hasMore: false,
  error: null,

  fetchFeed: async (clubId, refresh = false) => {
    if (!clubId) return
    set(refresh ? { isRefreshing: true } : { isLoading: true })
    set({ error: null })

    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data, error } = await supabase
        .from('feed_events')
        .select('*, actor:users!feed_events_actor_id_fkey(id, full_name, avatar_url)')
        .eq('club_id', clubId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (error) throw error

      set({
        feedEvents: data || [],
        hasMore: (data || []).length === PAGE_SIZE,
        isLoading: false,
        isRefreshing: false,
      })
    } catch (err) {
      console.error('Error fetching feed:', err)
      set({
        error: err.message || 'Failed to load activity feed',
        isLoading: false,
        isRefreshing: false,
      })
    }
  },

  loadMore: async (clubId) => {
    const { feedEvents, hasMore } = get()
    if (!clubId || !hasMore || feedEvents.length === 0) return

    try {
      const lastCreatedAt = feedEvents[feedEvents.length - 1].created_at

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data, error } = await supabase
        .from('feed_events')
        .select('*, actor:users!feed_events_actor_id_fkey(id, full_name, avatar_url)')
        .eq('club_id', clubId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .lt('created_at', lastCreatedAt)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (error) throw error

      set({
        feedEvents: [...feedEvents, ...(data || [])],
        hasMore: (data || []).length === PAGE_SIZE,
      })
    } catch (err) {
      console.error('Error loading more feed:', err)
    }
  },

  reset: () =>
    set({
      feedEvents: [],
      isLoading: false,
      isRefreshing: false,
      hasMore: false,
      error: null,
    }),
}))
