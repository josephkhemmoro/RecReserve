import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { useStreakStore } from '../../store/streakStore'
import { useFeedStore } from '../../store/feedStore'
import { useNotificationStore } from '../../store/notificationStore'
import { useRebookSuggestion } from '../../lib/useRebookSuggestion'
import { HomeHeader, NextSessionCard, ActionRow, StreakStrip } from '../../components/home'
import { ActivityFeed } from '../../components/feed'

export default function HomeScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const {
    selectedClub,
    memberships,
    setSelectedClub,
  } = useClubStore()
  const { streak, fetchStreak } = useStreakStore()
  const { fetchFeed } = useFeedStore()
  const { unreadCount } = useNotificationStore()

  const [nextReservation, setNextReservation] = useState(null)
  const [upcomingForSuggestion, setUpcomingForSuggestion] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showClubPicker, setShowClubPicker] = useState(false)
  const [openSpots, setOpenSpots] = useState([])
  const [upcomingEvents, setUpcomingEvents] = useState([])

  const fullName = user?.user_metadata?.full_name || 'Player'
  const firstName = fullName.split(' ')[0]

  const rebookSuggestion = useRebookSuggestion(
    user?.id,
    selectedClub?.id,
    upcomingForSuggestion
  )

  const fetchHomeData = useCallback(async () => {
    if (!selectedClub?.id || !user?.id) {
      setLoading(false)
      return
    }

    try {
      const now = new Date().toISOString()

      const [resRes, spotsRes, eventsRes] = await Promise.all([
        supabase
          .from('reservations')
          .select('*, court:courts(name)')
          .eq('user_id', user.id)
          .eq('club_id', selectedClub.id)
          .eq('status', 'confirmed')
          .gte('start_time', now)
          .order('start_time', { ascending: true })
          .limit(3),
        supabase
          .from('open_spots')
          .select(`
            *,
            poster:users!open_spots_user_id_fkey(id, full_name, avatar_url),
            reservation:reservations!open_spots_reservation_id_fkey(
              start_time, end_time,
              court:courts(name)
            )
          `)
          .eq('club_id', selectedClub.id)
          .eq('is_active', true)
          .limit(5),
        supabase
          .from('events')
          .select('id, title, event_type, start_time, end_time, max_participants, price')
          .eq('club_id', selectedClub.id)
          .gt('start_time', now)
          .order('start_time', { ascending: true })
          .limit(3),
      ])

      const upcoming = resRes.data || []
      setNextReservation(upcoming[0] || null)
      setUpcomingForSuggestion(upcoming)

      setOpenSpots((spotsRes.data || []).filter((s) => s.reservation))
      setUpcomingEvents(eventsRes.data || [])

      // Fetch event registration counts
      const eventIds = (eventsRes.data || []).map((e) => e.id)
      if (eventIds.length > 0) {
        const { data: regData } = await supabase
          .from('event_registrations')
          .select('event_id')
          .in('event_id', eventIds)
          .eq('status', 'registered')

        const regCounts = {}
        for (const r of regData || []) {
          regCounts[r.event_id] = (regCounts[r.event_id] || 0) + 1
        }
        setUpcomingEvents((prev) =>
          prev.map((e) => ({ ...e, registered_count: regCounts[e.id] || 0 }))
        )
      }
    } catch (err) {
      console.error('Error fetching home data:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id, selectedClub?.id])

  useEffect(() => {
    fetchHomeData()
    if (user?.id && selectedClub?.id) {
      fetchStreak(user.id, selectedClub.id)
      fetchFeed(selectedClub.id)
    }
  }, [user?.id, selectedClub?.id, fetchHomeData])

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([
      fetchHomeData(),
      user?.id && selectedClub?.id ? fetchStreak(user.id, selectedClub.id) : Promise.resolve(),
      selectedClub?.id ? fetchFeed(selectedClub.id, true) : Promise.resolve(),
    ])
    setRefreshing(false)
  }

  const handleRebook = () => {
    if (!rebookSuggestion) return
    const today = new Date()
    const todayDay = today.getDay()
    const targetDay = rebookSuggestion.dayOfWeek
    const daysUntil = (targetDay - todayDay + 7) % 7 || 7
    const nextDate = new Date(today)
    nextDate.setDate(today.getDate() + daysUntil)
    const dateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`

    router.push(`/courts/${rebookSuggestion.preferredCourtId}/book?date=${dateStr}`)
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* 1. Smart Header */}
      <HomeHeader
        firstName={firstName}
        selectedClub={selectedClub}
        unreadCount={unreadCount}
        rebookSuggestion={rebookSuggestion}
        onToggleClubPicker={() => setShowClubPicker(!showClubPicker)}
        onRebook={handleRebook}
      />

      {/* Club picker dropdown */}
      {showClubPicker && memberships.length > 0 && (
        <View style={styles.clubPickerDropdown}>
          {memberships.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.clubPickerItem,
                m.club?.id === selectedClub?.id && styles.clubPickerItemActive,
              ]}
              onPress={() => {
                if (m.club) setSelectedClub(m.club)
                setShowClubPicker(false)
              }}
            >
              <Text style={[
                styles.clubPickerItemText,
                m.club?.id === selectedClub?.id && styles.clubPickerItemTextActive,
              ]}>
                {m.club?.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.clubPickerItem}
            onPress={() => {
              setShowClubPicker(false)
              router.push('/(tabs)/clubs')
            }}
          >
            <Text style={[styles.clubPickerItemText, { color: '#2563eb' }]}>
              + Join Another Club
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. Next Session Card */}
      <NextSessionCard
        reservation={nextReservation}
        hasClub={!!selectedClub}
      />

      {/* 3. Action Row */}
      <ActionRow clubId={selectedClub?.id} />

      {/* 4. Streak Strip */}
      {selectedClub && (
        <StreakStrip
          currentStreak={streak?.current_streak ?? 0}
          longestStreak={streak?.longest_streak ?? 0}
          freezesRemaining={streak?.freezes_remaining ?? 2}
        />
      )}

      {/* 5. Activity Feed (the main content) */}
      {selectedClub && (
        <ActivityFeed
          clubId={selectedClub.id}
          openSpots={openSpots}
          upcomingEvents={upcomingEvents}
        />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 70,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  clubPickerDropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    overflow: 'hidden',
  },
  clubPickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  clubPickerItemActive: {
    backgroundColor: '#eff6ff',
  },
  clubPickerItemText: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500',
  },
  clubPickerItemTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
})
