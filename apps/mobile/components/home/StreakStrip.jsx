import { View, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Icon } from '../ui'
import { useRewardsStore } from '../../store/rewardsStore'

export function StreakStrip({ currentStreak, longestStreak }) {
  const router = useRouter()
  const availableRewards = useRewardsStore((s) => s.availableRewards)
  const rewardsCount = availableRewards().length

  if (currentStreak === 0) {
    return (
      <View style={styles.wrapper}>
        <TouchableOpacity
          style={[styles.container, styles.containerZero]}
          onPress={() => {}}
          activeOpacity={0.7}
        >
          <Icon name="tennisball-outline" size="sm" color={colors.neutral500} />
          <Text style={styles.zeroText}>Start your streak — book a court!</Text>
        </TouchableOpacity>
        {rewardsCount > 0 ? (
          <TouchableOpacity
            style={styles.rewardsPill}
            onPress={() => router.push('/rewards')}
            activeOpacity={0.7}
          >
            <Icon name="gift" size="sm" color={colors.primary} />
            <Text style={styles.rewardsPillText}>View rewards</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    )
  }

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.container}
        onPress={() => router.push('/(tabs)/profile')}
        activeOpacity={0.7}
      >
        <Icon name="flame" size="sm" color={colors.streak} />
        <Text style={styles.text}>
          <Text style={styles.bold}>{currentStreak} week streak</Text>
          {'  ·  Best: '}{longestStreak}
        </Text>
      </TouchableOpacity>
      {rewardsCount > 0 ? (
        <TouchableOpacity
          style={styles.rewardsPill}
          onPress={() => router.push('/rewards')}
          activeOpacity={0.7}
        >
          <Icon name="gift" size="sm" color={colors.primary} />
          <Text style={styles.rewardsPillText}>
            {rewardsCount === 1 ? 'View reward' : `View ${rewardsCount} rewards`}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.streakLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  containerZero: { backgroundColor: colors.neutral50 },
  text: { ...textStyles.bodySmall, color: colors.neutral700 },
  bold: { fontWeight: '700' },
  zeroText: { ...textStyles.bodySmall, color: colors.neutral500, fontWeight: '600' },
  rewardsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySurface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  rewardsPillText: {
    ...textStyles.caption,
    color: colors.primary,
    fontWeight: '700',
  },
})
