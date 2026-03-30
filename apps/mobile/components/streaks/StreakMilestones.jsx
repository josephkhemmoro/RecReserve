import { View, Text, ScrollView, StyleSheet } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'

const MILESTONES = [4, 8, 12, 26, 52]

const MILESTONE_LABELS = {
  4: '1 Month\nStrong',
  8: '2 Month\nWarrior',
  12: 'Quarter\nMaster',
  26: 'Half-Year\nHero',
  52: 'Year-Round\nLegend',
}

const MILESTONE_ICONS = {
  4: '🔥',
  8: '⚡',
  12: '🏆',
  26: '👑',
  52: '🎾',
}

export function StreakMilestones({ achievedMilestones, currentStreak }) {
  const achievedSet = new Set(achievedMilestones)

  // Find the next unachieved milestone
  const nextMilestone = MILESTONES.find((m) => !achievedSet.has(m))

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Milestones</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {MILESTONES.map((milestone) => {
          const isAchieved = achievedSet.has(milestone)
          const isNext = milestone === nextMilestone && currentStreak > 0
          const progress = isNext
            ? `${currentStreak}/${milestone}`
            : null

          return (
            <View key={milestone} style={styles.milestoneItem}>
              <View
                style={[
                  styles.circle,
                  isAchieved && styles.circleAchieved,
                  isNext && styles.circleNext,
                  !isAchieved && !isNext && styles.circleLocked,
                ]}
              >
                {isAchieved ? (
                  <Text style={styles.icon}>{MILESTONE_ICONS[milestone]}</Text>
                ) : isNext ? (
                  <Text style={styles.iconFaded}>{MILESTONE_ICONS[milestone]}</Text>
                ) : (
                  <Ionicons name="lock-closed" size={18} color="#9E9E9E" />
                )}
              </View>
              <Text style={[
                styles.weekText,
                isAchieved && styles.weekTextAchieved,
                isNext && styles.weekTextNext,
              ]}>
                {progress || `${milestone}wk`}
              </Text>
              <Text style={[
                styles.labelText,
                isAchieved && styles.labelAchieved,
              ]}>
                {MILESTONE_LABELS[milestone]}
              </Text>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  scrollContent: {
    paddingRight: 16,
    gap: 16,
  },
  milestoneItem: {
    alignItems: 'center',
    width: 64,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  circleAchieved: {
    backgroundColor: '#4CAF50',
  },
  circleNext: {
    backgroundColor: '#fff7ed',
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  circleLocked: {
    backgroundColor: '#E0E0E0',
  },
  icon: {
    fontSize: 24,
  },
  iconFaded: {
    fontSize: 24,
    opacity: 0.6,
  },
  weekText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9E9E9E',
    marginBottom: 2,
  },
  weekTextAchieved: {
    color: '#4CAF50',
  },
  weekTextNext: {
    color: '#FF6B35',
  },
  labelText: {
    fontSize: 10,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 13,
  },
  labelAchieved: {
    color: '#64748b',
  },
})
