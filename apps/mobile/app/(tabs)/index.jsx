import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  Image,
  Linking,
  ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'

function getInitials(name) {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
}

export default function HomeScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const {
    selectedClub,
    memberships,
    setSelectedClub,
    clubDetail,
    clubDetailLoading,
    clubDetailError,
    fetchClubDetail,
  } = useClubStore()
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showClubPicker, setShowClubPicker] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)

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
    if (selectedClub?.id) {
      fetchClubDetail(selectedClub.id)
    }
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

  const sportLabel = (sport) => {
    if (sport === 'tennis') return 'Tennis'
    if (sport === 'pickleball') return 'Pickleball'
    return 'Tennis & Pickleball'
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

  const renderClubHeader = () => {
    if (!selectedClub) return null

    if (clubDetailLoading && !clubDetail) {
      return (
        <View style={styles.clubHeaderSkeleton}>
          <View style={styles.clubLogoSkeleton} />
          <View style={{ flex: 1 }}>
            <View style={[styles.skeletonLine, { width: '70%', height: 16 }]} />
            <View style={[styles.skeletonLine, { width: '50%', marginTop: 6 }]} />
          </View>
        </View>
      )
    }

    const detail = clubDetail || selectedClub
    const logoUrl = detail?.logo_url
    const clubName = detail?.name || selectedClub?.name || 'Club'
    const description = clubDetail?.description

    return (
      <View style={styles.clubHeader}>
        <View style={styles.clubHeaderTop}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.clubLogo} />
          ) : (
            <View style={styles.clubLogoFallback}>
              <Text style={styles.clubLogoInitials}>{getInitials(clubName)}</Text>
            </View>
          )}
          <View style={styles.clubHeaderText}>
            <Text style={styles.clubName}>{clubName}</Text>
            {clubDetail?.sport && (
              <View style={styles.sportTagRow}>
                <View style={styles.sportTag}>
                  <Text style={styles.sportTagText}>{sportLabel(clubDetail.sport)}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {description ? (
          <View style={styles.descriptionContainer}>
            <Text
              style={styles.descriptionText}
              numberOfLines={descExpanded ? undefined : 2}
            >
              {description}
            </Text>
            {description.length > 100 && (
              <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)}>
                <Text style={styles.readMore}>
                  {descExpanded ? 'Show less' : 'Read more'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>
    )
  }

  const renderClubInfo = () => {
    if (!clubDetail) return null
    const { phone, website } = clubDetail
    if (!phone && !website) return null

    return (
      <View style={styles.clubInfoCard}>
        <Text style={styles.clubInfoTitle}>Club Info</Text>

        {phone ? (
          <TouchableOpacity
            style={styles.clubInfoRow}
            onPress={() => Linking.openURL(`tel:${phone}`)}
          >
            <Ionicons name="call-outline" size={18} color="#2563eb" />
            <Text style={styles.clubInfoLink}>{phone}</Text>
          </TouchableOpacity>
        ) : null}

        {website ? (
          <TouchableOpacity
            style={styles.clubInfoRow}
            onPress={() => Linking.openURL(website)}
          >
            <Ionicons name="globe-outline" size={18} color="#2563eb" />
            <Text style={styles.clubInfoLink} numberOfLines={1}>
              {website.replace(/^https?:\/\//, '')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {clubDetail.location ? (
          <View style={styles.clubInfoRow}>
            <Ionicons name="location-outline" size={18} color="#64748b" />
            <Text style={styles.clubInfoValue}>{clubDetail.location}</Text>
          </View>
        ) : null}
      </View>
    )
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
                setDescExpanded(false)
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

      {renderClubHeader()}

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

      {renderClubInfo()}

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
          reservations.map((item) => (
            <View key={item.id}>
              {renderReservation({ item })}
            </View>
          ))
        )}
      </View>
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
  header: {
    marginBottom: 20,
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

  // Club header
  clubHeader: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  clubHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubHeaderSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  clubLogo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    marginRight: 14,
    backgroundColor: '#f1f5f9',
  },
  clubLogoFallback: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  clubLogoInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: '#64748b',
  },
  clubLogoSkeleton: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    marginRight: 14,
  },
  clubHeaderText: {
    flex: 1,
  },
  clubName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  sportTagRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  sportTag: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sportTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  descriptionContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  descriptionText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  readMore: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
    marginTop: 4,
  },

  // Club info
  clubInfoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  clubInfoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  clubInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  clubInfoLink: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
    flex: 1,
  },
  clubInfoValue: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
  },

  // Quick book / join
  quickBookButton: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
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
    marginBottom: 20,
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

  // Reservations
  section: {
    marginBottom: 20,
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
