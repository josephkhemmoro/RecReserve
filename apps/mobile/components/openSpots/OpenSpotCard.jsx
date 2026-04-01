import { View, Text, StyleSheet } from 'react-native'
import { getRelativeTime } from '../../lib/timeHelpers'
import { colors, textStyles, spacing, borderRadius, shadows } from '../../theme'
import { Avatar, Icon, Button, Badge } from '../ui'

function formatDateTime(startTime, endTime) {
  const start = new Date(startTime)
  const end = new Date(endTime)
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const timeStr = `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
  return `${dateStr} · ${timeStr}`
}

const SKILL_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }

export function OpenSpotCard({ spot, currentUserId, alreadyRequested, onRequestJoin }) {
  const poster = spot.poster
  const reservation = spot.reservation
  const court = reservation?.court
  const spotsRemaining = spot.spots_needed - (spot.accepted_count || 0)
  const isFilled = spotsRemaining <= 0
  const isOwnPost = spot.user_id === currentUserId

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Avatar uri={poster?.avatar_url} name={poster?.full_name || 'Player'} size="sm" />
        <View style={styles.posterInfo}>
          <Text style={styles.posterName}>{poster?.full_name || 'Player'}</Text>
          <Text style={styles.timeAgo}>{getRelativeTime(spot.created_at)}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Icon name="tennisball-outline" size="sm" color={colors.neutral500} />
          <Text style={styles.detailText}>{court?.name || 'Court'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="calendar-outline" size="sm" color={colors.neutral500} />
          <Text style={styles.detailText}>{formatDateTime(reservation?.start_time, reservation?.end_time)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="people-outline" size="sm" color={colors.neutral500} />
          <Text style={styles.detailText}>Looking for {spotsRemaining} more player{spotsRemaining !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {spot.description && <Text style={styles.description}>"{spot.description}"</Text>}
      {spot.skill_level && spot.skill_level !== 'any' && (
        <Badge label={SKILL_LABELS[spot.skill_level] || spot.skill_level} variant="primary" size="sm" icon="fitness-outline" />
      )}

      <View style={styles.footer}>
        {isFilled ? <Badge label="Filled" variant="default" />
          : isOwnPost ? <Text style={styles.ownPostText}>Your post</Text>
          : alreadyRequested ? <Badge label="Requested" variant="success" icon="checkmark-circle" />
          : <Button title="Request to Join" onPress={() => onRequestJoin(spot.id)} variant="primary" size="sm" />}
        {spot.request_count > 0 && <Text style={styles.interestedText}>{spot.request_count} interested</Text>}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.base, marginBottom: spacing.sm, ...shadows.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  posterInfo: { flex: 1 },
  posterName: { ...textStyles.bodyMedium, color: colors.neutral900 },
  timeAgo: { ...textStyles.caption, color: colors.neutral400 },
  details: { gap: spacing.xs, marginBottom: spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailText: { ...textStyles.bodySmall, color: colors.neutral600 },
  description: { ...textStyles.bodySmall, color: colors.neutral500, fontStyle: 'italic', marginBottom: spacing.sm },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.neutral100 },
  ownPostText: { ...textStyles.caption, color: colors.neutral400 },
  interestedText: { ...textStyles.caption, color: colors.neutral400 },
})
