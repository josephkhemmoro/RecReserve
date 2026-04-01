import { View, Text, StyleSheet } from 'react-native'
import { useAuthStore } from '../../store/authStore'
import { useOpenSpotsStore } from '../../store/openSpotsStore'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Avatar, Button, Badge, Icon } from '../ui'

function formatShortDate(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (d.toDateString() === now.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function OpenSpotFeedItem({ spot }) {
  const { user } = useAuthStore()
  const { sendRequest, mySentRequests } = useOpenSpotsStore()
  const isOwn = spot.user_id === user?.id
  const alreadyRequested = mySentRequests.some((r) => r.open_spot_id === spot.id)
  const poster = spot.poster
  const reservation = spot.reservation

  return (
    <View style={styles.card}>
      <Badge label="LOOKING FOR PLAYERS" variant="primary" icon="people-outline" size="sm" />
      <View style={styles.posterRow}>
        <Avatar uri={poster?.avatar_url} name={poster?.full_name || '?'} size="sm" />
        <Text style={styles.posterName}>{poster?.full_name || 'Player'}</Text>
      </View>
      <View style={styles.detailRow}>
        <Icon name="tennisball-outline" size="sm" color={colors.neutral500} />
        <Text style={styles.detailText}>
          {reservation?.court?.name || 'Court'} · {formatShortDate(reservation?.start_time)} {formatTime(reservation?.start_time)}
        </Text>
      </View>
      {spot.description && <Text style={styles.description}>"{spot.description}"</Text>}
      {!isOwn && !alreadyRequested && (
        <Button title="Request to Join" onPress={() => sendRequest(spot.id, user?.id)} variant="primary" size="sm" fullWidth />
      )}
      {alreadyRequested && <Badge label="Requested" variant="success" icon="checkmark-circle" />}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primarySurface, borderRadius: borderRadius.lg,
    padding: spacing.base, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.primaryMuted, gap: spacing.sm,
  },
  posterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  posterName: { ...textStyles.label, color: colors.neutral800 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  detailText: { ...textStyles.bodySmall, color: colors.neutral600 },
  description: { ...textStyles.bodySmall, color: colors.neutral500, fontStyle: 'italic' },
})
