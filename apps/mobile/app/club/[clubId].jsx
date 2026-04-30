import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { colors, spacing } from '../../theme'
import { Icon } from '../../components/ui'
import {
  ClubProfileHeader,
  ClubPhotoGallery,
  ClubAnnouncementsFeed,
  ClubTiersList,
  ClubEventsList,
} from '../../components/clubProfile'

export default function ClubProfileScreen() {
  const { clubId } = useLocalSearchParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const { memberships, setSelectedClub, setMemberships } = useClubStore()

  const [club, setClub] = useState(null)
  const [photos, setPhotos] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [tiers, setTiers] = useState([])
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [pastEvents, setPastEvents] = useState([])
  const [courtCount, setCourtCount] = useState(0)
  const [memberCount, setMemberCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [joining, setJoining] = useState(false)

  const isMember = !!memberships?.find((m) => m.club_id === clubId || m.club?.id === clubId)

  const fetchAll = useCallback(async () => {
    if (!clubId) return
    try {
      const today = new Date().toISOString().split('T')[0]

      const [clubRes, photosRes, announcementsRes, tiersRes, courtsRes, membersRes, upcomingRes, pastRes] = await Promise.all([
        supabase.from('clubs').select('*').eq('id', clubId).single(),
        supabase.from('club_photos').select('*').eq('club_id', clubId).order('created_at', { ascending: false }).limit(20).then((r) => r.error ? { data: [] } : r),
        supabase.from('club_announcements').select('*').eq('club_id', clubId).order('created_at', { ascending: false }).limit(5).then((r) => r.error ? { data: [] } : r),
        supabase.from('membership_tiers').select('*').eq('club_id', clubId).order('sort_order', { ascending: true, nullsFirst: false }),
        supabase.from('courts').select('id', { count: 'exact', head: true }).eq('club_id', clubId).eq('is_active', true),
        supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('club_id', clubId).eq('is_active', true),
        supabase.from('events').select('*').eq('club_id', clubId).gte('start_time', new Date().toISOString()).order('start_time', { ascending: true }).limit(5),
        supabase.from('events').select('*').eq('club_id', clubId).lt('start_time', new Date().toISOString()).order('start_time', { ascending: false }).limit(3),
      ])

      if (clubRes.error) throw clubRes.error
      setClub(clubRes.data)
      setPhotos(photosRes.data || [])
      setAnnouncements(announcementsRes.data || [])
      setTiers(tiersRes.data || [])
      setCourtCount(courtsRes.count || 0)
      setMemberCount(membersRes.count || 0)
      setUpcomingEvents(upcomingRes.data || [])
      setPastEvents(pastRes.data || [])
    } catch (err) {
      console.error('Failed to load club profile:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [clubId])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleJoin = async () => {
    if (!user?.id || !club) return

    if (club.requires_paid_membership) {
      // Defer to club discovery / paid join flow
      Alert.alert('Paid membership required', 'This club requires a paid membership tier. Open the club from the Discover tab to choose a tier and complete payment.')
      return
    }

    setJoining(true)
    try {
      const defaultTier = tiers.find((t) => t.is_default) || tiers.find((t) => !t.is_paid) || null
      const { error } = await supabase.from('memberships').insert({
        user_id: user.id,
        club_id: club.id,
        tier_id: defaultTier?.id || null,
        status: 'active',
        is_active: true,
      })
      if (error) throw error
      // Refresh memberships from DB and select this club
      try {
        const { data: refreshed } = await supabase
          .from('memberships')
          .select('id, club_id, tier, is_active, club:clubs(id, name, location, logo_url)')
          .eq('user_id', user.id)
          .eq('is_active', true)
        setMemberships(refreshed || [])
      } catch {}
      setSelectedClub(club)
      Alert.alert('Welcome!', `You've joined ${club.name}.`)
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to join club')
    } finally {
      setJoining(false)
    }
  }

  const handleEnter = () => {
    setSelectedClub(club)
    router.replace('/(tabs)')
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  if (!club) {
    return (
      <View style={styles.centered}>
        <Icon name="alert-circle-outline" size="lg" color={colors.neutral400} />
        <Text style={styles.emptyTitle}>Club not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}><Icon name="arrow-back" size="md" color={colors.primary} /></TouchableOpacity>
        {isMember ? (
          <TouchableOpacity onPress={handleEnter} style={styles.enterBtn}>
            <Text style={styles.enterText}>Enter Club</Text>
            <Icon name="arrow-forward" size="sm" color={colors.primary} />
          </TouchableOpacity>
        ) : <View style={{ width: 32 }} />}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <ClubProfileHeader
          club={club}
          courtCount={courtCount}
          memberCount={memberCount}
          isMember={isMember}
          onJoin={!isMember ? handleJoin : null}
        />

        {club.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.aboutText}>{club.description}</Text>
          </View>
        ) : null}

        {photos.length > 0 && <ClubPhotoGallery photos={photos} />}

        {announcements.length > 0 && <ClubAnnouncementsFeed announcements={announcements} />}

        {tiers.length > 0 && <ClubTiersList tiers={tiers} />}

        <ClubEventsList upcomingEvents={upcomingEvents} pastEvents={pastEvents} isMember={isMember} />

        {joining && (
          <View style={styles.overlayLoader}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 70 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  enterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  enterText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  content: { paddingBottom: spacing['3xl'] },
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900, marginBottom: spacing.sm },
  aboutText: { fontSize: 14, color: colors.neutral700, lineHeight: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.neutral900, marginTop: spacing.md },
  overlayLoader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
})
