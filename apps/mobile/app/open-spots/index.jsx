import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { useOpenSpotsStore } from '../../store/openSpotsStore'
import { colors, textStyles, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Avatar, Badge, Button, EmptyState } from '../../components/ui'

const SKILL_LABELS = { any: 'All Levels', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }
const SKILL_COLORS = { any: colors.info, beginner: colors.success, intermediate: colors.warning, advanced: colors.error }

export default function OpenSpotsScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const {
    openSpots, isLoading, mySentRequests,
    fetchOpenSpots, fetchMySentRequests, sendRequest, isSending,
  } = useOpenSpotsStore()
  const [refreshing, setRefreshing] = useState(false)
  const [sendingSpotId, setSendingSpotId] = useState(null)

  useEffect(() => {
    if (selectedClub?.id) {
      fetchOpenSpots(selectedClub.id)
      if (user?.id) fetchMySentRequests(user.id)
    }
  }, [selectedClub?.id, user?.id])

  const onRefresh = async () => {
    setRefreshing(true)
    if (selectedClub?.id) await fetchOpenSpots(selectedClub.id)
    if (user?.id) await fetchMySentRequests(user.id)
    setRefreshing(false)
  }

  const sentSpotIds = new Set(mySentRequests.map((r) => r.open_spot_id))

  const handleRequestJoin = async (spotId) => {
    if (!user?.id) return
    setSendingSpotId(spotId)
    await sendRequest(spotId, user.id)
    setSendingSpotId(null)
  }

  const formatTime = (iso) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const formatDate = (iso) => {
    const d = new Date(iso)
    const now = new Date()
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
    if (d.toDateString() === now.toDateString()) return 'Today'
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // Filter out user's own spots
  const visibleSpots = openSpots.filter((s) => s.user_id !== user?.id)

  const renderSpot = ({ item }) => {
    const alreadyRequested = sentSpotIds.has(item.id)
    const spotsLeft = item.spots_needed - (item.accepted_count || 0)
    const skillLabel = SKILL_LABELS[item.skill_level] || 'All Levels'
    const skillColor = SKILL_COLORS[item.skill_level] || colors.info

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Avatar uri={item.poster?.avatar_url} name={item.poster?.full_name || '?'} size="md" />
          <View style={styles.cardInfo}>
            <Text style={styles.posterName}>{item.poster?.full_name}</Text>
            <Text style={styles.courtName}>{item.reservation?.court?.name}</Text>
          </View>
          <View style={[styles.skillBadge, { backgroundColor: skillColor + '20' }]}>
            <Text style={[styles.skillText, { color: skillColor }]}>{skillLabel}</Text>
          </View>
        </View>

        <View style={styles.timeRow}>
          <Icon name="calendar-outline" size="sm" color={colors.neutral500} />
          <Text style={styles.timeText}>
            {formatDate(item.reservation?.start_time)} · {formatTime(item.reservation?.start_time)} - {formatTime(item.reservation?.end_time)}
          </Text>
        </View>

        {item.description && (
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.spotsText}>
            {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft > 1 ? 's' : ''} left` : 'Full'}
          </Text>
          {alreadyRequested ? (
            <View style={styles.requestedBadge}>
              <Icon name="checkmark-circle" size="sm" color={colors.success} />
              <Text style={styles.requestedText}>Requested</Text>
            </View>
          ) : spotsLeft > 0 ? (
            <Button
              title={sendingSpotId === item.id ? 'Sending...' : 'Request to Join'}
              onPress={() => handleRequestJoin(item.id)}
              variant="primary"
              size="sm"
              disabled={sendingSpotId === item.id}
            />
          ) : null}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Icon name="arrow-back" size="md" color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Open Spots</Text>
        <TouchableOpacity onPress={() => router.push('/open-spots/my-spots')} style={styles.mySpotsCta}>
          <Text style={styles.mySpotsText}>My Posts</Text>
          <Icon name="chevron-forward" size="sm" color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={isLoading ? [] : visibleSpots}
        renderItem={renderSpot}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, (isLoading || visibleSpots.length === 0) && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : (
            <View style={styles.emptyState}>
              <Icon name="people-outline" size="lg" color={colors.neutral300} />
              <Text style={styles.emptyTitle}>No open spots right now</Text>
              <Text style={styles.emptySub}>When players are looking for partners, they'll appear here</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.base },
  backRow: { marginRight: spacing.md },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: colors.neutral900 },
  mySpotsCta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mySpotsText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  card: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.base,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.neutral100, ...shadows.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  cardInfo: { flex: 1, marginLeft: spacing.md },
  posterName: { fontSize: 15, fontWeight: '700', color: colors.neutral900 },
  courtName: { fontSize: 13, color: colors.neutral500 },
  skillBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm },
  skillText: { fontSize: 11, fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  timeText: { fontSize: 13, color: colors.neutral600 },
  description: { fontSize: 14, color: colors.neutral600, marginBottom: spacing.md, lineHeight: 20 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.neutral100 },
  spotsText: { fontSize: 13, fontWeight: '600', color: colors.neutral500 },
  requestedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  requestedText: { fontSize: 13, fontWeight: '600', color: colors.success },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing['3xl'], gap: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.neutral900 },
  emptySub: { fontSize: 14, color: colors.neutral400, textAlign: 'center' },
})
