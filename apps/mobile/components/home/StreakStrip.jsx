import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'

export function StreakStrip({ currentStreak, longestStreak, freezesRemaining }) {
  const router = useRouter()

  if (currentStreak === 0) {
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={() => router.push('/courts')}
        activeOpacity={0.7}
      >
        <Text style={styles.zeroText}>🎾 Start your streak — book a court!</Text>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push('/(tabs)/profile')}
      activeOpacity={0.7}
    >
      <Text style={styles.streakText}>
        🔥 <Text style={styles.bold}>{currentStreak} week streak</Text>
      </Text>
      <Text style={styles.dot}>·</Text>
      <Text style={styles.mutedText}>Longest: {longestStreak}</Text>
      <Text style={styles.dot}>·</Text>
      <Text style={styles.mutedText}>🧊 {freezesRemaining}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 4,
  },
  streakText: { fontSize: 13, color: '#1e293b' },
  bold: { fontWeight: '700' },
  dot: { color: '#cbd5e1', fontSize: 13 },
  mutedText: { fontSize: 12, color: '#64748b' },
  zeroText: { fontSize: 13, fontWeight: '600', color: '#475569' },
})
