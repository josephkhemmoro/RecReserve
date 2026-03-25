import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'

export default function HomeScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub, memberships, setSelectedClub } = useClubStore()
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showClubPicker, setShowClubPicker] = useState(false)

  const fullName = user?.user_metadata?.full_name || 'Player'
  const firstName = fullName.split(' ')[0]

  const fetchUpcoming = useCallback(async () => {
    if (!selectedClub?.id) return
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*, court:courts(name, sport)')
        .eq('user_id', user?.id)
        .eq('club_id', selectedClub.id)
        .eq('status', 'confirmed')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(3)

      if (error) throw error
      setReservations(data || [])
    } catch (err) {
      console.error('Error fetching reservations:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id, selectedClub?.id])

  useEffect(() => {
    if (user?.id) fetchUpcoming()
  }, [user?.id, fetchUpcoming])

  const onRefresh = () => {
    setRefreshing(true)
    fetchUpcoming()
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(today.getDate() + 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const renderReservation = ({ item }) => (
    <View style={styles.reservationCard}>
      <View style={styles.reservationLeft}>
        <View style={[
          styles.sportBadge,
          item.court?.sport === 'tennis' ? styles.tennisBadge : styles.pickleballBadge,
        ]}>
          <Text style={styles.sportBadgeText}>
            {item.court?.sport === 'tennis' ? 'T' : 'P'}
          </Text>
        </View>
      </View>
      <View style={styles.reservationInfo}>
        <Text style={styles.courtName}>{item.court?.name || 'Court'}</Text>
        <Text style={styles.reservationTime}>
          {formatDate(item.start_time)} {formatTime(item.start_time)} – {formatTime(item.end_time)}
        </Text>
      </View>
    </View>
  )

  const renderSkeleton = () => (
    <View>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonCircle} />
          <View style={styles.skeletonLines}>
            <View style={[styles.skeletonLine, { width: '60%' }]} />
            <View style={[styles.skeletonLine, { width: '40%' }]} />
          </View>
        </View>
      ))}
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {firstName}</Text>
        <TouchableOpacity
          style={styles.clubSelector}
          onPress={() => setShowClubPicker(!showClubPicker)}
        >
          <Text style={styles.clubSelectorText}>{selectedClub?.name || 'Select Club'}</Text>
          <Text style={styles.clubSelectorArrow}>{showClubPicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      </View>

      {showClubPicker && memberships.length > 1 && (
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
            <Text style={[styles.clubPickerItemText, { color: '#2563eb' }]}>+ Join Another Club</Text>
          </TouchableOpacity>
        </View>
      )}

      {selectedClub ? (
        <TouchableOpacity
          style={styles.quickBookButton}
          onPress={() => router.push('/courts')}
        >
          <Text style={styles.quickBookText}>Quick Book</Text>
          <Text style={styles.quickBookSub}>Find an available court</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.joinClubBanner}
          onPress={() => router.push('/(tabs)/clubs')}
        >
          <Text style={styles.joinClubTitle}>Join a Club</Text>
          <Text style={styles.joinClubSub}>Find and join a club to start booking courts</Text>
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Reservations</Text>

        {!selectedClub ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No club selected</Text>
            <Text style={styles.emptySubtitle}>
              Join a club to see your reservations
            </Text>
          </View>
        ) : loading ? (
          renderSkeleton()
        ) : reservations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No upcoming reservations</Text>
            <Text style={styles.emptySubtitle}>
              Book a court to get started
            </Text>
          </View>
        ) : (
          <FlatList
            data={reservations}
            renderItem={renderReservation}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 70,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  clubSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  clubSelectorText: {
    fontSize: 15,
    color: '#2563eb',
    fontWeight: '600',
  },
  clubSelectorArrow: {
    fontSize: 10,
    color: '#2563eb',
    marginLeft: 6,
  },
  clubPickerDropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
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
  quickBookButton: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
  },
  quickBookText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  quickBookSub: {
    color: '#bfdbfe',
    fontSize: 14,
  },
  joinClubBanner: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  joinClubTitle: {
    color: '#1e293b',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  joinClubSub: {
    color: '#64748b',
    fontSize: 14,
  },
  section: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  reservationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  reservationLeft: {
    marginRight: 14,
  },
  sportBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tennisBadge: {
    backgroundColor: '#dcfce7',
  },
  pickleballBadge: {
    backgroundColor: '#fef3c7',
  },
  sportBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  reservationInfo: {
    flex: 1,
  },
  courtName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  reservationTime: {
    fontSize: 13,
    color: '#64748b',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 14,
  },
  skeletonLines: {
    flex: 1,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    marginBottom: 8,
  },
})
