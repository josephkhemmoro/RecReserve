import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { getStreakMessage } from '../../lib/streakHelpers'

export function StreakCard({
  currentStreak,
  longestStreak,
  freezesRemaining,
  hasUpcomingThisWeek,
  isLoading,
  onPress,
}) {
  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={[styles.skeletonLine, { width: '40%', height: 32 }]} />
        <View style={[styles.skeletonLine, { width: '50%', height: 14, marginTop: 8 }]} />
        <View style={[styles.skeletonLine, { width: '70%', height: 12, marginTop: 12 }]} />
      </View>
    )
  }

  let streakColor = '#FF6B35'
  if (currentStreak >= 26) streakColor = '#FFD700'
  else if (currentStreak >= 12) streakColor = '#D4A017'

  const message = getStreakMessage(currentStreak, hasUpcomingThisWeek)

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.topRow}>
        <Text style={{ fontSize: 28 }}>🔥</Text>
        <Text style={[styles.streakNumber, { color: streakColor }]}>
          {currentStreak}
        </Text>
      </View>
      <Text style={styles.streakLabel}>week streak</Text>

      {longestStreak > 0 && (
        <Text style={styles.longestText}>Longest: {longestStreak} weeks</Text>
      )}

      <View style={styles.freezeRow}>
        <Text style={styles.freezeText}>🧊 {freezesRemaining} freezes remaining</Text>
      </View>

      <Text style={styles.messageText}>{message}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakNumber: {
    fontSize: 34,
    fontWeight: '800',
  },
  streakLabel: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 12,
  },
  longestText: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 6,
  },
  freezeRow: {
    marginBottom: 12,
  },
  freezeText: {
    fontSize: 13,
    color: '#4FC3F7',
    fontWeight: '600',
  },
  messageText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  skeletonLine: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
  },
})
