import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { useOpenSpotsStore } from '../../store/openSpotsStore'
import { OpenSpotCard } from '../../components/openSpots/OpenSpotCard'
import { SpotRequestsList } from '../../components/openSpots/SpotRequestsList'

const TABS = ['Open Spots', 'My Posts']

export default function PlayersScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const {
    openSpots, isLoading, mySpots, mySpotRequests, mySentRequests,
    fetchOpenSpots, fetchMySpots, fetchMySentRequests, fetchRequestsForSpot,
    sendRequest, respondToRequest, closeSpot,
  } = useOpenSpotsStore()

  const [activeTab, setActiveTab] = useState('Open Spots')
  const [refreshing, setRefreshing] = useState(false)
  const [expandedSpot, setExpandedSpot] = useState(null)

  const clubId = selectedClub?.id
  const userId = user?.id

  useEffect(() => {
    if (clubId && userId) {
      fetchOpenSpots(clubId)
      fetchMySpots(userId, clubId)
      fetchMySentRequests(userId)
    }
  }, [clubId, userId])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([
      fetchOpenSpots(clubId),
      fetchMySpots(userId, clubId),
      fetchMySentRequests(userId),
    ])
    setRefreshing(false)
  }, [clubId, userId])

  const handleRequestJoin = async (spotId) => {
    await sendRequest(spotId, userId)
  }

  const handleExpandSpot = (spotId) => {
    if (expandedSpot === spotId) {
      setExpandedSpot(null)
    } else {
      setExpandedSpot(spotId)
      fetchRequestsForSpot(spotId)
    }
  }

  const filteredSpots = openSpots

  const sentSpotIds = new Set(mySentRequests.map((r) => r.open_spot_id))

  const userName = user?.user_metadata?.full_name || 'Player'

  const renderOpenSpot = ({ item }) => (
    <OpenSpotCard
      spot={item}
      currentUserId={userId}
      alreadyRequested={sentSpotIds.has(item.id)}
      onRequestJoin={handleRequestJoin}
    />
  )

  const renderMySpot = ({ item }) => {
    const isExpanded = expandedSpot === item.id
    const requests = mySpotRequests[item.id] || []

    return (
      <View style={styles.mySpotCard}>
        <TouchableOpacity onPress={() => handleExpandSpot(item.id)}>
          <View style={styles.mySpotHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mySpotCourt}>
                {item.reservation?.court?.name || 'Court'} · {item.spots_needed} player{item.spots_needed !== 1 ? 's' : ''} needed
              </Text>
              <Text style={styles.mySpotTime}>
                {new Date(item.reservation?.start_time).toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                })}
              </Text>
            </View>
            <View style={styles.mySpotRight}>
              {item.is_active ? (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
              ) : (
                <View style={styles.closedBadge}>
                  <Text style={styles.closedBadgeText}>Closed</Text>
                </View>
              )}
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#94a3b8" />
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <SpotRequestsList
              requests={requests}
              spotOwnerName={userName}
              onAccept={(reqId) => respondToRequest(reqId, 'accepted', userName)}
              onDecline={(reqId) => respondToRequest(reqId, 'declined', userName)}
            />
            {item.is_active && (
              <TouchableOpacity
                style={styles.closeSpotBtn}
                onPress={() => closeSpot(item.id)}
              >
                <Text style={styles.closeSpotText}>Close Spot</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={22} color="#2563eb" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Looking for Players</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'Open Spots' ? (
        <FlatList
          data={filteredSpots}
          renderItem={renderOpenSpot}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, filteredSpots.length === 0 && { flexGrow: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#2563eb" />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No open spots right now</Text>
                <Text style={styles.emptySubtitle}>
                  Post one from your upcoming reservations! 🎾
                </Text>
              </View>
            )
          }
        />
      ) : (
        <FlatList
          data={mySpots}
          renderItem={renderMySpot}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, mySpots.length === 0 && { flexGrow: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No posted spots yet</Text>
              <Text style={styles.emptySubtitle}>
                Post an open spot from your upcoming reservations
              </Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 60 },
  header: { paddingHorizontal: 20, marginBottom: 12 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  backText: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', color: '#1e293b' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  tabActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#ffffff' },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
  mySpotCard: { backgroundColor: '#ffffff', borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
  mySpotHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  mySpotCourt: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  mySpotTime: { fontSize: 13, color: '#64748b', marginTop: 2 },
  mySpotRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  closedBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  closedBadgeText: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },
  expandedContent: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  closeSpotBtn: { marginTop: 12, borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fef2f2' },
  closeSpotText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
})
