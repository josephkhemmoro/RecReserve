import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const DEFAULT_STREAK = (userId, clubId) => ({
  id: '',
  user_id: userId,
  club_id: clubId,
  current_streak: 0,
  longest_streak: 0,
  last_play_week: null,
  streak_frozen_until: null,
  freezes_remaining: 2,
  freezes_reset_at: null,
  updated_at: new Date().toISOString(),
})

export const useStreakStore = create((set, get) => ({
  streak: null,
  milestones: [],
  isLoading: false,
  error: null,

  fetchStreak: async (userId, clubId) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('player_streaks')
        .select('*')
        .eq('user_id', userId)
        .eq('club_id', clubId)
        .maybeSingle()

      if (error) throw error

      set({
        streak: data || DEFAULT_STREAK(userId, clubId),
        isLoading: false,
      })
    } catch (err) {
      console.error('Error fetching streak:', err)
      set({
        streak: DEFAULT_STREAK(userId, clubId),
        error: err.message || 'Failed to load streak',
        isLoading: false,
      })
    }
  },

  fetchMilestones: async (userId, clubId) => {
    try {
      const { data, error } = await supabase
        .from('streak_milestones')
        .select('*')
        .eq('user_id', userId)
        .eq('club_id', clubId)
        .order('milestone', { ascending: true })

      if (error) throw error

      set({ milestones: data || [] })
    } catch (err) {
      console.error('Error fetching milestones:', err)
      set({ milestones: [] })
    }
  },

  useFreeze: async (userId, clubId) => {
    const { streak } = get()
    if (!streak || streak.freezes_remaining <= 0) return false

    try {
      const now = new Date()
      const day = now.getUTCDay()
      const sunday = new Date(now)
      sunday.setUTCDate(now.getUTCDate() + (7 - day) % 7)
      sunday.setUTCHours(23, 59, 59, 999)
      const sundayStr = sunday.toISOString().split('T')[0]

      const newFreezes = streak.freezes_remaining - 1

      const { error } = await supabase
        .from('player_streaks')
        .update({
          streak_frozen_until: sundayStr,
          freezes_remaining: newFreezes,
          updated_at: now.toISOString(),
        })
        .eq('user_id', userId)
        .eq('club_id', clubId)

      if (error) throw error

      set({
        streak: {
          ...streak,
          streak_frozen_until: sundayStr,
          freezes_remaining: newFreezes,
          updated_at: now.toISOString(),
        },
      })
      return true
    } catch (err) {
      console.error('Error using freeze:', err)
      set({ error: err.message || 'Failed to use freeze' })
      return false
    }
  },

  triggerStreakUpdate: async (userId, clubId) => {
    try {
      await supabase.functions.invoke('update-streaks', {
        body: { user_id: userId, club_id: clubId },
      })
    } catch (err) {
      console.warn('Streak update failed (non-blocking):', err)
    }

    await get().fetchStreak(userId, clubId)
  },

  reset: () => set({ streak: null, milestones: [], isLoading: false, error: null }),
}))
