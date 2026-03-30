import { useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { TouchableOpacity } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubProfileStore } from '../../store/clubProfileStore'
import { useFeedStore } from '../../store/feedStore'
import {
  ClubProfileHeader,
  ClubPhotoGallery,
  ClubTiersList,
  ClubAnnouncementsFeed,
  ClubEventsList,
  MembersOnlyGate,
} from '../../components/clubProfile'
import { ActivityFeed } from '../../components/feed'

export default function ClubProfileScreen() {
  const { clubId } = useLocalSearchParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const { profileData, isLoading, fetchClubProfile } = useClubProfileStore()
  const { fetchFeed } = useFeedStore()

  const loadData = useCallback(async () => {
    if (clubId && user?.id) {
      await fetchClubProfile(clubId, user.id)
      fetchFeed(clubId)
    }
  }, [clubId, user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleJoin = async () => {
    if (!user?.id || !clubId) return
    try {
      const { error } = await supabase.from('memberships').insert({
        user_id: user.id,
        club_id: clubId,
        is_active: true,
      })
      if (error) {
        if (error.code === '23505') {
          Alert.alert('Already a Member', 'You are already a member of this club.')
        } else {
          throw error
        }
      } else {
        Alert.alert('Joined!', 'Welcome to the club!')
        loadData()
      }
    } catch (err) {
      console.error('Error joining club:', err)
      Alert.alert('Error', 'Failed to join club. Please try again.')
    }
  }

  if (isLoading && !profileData) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  if (!profileData) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load club profile</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const { club, courtCount, memberCount, photos, tiers, announcements, upcomingEvents, pastEvents, isMember } = profileData

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={22} color="#2563eb" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadData} />
        }
      >
        {/* Public sections */}
        <ClubProfileHeader
          club={club}
          courtCount={courtCount}
          memberCount={memberCount}
          isMember={isMember}
          onJoin={handleJoin}
        />

        <ClubPhotoGallery photos={photos} />

        <ClubTiersList tiers={tiers} />

        {/* Members-only sections */}
        <MembersOnlyGate
          isMember={isMember}
          clubName={club.name}
          onJoin={handleJoin}
        >
          <ClubAnnouncementsFeed announcements={announcements || []} />
          <ClubEventsList
            upcomingEvents={upcomingEvents}
            pastEvents={pastEvents}
            isMember={isMember}
          />
          <View style={styles.feedSection}>
            <ActivityFeed clubId={clubId} showHeader />
          </View>
        </MembersOnlyGate>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  errorText: { fontSize: 16, color: '#64748b', marginBottom: 12 },
  backBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  header: { paddingHorizontal: 20, marginBottom: 12 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
  feedSection: { paddingHorizontal: 20 },
})
