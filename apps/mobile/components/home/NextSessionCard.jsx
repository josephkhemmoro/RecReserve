import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, textStyles, spacing, borderRadius, shadows } from '../../theme'
import { Card, Icon, Button } from '../ui'

function formatSmartDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)

  if (date.toDateString() === now.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function getCountdown(startTime) {
  const diff = new Date(startTime).getTime() - Date.now()
  if (diff < 0) return null
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours >= 24) return null
  if (hours > 0) return `Starts in ${hours}h ${mins > 0 ? `${mins}m` : ''}`
  if (mins > 0) return `Starts in ${mins}m`
  return 'Starting now'
}

export function NextSessionCard({ reservation, hasClub, isLoading }) {
  const router = useRouter()

  if (isLoading) {
    return (
      <Card variant="default" style={styles.sessionCard}>
        <View style={styles.accentBar} />
        <View style={styles.sessionContent}>
          <View style={styles.skeletonLine} />
          <View style={[styles.skeletonLine, { width: '60%', height: 18, marginTop: spacing.xs }]} />
          <View style={[styles.skeletonLine, { width: '80%', marginTop: spacing.sm }]} />
        </View>
      </Card>
    )
  }

  if (!hasClub) {
    return (
      <Card variant="outlined" onPress={() => router.push('/(tabs)/clubs')}>
        <View style={styles.emptyInner}>
          <Icon name="tennisball-outline" size="lg" color={colors.neutral300} />
          <Text style={styles.emptyTitle}>Join a club to start booking</Text>
          <Button title="Find a Club" onPress={() => router.push('/(tabs)/clubs')} variant="primary" size="sm" />
        </View>
      </Card>
    )
  }

  if (!reservation) {
    return (
      <Card variant="outlined" onPress={() => router.push('/courts')}>
        <View style={styles.emptyInner}>
          <Text style={styles.emptyTitle}>No upcoming sessions</Text>
          <Text style={styles.emptySubtitle}>Ready to get on court?</Text>
          <Button title="Book a Court" onPress={() => router.push('/courts')} variant="accent" size="md" icon="tennisball-outline" />
        </View>
      </Card>
    )
  }

  const countdown = getCountdown(reservation.start_time)

  return (
    <Card variant="elevated" onPress={() => router.push('/(tabs)/reservations')} style={styles.sessionCard}>
      <View style={styles.accentBar} />
      <View style={styles.sessionContent}>
        <Text style={styles.label}>NEXT SESSION</Text>
        <Text style={styles.courtName}>{reservation.court?.name || 'Court'}</Text>
        <Text style={styles.dateTime}>
          {formatSmartDate(reservation.start_time)} · {formatTime(reservation.start_time)} – {formatTime(reservation.end_time)}
        </Text>
        {countdown && (
          <View style={styles.countdownRow}>
            <Icon name="time-outline" size="sm" color={colors.primary} />
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        )}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  sessionCard: { flexDirection: 'row', overflow: 'hidden', padding: 0 },
  accentBar: { width: 4, backgroundColor: colors.primary, borderTopLeftRadius: borderRadius.lg, borderBottomLeftRadius: borderRadius.lg },
  sessionContent: { flex: 1, padding: spacing.base },
  label: { ...textStyles.labelUpper, color: colors.neutral400, marginBottom: spacing.sm },
  courtName: { ...textStyles.heading4, color: colors.neutral900, marginBottom: spacing.xs },
  dateTime: { ...textStyles.bodySmall, color: colors.neutral600 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  countdownText: { ...textStyles.label, color: colors.primary },
  emptyInner: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  emptyTitle: { ...textStyles.bodyMedium, color: colors.neutral700 },
  emptySubtitle: { ...textStyles.bodySmall, color: colors.neutral400 },
  skeletonLine: { height: 12, width: '40%', backgroundColor: colors.neutral100, borderRadius: borderRadius.sm },
})
