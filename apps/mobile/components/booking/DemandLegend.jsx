import { View, Text, StyleSheet } from 'react-native'
import { DEMAND_COLORS, DEMAND_LABELS } from '../../lib/demandHelpers'
import { textStyles, spacing, colors } from '../../theme'

const LEVELS = ['open', 'filling', 'busy', 'almost_full']

export function DemandLegend() {
  return (
    <View style={styles.container}>
      {LEVELS.map((level) => (
        <View key={level} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: DEMAND_COLORS[level] }]} />
          <Text style={styles.label}>{DEMAND_LABELS[level]}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { ...textStyles.caption, color: colors.neutral500 },
})
