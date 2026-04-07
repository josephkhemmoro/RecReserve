import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, borderRadius } from '../../theme'

const DEMAND_COLORS = {
  open: colors.demandOpen,
  filling: colors.demandFilling,
  busy: colors.demandBusy,
  almost_full: colors.demandFull,
}

const DEMAND_LABELS = {
  open: 'Open',
  filling: 'Filling',
  busy: 'Busy',
  almost_full: 'Almost Full',
}

// Priority: almost_full > busy > filling > open
const DEMAND_PRIORITY = { almost_full: 3, busy: 2, filling: 1, open: 0 }

function formatHourLabel(hour) {
  if (hour === 0 || hour === 24) return '12a'
  if (hour === 12) return '12p'
  if (hour < 12) return `${hour}a`
  return `${hour - 12}p`
}

export function DemandHeatmap({ slots }) {
  // Bucket raw 30-min slots into hourly summaries
  const hourlyBuckets = useMemo(() => {
    if (!slots || slots.length === 0) return []

    const buckets = {}
    for (const slot of slots) {
      const [h] = slot.time.split(':').map(Number)
      if (!buckets[h]) {
        buckets[h] = { hour: h, totalCourts: 0, bookedCourts: 0, worstDemand: 'open' }
      }
      const b = buckets[h]
      b.totalCourts += slot.totalCourts
      b.bookedCourts += slot.bookedCourts
      if ((DEMAND_PRIORITY[slot.demandLevel] || 0) > (DEMAND_PRIORITY[b.worstDemand] || 0)) {
        b.worstDemand = slot.demandLevel
      }
    }

    return Object.values(buckets).sort((a, b) => a.hour - b.hour)
  }, [slots])

  if (hourlyBuckets.length === 0) return null

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Court Demand</Text>
        <View style={styles.legend}>
          {Object.entries(DEMAND_LABELS).map(([key, label]) => (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: DEMAND_COLORS[key] }]} />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.chart}>
        {hourlyBuckets.map((bucket) => {
          const pct = bucket.totalCourts > 0
            ? Math.max(8, Math.round((bucket.bookedCourts / bucket.totalCourts) * 100))
            : 8
          const barColor = DEMAND_COLORS[bucket.worstDemand] || colors.neutral300

          return (
            <View key={bucket.hour} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { backgroundColor: barColor, height: `${pct}%` },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{formatHourLabel(bucket.hour)}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.base,
    backgroundColor: colors.neutral50,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  headerRow: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 11, color: colors.neutral500 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 72,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: '100%',
    maxWidth: 28,
    height: 52,
    backgroundColor: colors.neutral200,
    borderRadius: 5,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 5,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.neutral500,
    marginTop: 4,
  },
})
