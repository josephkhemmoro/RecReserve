import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { getStreakMessage } from '../../lib/streakHelpers'
import { colors, textStyles, spacing, borderRadius, shadows } from '../../theme'
import { Icon } from '../ui'

export function StreakCard({ currentStreak, longestStreak, freezesRemaining, hasUpcomingThisWeek, isLoading, onPress }) {
  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={[styles.skeletonLine, { width: '40%', height: 32 }]} />
        <View style={[styles.skeletonLine, { width: '50%', height: 14, marginTop: spacing.sm }]} />
        <View style={[styles.skeletonLine, { width: '70%', height: 12, marginTop: spacing.md }]} />
      </View>
    )
  }

  let streakColor = colors.streak
  if (currentStreak >= 26) streakColor = colors.accent
  const message = getStreakMessage(currentStreak, hasUpcomingThisWeek)

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
      <View style={styles.topRow}>
        <Icon name="flame" size="lg" color={streakColor} />
        <Text style={[styles.streakNumber, { color: streakColor }]}>{currentStreak}</Text>
      </View>
      <Text style={styles.streakLabel}>week streak</Text>
      {longestStreak > 0 && <Text style={styles.longestText}>Longest: {longestStreak} weeks</Text>}
      <View style={styles.freezeRow}>
        <Icon name="snow-outline" size="sm" color={colors.freeze} />
        <Text style={styles.freezeText}>{freezesRemaining} freezes remaining</Text>
      </View>
      <Text style={styles.messageText}>{message}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.base, ...shadows.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  streakNumber: { fontSize: 34, fontWeight: '800' },
  streakLabel: { ...textStyles.bodySmall, color: colors.neutral500, marginTop: 2, marginBottom: spacing.md },
  longestText: { ...textStyles.caption, color: colors.neutral400, marginBottom: spacing.xs },
  freezeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  freezeText: { ...textStyles.label, color: colors.freeze },
  messageText: { ...textStyles.bodySmall, color: colors.neutral500, lineHeight: 20 },
  skeletonLine: { backgroundColor: colors.neutral100, borderRadius: borderRadius.sm },
})
