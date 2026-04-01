import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { colors, textStyles, spacing } from '../../theme'
import { Icon, SectionHeader } from '../ui'

const MILESTONES = [4, 8, 12, 26, 52]
const MILESTONE_LABELS = { 4: '1 Month\nStrong', 8: '2 Month\nWarrior', 12: 'Quarter\nMaster', 26: 'Half-Year\nHero', 52: 'Year-Round\nLegend' }
const MILESTONE_ICONS = { 4: 'flame', 8: 'flash', 12: 'trophy', 26: 'ribbon', 52: 'tennisball' }

export function StreakMilestones({ achievedMilestones, currentStreak }) {
  const achievedSet = new Set(achievedMilestones)
  const nextMilestone = MILESTONES.find((m) => !achievedSet.has(m))

  return (
    <View style={styles.container}>
      <SectionHeader title="Milestones" icon="medal-outline" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {MILESTONES.map((milestone) => {
          const isAchieved = achievedSet.has(milestone)
          const isNext = milestone === nextMilestone && currentStreak > 0
          const progress = isNext ? `${currentStreak}/${milestone}` : null
          return (
            <View key={milestone} style={styles.milestoneItem}>
              <View style={[styles.circle, isAchieved && styles.circleAchieved, isNext && styles.circleNext, !isAchieved && !isNext && styles.circleLocked]}>
                {isAchieved ? <Icon name={MILESTONE_ICONS[milestone]} size="md" color={colors.white} />
                  : isNext ? <Icon name={MILESTONE_ICONS[milestone]} size="md" color={colors.primary} style={{ opacity: 0.6 }} />
                  : <Icon name="lock-closed" size="sm" color={colors.neutral400} />}
              </View>
              <Text style={[styles.weekText, isAchieved && styles.weekTextAchieved, isNext && styles.weekTextNext]}>{progress || `${milestone}wk`}</Text>
              <Text style={[styles.labelText, isAchieved && styles.labelAchieved]}>{MILESTONE_LABELS[milestone]}</Text>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.base },
  scrollContent: { paddingRight: spacing.base, gap: spacing.base },
  milestoneItem: { alignItems: 'center', width: 64 },
  circle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  circleAchieved: { backgroundColor: colors.success },
  circleNext: { backgroundColor: colors.primarySurface, borderWidth: 2, borderColor: colors.primary },
  circleLocked: { backgroundColor: colors.neutral200 },
  weekText: { ...textStyles.caption, color: colors.neutral400, marginBottom: 2 },
  weekTextAchieved: { color: colors.success },
  weekTextNext: { color: colors.primary },
  labelText: { fontSize: 10, color: colors.neutral400, textAlign: 'center', lineHeight: 13 },
  labelAchieved: { color: colors.neutral600 },
})
