import { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { useOpenSpotsStore } from '../../store/openSpotsStore'
import { colors, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Avatar, Button } from '../../components/ui'

export default function MySpotsScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const {
    mySpots, mySpotRequests, fetchMySpots, fetchRequestsForSpot,
    respondToRequest, closeSpot,
  } = useOpenSpotsStore()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedSpotId, setExpandedSpotId] = useState(null)

  useEffect(() => {
    const load = async () => {
      if (user?.id && selectedClub?.id) {
        await fetchMySpots(user.id, selectedClub.id)
      }
      setLoading(false)
    }
    load()
  }, [user?.id, selectedClub?.id])

  const onRefresh = async () => {
    setRefreshing(true)
    if (user?.id && selectedClub?.id) await fetchMySpots(user.id, selectedClub.id)
    setRefreshing(false)
  }

  const handleToggleRequests = async (spotId) => {
    if (expandedSpotId === spotId) {
      setExpandedSpotId(null)
    } else {
      setExpandedSpotId(spotId)
      await fetchRequestsForSpot(spotId)
    }
  }

  const handleRespond = async (requestId, status) => {
    const success = await respondToRequest(requestId, status, user?.full_name || 'Player')
    if (success && user?.id && selectedClub?.id) {
      fetchMySpots(user.id, selectedClub.id)
    }
  }

  const handleCloseSpot = (spotId) => {
    Alert.alert('Close Spot', 'Remove this open spot listing?', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: async () => {
        await closeSpot(spotId)
        if (user?.id && selectedClub?.id) fetchMySpots(user.id, selectedClub.id)
      }},
    ])
  }

  const formatTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const formatDate = (iso) => {
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return 'Today'
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const renderSpot = ({ item }) => {
    const requests = mySpotRequests[item.id] || []
    const isExpanded = expandedSpotId === item.id
    const pendingCount = (item.request_count || 0)

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.courtName}>{item.reservation?.court?.name || 'Court'}</Text>
            <Text style={styles.timeText}>
              {formatDate(item.reservation?.start_time)} · {formatTime(item.reservation?.start_time)} - {formatTime(item.reservation?.end_time)}
            </Text>
            <Text style={styles.spotsInfo}>
              {item.accepted_count || 0}/{item.spots_needed} filled · {pendingCount} pending
            </Text>
          </View>
          <View style={styles.cardActions}>
            {item.is_active && (
              <TouchableOpacity onPress={() => handleCloseSpot(item.id)}>
                <Icon name="close-circle-outline" size="md" color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {item.is_active && (
          <TouchableOpacity style={styles.requestsToggle} onPress={() => handleToggleRequests(item.id)}>
            <Text style={styles.requestsToggleText}>
              {isExpanded ? 'Hide Requests' : `View Requests (${pendingCount})`}
            </Text>
            <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size="sm" color={colors.primary} />
          </TouchableOpacity>
        )}

        {!item.is_active && (
          <View style={styles.closedBadge}>
            <Text style={styles.closedText}>Closed</Text>
          </View>
        )}

        {isExpanded && (
          <View style={styles.requestsList}>
            {requests.length === 0 ? (
              <Text style={styles.noRequests}>No requests yet</Text>
            ) : (
              requests.map((req) => (
                <View key={req.id} style={styles.requestRow}>
                  <Avatar uri={req.requester?.avatar_url} name={req.requester?.full_name || '?'} size="sm" />
                  <View style={styles.requestInfo}>
                    <Text style={styles.requesterName}>{req.requester?.full_name}</Text>
                    {req.message && <Text style={styles.requestMessage} numberOfLines={1}>{req.message}</Text>}
                  </View>
                  {req.status === 'pending' ? (
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => handleRespond(req.id, 'accepted')}
                      >
                        <Icon name="checkmark" size="sm" color={colors.white} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.declineBtn}
                        onPress={() => handleRespond(req.id, 'declined')}
                      >
                        <Icon name="close" size="sm" color={colors.white} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={[styles.statusText, {
                      color: req.status === 'accepted' ? colors.success : colors.neutral400,
                    }]}>
                      {req.status === 'accepted' ? 'Accepted' : 'Declined'}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </View>
    )
  }

  const activeSpots = mySpots.filter((s) => s.is_active)
  const closedSpots = mySpots.filter((s) => !s.is_active)
  const allSpots = [...activeSpots, ...closedSpots]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size="md" color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>My Open Spots</Text>
      </View>

      <FlatList
        data={loading ? [] : allSpots}
        renderItem={renderSpot}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, (loading || allSpots.length === 0) && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : (
            <View style={styles.emptyState}>
              <Icon name="people-outline" size="lg" color={colors.neutral300} />
              <Text style={styles.emptyTitle}>No open spots posted</Text>
              <Text style={styles.emptySub}>Post a spot from your upcoming bookings to find playing partners</Text>
            </View>
          )
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 70 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.base },
  title: { fontSize: 22, fontWeight: '700', color: colors.neutral900 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  card: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.base,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.neutral100, ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  courtName: { fontSize: 16, fontWeight: '700', color: colors.neutral900 },
  timeText: { fontSize: 13, color: colors.neutral500, marginTop: 2 },
  spotsInfo: { fontSize: 12, color: colors.neutral400, marginTop: 4 },
  cardActions: { marginLeft: spacing.md },
  requestsToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.neutral100,
  },
  requestsToggleText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  closedBadge: {
    marginTop: spacing.md, alignSelf: 'flex-start',
    backgroundColor: colors.neutral100, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm,
  },
  closedText: { fontSize: 12, fontWeight: '600', color: colors.neutral500 },
  requestsList: { marginTop: spacing.md },
  noRequests: { fontSize: 13, color: colors.neutral400, textAlign: 'center', paddingVertical: spacing.md },
  requestRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.neutral100,
  },
  requestInfo: { flex: 1, marginLeft: spacing.md },
  requesterName: { fontSize: 14, fontWeight: '600', color: colors.neutral900 },
  requestMessage: { fontSize: 12, color: colors.neutral500, marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: spacing.sm },
  acceptBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 12, fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing['3xl'], gap: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.neutral900 },
  emptySub: { fontSize: 14, color: colors.neutral400, textAlign: 'center' },
})
