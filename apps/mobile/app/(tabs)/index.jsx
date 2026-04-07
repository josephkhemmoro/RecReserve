import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  RefreshControl, ScrollView, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { useStreakStore } from '../../store/streakStore'
import { useNotificationStore } from '../../store/notificationStore'
import { useOpenSpotsStore } from '../../store/openSpotsStore'
import { useMembershipStore } from '../../store/membershipStore'
import { toLocalISO } from '../../lib/dateUtils'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Icon, Button, Avatar } from '../../components/ui'
import { ClubHeader, HeroCarousel, StreakStrip, HomeTabs, FloatingBookButton } from '../../components/home'
import { AboutTab } from '../../components/home/tabs/AboutTab'
import { BookTab } from '../../components/home/tabs/BookTab'
import { MembershipsTab } from '../../components/home/tabs/MembershipsTab'
import { EventsTab } from '../../components/home/tabs/EventsTab'
import { PlayTab } from '../../components/home/tabs/PlayTab'

export default function HomeScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub, memberships, setSelectedClub, clubDetail, fetchClubDetail } = useClubStore()
  const { streak, fetchStreak } = useStreakStore()
  const { unreadCount } = useNotificationStore()
  const { openSpots, mySentRequests, fetchOpenSpots, fetchMySentRequests, sendRequest } = useOpenSpotsStore()
  const { tier, fetchMembershipTier } = useMembershipStore()

  const [activeTab, setActiveTab] = useState('About')
  const [nextReservation, setNextReservation] = useState(null)
  const [photos, setPhotos] = useState([])
  const [tiers, setTiers] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [pastEvents, setPastEvents] = useState([])
  const [initialLoad, setInitialLoad] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showClubPicker, setShowClubPicker] = useState(false)

  const clubId = selectedClub?.id
  const userId = user?.id
  const detail = clubDetail || selectedClub

  const fetchAllData = useCallback(async () => {
    if (!clubId || !userId) { setInitialLoad(false); return }
    try {
      const now = toLocalISO(new Date())
      const [resRes, photosRes, tiersRes, annRes, upEvRes, pastEvRes] = await Promise.all([
        supabase.from('reservations').select('*, court:courts(name)')
          .eq('user_id', userId).eq('club_id', clubId).eq('status', 'confirmed')
          .gte('start_time', now).order('start_time', { ascending: true }).limit(1),
        supabase.from('club_photos').select('id, photo_url').eq('club_id', clubId).order('sort_order').limit(6),
        supabase.from('membership_tiers').select('id, name, discount_percent, can_book_free, color').eq('club_id', clubId),
        supabase.from('club_announcements').select('id, title, body, created_at').eq('club_id', clubId).order('created_at', { ascending: false }).limit(3),
        supabase.from('events').select('id, title, event_type, start_time, end_time, max_participants, price, description')
          .eq('club_id', clubId).gt('start_time', now).order('start_time').limit(10),
        supabase.from('events').select('id, title, event_type, start_time, price')
          .eq('club_id', clubId).lte('start_time', now).order('start_time', { ascending: false }).limit(10),
      ])
      setNextReservation((resRes.data || [])[0] || null)
      setPhotos(photosRes.data || [])
      setTiers(tiersRes.data || [])
      setAnnouncements(annRes.data || [])
      setPastEvents(pastEvRes.data || [])

      const events = upEvRes.data || []
      if (events.length > 0) {
        const ids = events.map((e) => e.id)
        const { data: regData } = await supabase.from('event_registrations').select('event_id').in('event_id', ids).eq('status', 'registered')
        const counts = {}
        for (const r of regData || []) counts[r.event_id] = (counts[r.event_id] || 0) + 1
        setUpcomingEvents(events.map((e) => ({ ...e, registered_count: counts[e.id] || 0 })))
      } else {
        setUpcomingEvents([])
      }
    } catch (err) {
      console.error('Error fetching home data:', err)
    } finally {
      setInitialLoad(false)
    }
  }, [clubId, userId])

  useEffect(() => {
    setActiveTab('About')
    fetchAllData()
    if (userId && clubId) {
      fetchStreak(userId, clubId)
      fetchClubDetail(clubId)
      fetchOpenSpots(clubId)
      fetchMySentRequests(userId)
      fetchMembershipTier(userId, clubId)
    }
  }, [userId, clubId])

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([
      fetchAllData(),
      userId && clubId ? fetchStreak(userId, clubId) : Promise.resolve(),
      clubId ? fetchClubDetail(clubId) : Promise.resolve(),
      clubId ? fetchOpenSpots(clubId) : Promise.resolve(),
    ])
    setRefreshing(false)
  }

  const sentSpotIds = new Set(mySentRequests.map((r) => r.open_spot_id))

  if (!selectedClub) {
    return (
      <View style={styles.noClub}>
        <Icon name="tennisball-outline" size="lg" color={colors.neutral300} />
        <Text style={styles.noClubTitle}>Welcome to RecReserve</Text>
        <Text style={styles.noClubSub}>Join a club to get started</Text>
        <Button title="Discover Clubs" onPress={() => router.push('/(tabs)/clubs')} variant="primary" size="lg" icon="search-outline" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ClubHeader club={detail} unreadCount={unreadCount} onOpenClubPicker={() => setShowClubPicker(!showClubPicker)} />

      {showClubPicker && (
        <View style={styles.pickerDropdown}>
          {memberships.map((m) => (
            <TouchableOpacity key={m.id} style={[styles.pickerItem, m.club?.id === clubId && styles.pickerItemActive]}
              onPress={() => { if (m.club) setSelectedClub(m.club); setShowClubPicker(false) }}>
              <Avatar uri={m.club?.logo_url} name={m.club?.name || '?'} size="sm" />
              <Text style={[styles.pickerText, m.club?.id === clubId && styles.pickerTextActive]}>{m.club?.name}</Text>
              {m.club?.id === clubId && <Icon name="checkmark" size="sm" color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {initialLoad ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          stickyHeaderIndices={[2]}
        >
          <HeroCarousel photos={photos} clubName={detail?.name} />
          <StreakStrip currentStreak={streak?.current_streak ?? 0} longestStreak={streak?.longest_streak ?? 0} />
          <HomeTabs activeTab={activeTab} onChangeTab={setActiveTab} />

          {activeTab === 'About' && (
            <AboutTab
              club={detail || {}}
              nextReservation={nextReservation}
              openSpots={openSpots}
              announcements={announcements}
              userId={userId}
              clubId={clubId}
              sentSpotIds={sentSpotIds}
              onRequestJoin={(spotId) => sendRequest(spotId, userId)}
            />
          )}
          {activeTab === 'Play' && <PlayTab clubId={clubId} />}
          {activeTab === 'Book' && <BookTab clubId={clubId} tier={tier} />}
          {activeTab === 'Memberships' && <MembershipsTab userTier={tier} tiers={tiers} />}
          {activeTab === 'Events' && <EventsTab upcomingEvents={upcomingEvents} pastEvents={pastEvents} />}
        </ScrollView>
      )}

      <FloatingBookButton />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  noClub: { flex: 1, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing['3xl'] },
  noClubTitle: { ...textStyles.heading2, color: colors.neutral900 },
  noClubSub: { ...textStyles.body, color: colors.neutral500, textAlign: 'center' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pickerDropdown: {
    position: 'absolute', top: 100, left: spacing.lg, right: spacing.lg, zIndex: 50,
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.neutral200, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.base, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.neutral100 },
  pickerItemActive: { backgroundColor: colors.primarySurface },
  pickerText: { flex: 1, ...textStyles.bodyMedium, color: colors.neutral800 },
  pickerTextActive: { color: colors.primary, fontWeight: '600' },
})
