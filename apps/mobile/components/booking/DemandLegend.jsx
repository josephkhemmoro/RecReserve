import { View, Text, StyleSheet } from 'react-native'
import { DEMAND_COLORS, DEMAND_LABELS } from '../../lib/demandHelpers'

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
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
})
