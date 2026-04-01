import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { localDayStart, localDayEnd } from '../../../lib/dateUtils'
import { colors, textStyles, spacing, borderRadius, shadows } from '../../../theme'
import { Icon } from '../../ui'

function generateDates(count) {
  const dates = []
  const today = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    dates.push({
      date: d,
      dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      dayName: i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
    })
  }
  return dates
}

export function BookTab({ clubId, tier }) {
  const router = useRouter()
  const [dates] = useState(() => generateDates(14))
  const [selectedDate, setSelectedDate] = useState(dates[0].dateStr)
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchCourts = useCallback(async () => {
    if (!clubId) return
    setLoading(true)
    try {
      const dateObj = new Date(selectedDate + 'T00:00:00')
      const dow = dateObj.getDay()

      const [courtsRes, availRes, resRes] = await Promise.all([
        supabase.from('courts').select('id, name, hourly_rate, is_free').eq('club_id', clubId).eq('is_active', true).order('name'),
        supabase.from('court_availability').select('court_id, open_time, close_time').eq('day_of_week', dow),
        supabase.from('reservations').select('court_id, start_time, end_time')
          .eq('club_id', clubId).eq('status', 'confirmed')
          .gte('start_time', localDayStart(dateObj)).lte('start_time', localDayEnd(dateObj)),
      ])

      const allCourts = courtsRes.data || []
      const courtIds = new Set(allCourts.map((c) => c.id))
      const avail = (availRes.data || []).filter((a) => courtIds.has(a.court_id))
      const reservations = resRes.data || []

      const enriched = allCourts.map((court) => {
        const courtAvail = avail.find((a) => a.court_id === court.id)
        if (!courtAvail) return { ...court, availableSlots: 0 }

        const [oh, om] = courtAvail.open_time.split(':').map(Number)
        const [ch, cm] = courtAvail.close_time.split(':').map(Number)
        const totalSlots = ((ch * 60 + cm) - (oh * 60 + om)) / 30

        const courtRes = reservations.filter((r) => r.court_id === court.id)
        let bookedSlots = 0
        for (const r of courtRes) {
          const s = new Date(r.start_time)
          const e = new Date(r.end_time)
          bookedSlots += (e.getTime() - s.getTime()) / 1800000
        }

        return { ...court, availableSlots: Math.max(0, totalSlots - bookedSlots) }
      })

      setCourts(enriched)
    } catch (err) {
      console.error('Error fetching courts:', err)
    } finally {
      setLoading(false)
    }
  }, [clubId, selectedDate])

  useEffect(() => { fetchCourts() }, [fetchCourts])

  const isFree = tier?.can_book_free
  const discount = tier?.discount_percent ?? 0

  const getPrice = (rate) => {
    if (isFree) return 'Free'
    if (discount > 0) return `$${(rate * (1 - discount / 100)).toFixed(0)}/hr`
    return `$${rate}/hr`
  }

  return (
    <View style={styles.container}>
      {/* Date Strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
        {dates.map((d) => {
          const active = d.dateStr === selectedDate
          return (
            <TouchableOpacity key={d.dateStr} style={[styles.dateChip, active && styles.dateChipActive]} onPress={() => setSelectedDate(d.dateStr)}>
              <Text style={[styles.dateDayName, active && styles.dateDayNameActive]}>{d.dayName}</Text>
              <Text style={[styles.dateDayNum, active && styles.dateDayNumActive]}>{d.dayNum}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Courts */}
      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="small" color={colors.primary} /></View>
      ) : courts.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No courts available</Text></View>
      ) : (
        courts.map((court) => (
          <TouchableOpacity
            key={court.id}
            style={styles.courtCard}
            onPress={() => router.push(`/courts/${court.id}/book?date=${selectedDate}`)}
            activeOpacity={0.7}
          >
            <View style={styles.courtInfo}>
              <Text style={styles.courtName}>{court.name}</Text>
              <Text style={styles.courtMeta}>
                {court.is_free ? 'Free' : getPrice(court.hourly_rate)} · {court.availableSlots} slots available
              </Text>
            </View>
            <View style={styles.bookArrow}>
              <Text style={styles.bookText}>Book</Text>
              <Icon name="chevron-forward" size="sm" color={colors.primary} />
            </View>
          </TouchableOpacity>
        ))
      )}
      <View style={{ height: 100 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.md },
  dateStrip: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg },
  dateChip: {
    width: 56, height: 64, borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral50, alignItems: 'center', justifyContent: 'center',
  },
  dateChipActive: { backgroundColor: colors.primary },
  dateDayName: { ...textStyles.caption, color: colors.neutral500, marginBottom: 2 },
  dateDayNameActive: { color: colors.white },
  dateDayNum: { fontSize: 18, fontWeight: '700', color: colors.neutral800 },
  dateDayNumActive: { color: colors.white },

  courtCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.base, borderWidth: 1, borderColor: colors.neutral100,
  },
  courtInfo: { flex: 1 },
  courtName: { ...textStyles.bodyMedium, color: colors.neutral900 },
  courtMeta: { ...textStyles.caption, color: colors.neutral500, marginTop: 2 },
  bookArrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bookText: { ...textStyles.label, color: colors.primary },

  loadingWrap: { paddingVertical: spacing['3xl'], alignItems: 'center' },
  empty: { paddingVertical: spacing['3xl'], alignItems: 'center' },
  emptyText: { ...textStyles.bodySmall, color: colors.neutral400 },
})
