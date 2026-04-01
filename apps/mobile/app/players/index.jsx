import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { useOpenSpotsStore } from '../../store/openSpotsStore'
import { OpenSpotCard } from '../../components/openSpots/OpenSpotCard'
import { SpotRequestsList } from '../../components/openSpots/SpotRequestsList'
import { colors, textStyles, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Badge, EmptyState } from '../../components/ui'

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
    await Promise.all([fetchOpenSpots(clubId), fetchMySpots(userId, clubId), fetchMySentRequests(userId)])
    setRefreshing(false)
  }, [clubId, userId])

  const handleExpandSpot = (spotId) => {
    if (expandedSpot === spotId) setExpandedSpot(null)
    else { setExpandedSpot(spotId); fetchRequestsForSpot(spotId) }
  }

  const sentSpotIds = new Set(mySentRequests.map((r) => r.open_spot_id))
  const userName = user?.user_metadata?.full_name || 'Player'

  const renderOpenSpot = ({ item }) => (
    <OpenSpotCard spot={item} currentUserId={userId} alreadyRequested={sentSpotIds.has(item.id)} onRequestJoin={(id) => sendRequest(id, userId)} />
  )

  const renderMySpot = ({ item }) => {
    const isExpanded = expandedSpot === item.id
    const requests = mySpotRequests[item.id] || []
    return (
      <View style={styles.mySpotCard}>
        <TouchableOpacity onPress={() => handleExpandSpot(item.id)} activeOpacity={0.7}>
          <View style={styles.mySpotHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mySpotCourt}>{item.reservation?.court?.name || 'Court'} · {item.spots_needed} needed</Text>
              <Text style={styles.mySpotTime}>{new Date(item.reservation?.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
            </View>
            <View style={styles.mySpotRight}>
              {item.is_active ? <Badge label="Active" variant="success" size="sm" /> : <Badge label="Closed" variant="default" size="sm" />}
              <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size="sm" color={colors.neutral400} />
            </View>
          </View>
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.expandedContent}>
            <SpotRequestsList requests={requests} spotOwnerName={userName} onAccept={(id) => respondToRequest(id, 'accepted', userName)} onDecline={(id) => respondToRequest(id, 'declined', userName)} />
            {item.is_active && (
              <TouchableOpacity style={styles.closeSpotBtn} onPress={() => closeSpot(item.id)}>
                <Icon name="close-circle-outline" size="sm" color={colors.error} />
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
          <Icon name="arrow-back" size="md" color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Looking for Players</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={activeTab === 'Open Spots' ? openSpots : mySpots}
        renderItem={activeTab === 'Open Spots' ? renderOpenSpot : renderMySpot}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, (activeTab === 'Open Spots' ? openSpots : mySpots).length === 0 && { flexGrow: 1 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : (
            <EmptyState
              icon={activeTab === 'Open Spots' ? 'people-outline' : 'document-text-outline'}
              title={activeTab === 'Open Spots' ? 'No open spots right now' : 'No posted spots yet'}
              subtitle={activeTab === 'Open Spots' ? 'Post one from your upcoming reservations!' : 'Post an open spot from your upcoming reservations'}
            />
          )
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 60 },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.base },
  backText: { ...textStyles.bodyMedium, color: colors.primary },
  title: { ...textStyles.heading2, color: colors.neutral900 },
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.neutral150, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { ...textStyles.label, color: colors.neutral400 },
  tabTextActive: { color: colors.neutral900 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mySpotCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, marginBottom: spacing.sm, ...shadows.sm, overflow: 'hidden' },
  mySpotHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.base },
  mySpotCourt: { ...textStyles.bodyMedium, color: colors.neutral900 },
  mySpotTime: { ...textStyles.caption, color: colors.neutral500, marginTop: 2 },
  mySpotRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  expandedContent: { paddingHorizontal: spacing.base, paddingBottom: spacing.base, borderTopWidth: 1, borderTopColor: colors.neutral100 },
  closeSpotBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md, borderWidth: 1, borderColor: colors.errorLight, borderRadius: borderRadius.md, paddingVertical: spacing.sm, backgroundColor: colors.errorLight },
  closeSpotText: { ...textStyles.label, color: colors.error },
})
