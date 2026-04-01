import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Icon } from '../ui'

export function StreakStrip({ currentStreak, longestStreak }) {
  const router = useRouter()

  if (currentStreak === 0) {
    return (
      <TouchableOpacity style={[styles.container, styles.containerZero]} onPress={() => {}} activeOpacity={0.7}>
        <Icon name="tennisball-outline" size="sm" color={colors.neutral500} />
        <Text style={styles.zeroText}>Start your streak — book a court!</Text>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity style={styles.container} onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.7}>
      <Icon name="flame" size="sm" color={colors.streak} />
      <Text style={styles.text}>
        <Text style={styles.bold}>{currentStreak} week streak</Text>
        {'  ·  Best: '}{longestStreak}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginVertical: spacing.sm,
    backgroundColor: colors.streakLight, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  containerZero: { backgroundColor: colors.neutral50 },
  text: { ...textStyles.bodySmall, color: colors.neutral700 },
  bold: { fontWeight: '700' },
  zeroText: { ...textStyles.bodySmall, color: colors.neutral500, fontWeight: '600' },
})
