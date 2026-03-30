import { View, Text, StyleSheet } from 'react-native'
import { DEMAND_COLORS, DEMAND_LABELS } from '../../lib/demandHelpers'

export function SlotDemandIndicator({ demandLevel, compact = false }) {
  const color = DEMAND_COLORS[demandLevel] || DEMAND_COLORS.open

  if (compact) {
    return <View style={[styles.dot, { backgroundColor: color }]} />
  }

  return (
    <View style={styles.full}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>
        {DEMAND_LABELS[demandLevel] || 'Open'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  full: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
})
