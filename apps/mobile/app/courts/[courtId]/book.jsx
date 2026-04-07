import { useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { supabase } from '../../../lib/supabase'
import { useBookingStore } from '../../../store/bookingStore'
import { useClubStore } from '../../../store/clubStore'
import { usePricing } from '../../../lib/usePricing'
import { useSlotDemand } from '../../../lib/useSlotDemand'
import { DEMAND_COLORS } from '../../../lib/demandHelpers'
import { localDayStart, localDayEnd } from '../../../lib/dateUtils'
import { colors, spacing, borderRadius, shadows, fontSizes, fontWeights, layout } from '../../../theme'

const SLOT_INCREMENT = 30

const DURATION_OPTIONS = [
  { mins: 30, label: '30m' },
  { mins: 60, label: '1h' },
  { mins: 90, label: '1.5h' },
  { mins: 120, label: '2h' },
]

function generateTimeSlots(availability, dayOfWeek) {
  const dayAvail = availability.filter((a) => a.day_of_week === dayOfWeek)
  const slots = []

  for (const avail of dayAvail) {
    const [startH, startM] = avail.open_time.split(':').map(Number)
    const [endH, endM] = avail.close_time.split(':').map(Number)
    const startMins = startH * 60 + startM
    const endMins = endH * 60 + endM

    for (let m = startMins; m < endMins; m += SLOT_INCREMENT) {
      slots.push({
        minutes: m,
        time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
      })
    }
  }

  return slots.sort((a, b) => a.minutes - b.minutes)
}

function formatTime12(time24) {
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function minsToTime12(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function BookCourtScreen() {
  const router = useRouter()
  const { courtId, date } = useLocalSearchParams()
  const {
    selectedCourt,
    setTimeRange,
    setPriceBreakdown,
  } = useBookingStore()
  const { selectedClub } = useClubStore()

  const [court, setCourt] = useState(selectedCourt)
  const [availability, setAvailability] = useState([])
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStart, setSelectedStart] = useState(null)
  const [selectedDuration, setSelectedDuration] = useState(60)

  const hourlyRate = court?.hourly_rate ?? 0
  const pricing = usePricing(hourlyRate, selectedStart ? selectedDuration : 0)
  const { demandMap } = useSlotDemand(selectedClub?.id, date)

  const dateObj = useMemo(() => new Date(date + 'T00:00:00'), [date])
  const dayOfWeek = dateObj.getDay()

  const allSlots = useMemo(
    () => generateTimeSlots(availability, dayOfWeek),
    [availability, dayOfWeek]
  )


  useEffect(() => {
    fetchData()
  }, [courtId, date])

  useEffect(() => {
    if (!courtId) return
    const channel = supabase
      .channel(`reservations-book-${courtId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations', filter: `court_id=eq.${courtId}` },
        () => fetchReservations()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [courtId, date])

  const fetchData = async () => {
    try {
      const [courtRes, availRes] = await Promise.all([
        court
          ? Promise.resolve({ data: court, error: null })
          : supabase.from('courts').select('*').eq('id', courtId).single(),
        supabase.from('court_availability').select('*').eq('court_id', courtId),
      ])
      if (courtRes.error) throw courtRes.error
      setCourt(courtRes.data)
      setAvailability(availRes.data || [])
      await fetchReservations()
    } catch (err) {
      console.error('Error fetching court data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchReservations = async () => {
    try {
      const dateForBounds = new Date(date + 'T00:00:00')
      const dayStart = localDayStart(dateForBounds)
      const dayEnd = localDayEnd(dateForBounds)
      const { data } = await supabase
        .from('reservations')
        .select('id, start_time, end_time, status')
        .eq('court_id', courtId)
        .eq('status', 'confirmed')
        .gte('start_time', dayStart)
        .lte('start_time', dayEnd)
      setReservations(data || [])
    } catch (err) {
      console.error('Error fetching reservations:', err)
    }
  }

  const isSlotBooked = (slotMins) => {
    const slotEnd = slotMins + SLOT_INCREMENT
    return reservations.some((r) => {
      const rStart = new Date(r.start_time)
      const rStartMins = rStart.getHours() * 60 + rStart.getMinutes()
      const rEnd = new Date(r.end_time)
      const rEndMins = rEnd.getHours() * 60 + rEnd.getMinutes()
      return slotMins < rEndMins && slotEnd > rStartMins
    })
  }

  const isSlotPast = (slotMins) => {
    const now = new Date()
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    if (date > todayLocal) return false
    if (date < todayLocal) return true
    return slotMins < now.getHours() * 60 + now.getMinutes()
  }

  // Check if a duration is valid for a given start
  const isDurationValid = (startMins, durationMins) => {
    const endMins = startMins + durationMins
    // Check every 30-min block in the range
    for (let m = startMins; m < endMins; m += SLOT_INCREMENT) {
      if (isSlotBooked(m)) return false
      // Check if slot exists in availability
      if (!allSlots.some((s) => s.minutes === m)) return false
    }
    return true
  }

  // Get demand color for a slot
  const getDemandDot = (slotTime) => {
    const demand = demandMap[slotTime]
    if (!demand) return null
    return DEMAND_COLORS[demand.demandLevel] || null
  }

  // Compute end time
  const endMins = selectedStart ? selectedStart.minutes + selectedDuration : 0
  const endTime = endMins > 0 ? `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}` : ''

  const canContinue = selectedStart && selectedDuration > 0 && isDurationValid(selectedStart.minutes, selectedDuration)

  const handleContinue = () => {
    if (!canContinue) return
    setTimeRange(selectedStart.time, endTime, selectedDuration)
    setPriceBreakdown(pricing)
    router.push('/booking/confirm')
  }

  const formatDisplayDate = () => {
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{court?.name || 'Select Time'}</Text>
        <Text style={styles.subtitle}>{formatDisplayDate()}</Text>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Duration selector */}
        <Text style={styles.sectionLabel}>Duration</Text>
        <View style={styles.durationRow}>
          {DURATION_OPTIONS.map((opt) => {
            const active = selectedDuration === opt.mins
            const valid = selectedStart ? isDurationValid(selectedStart.minutes, opt.mins) : true
            return (
              <TouchableOpacity
                key={opt.mins}
                style={[styles.durationChip, active && styles.durationChipActive, !valid && styles.durationChipDisabled]}
                onPress={() => valid && setSelectedDuration(opt.mins)}
                disabled={!valid}
                activeOpacity={0.7}
              >
                <Text style={[styles.durationText, active && styles.durationTextActive, !valid && styles.durationTextDisabled]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Start time grid */}
        <Text style={styles.sectionLabel}>Start Time</Text>

        {allSlots.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={colors.neutral300} />
            <Text style={styles.emptyTitle}>No availability</Text>
            <Text style={styles.emptySubtitle}>This court has no time slots for this day</Text>
          </View>
        ) : (
          <View style={styles.slotGrid}>
            {allSlots.map((slot) => {
              const booked = isSlotBooked(slot.minutes)
              const past = isSlotPast(slot.minutes)
              const disabled = booked || past
              const isSelected = selectedStart?.minutes === slot.minutes
              const canFitDuration = !disabled && isDurationValid(slot.minutes, selectedDuration)
              const demandColor = getDemandDot(slot.time)

              // If this start + selected duration doesn't fit, dim it
              const dimmed = !disabled && !canFitDuration

              return (
                <TouchableOpacity
                  key={slot.minutes}
                  style={[
                    styles.slotCell,
                    isSelected && styles.slotCellSelected,
                    disabled && styles.slotCellDisabled,
                    dimmed && styles.slotCellDimmed,
                  ]}
                  onPress={() => {
                    if (disabled) return
                    if (canFitDuration) {
                      setSelectedStart(slot)
                    } else {
                      // Try to find a shorter valid duration
                      for (const opt of DURATION_OPTIONS) {
                        if (isDurationValid(slot.minutes, opt.mins)) {
                          setSelectedStart(slot)
                          setSelectedDuration(opt.mins)
                          return
                        }
                      }
                    }
                  }}
                  disabled={disabled}
                  activeOpacity={0.6}
                >
                  <Text style={[
                    styles.slotCellTime,
                    isSelected && styles.slotCellTimeSelected,
                    disabled && styles.slotCellTimeDisabled,
                    dimmed && styles.slotCellTimeDimmed,
                  ]}>
                    {formatTime12(slot.time)}
                  </Text>
                  {!disabled && !isSelected && demandColor && (
                    <View style={[styles.demandDot, { backgroundColor: demandColor }]} />
                  )}
                  {booked && <Text style={styles.bookedLabel}>Booked</Text>}
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Bottom bar */}
      {selectedStart && canContinue && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomSummary}>
            <View>
              <Text style={styles.bottomTimeRange}>
                {formatTime12(selectedStart.time)} – {minsToTime12(endMins)}
              </Text>
              <Text style={styles.bottomDuration}>
                {selectedDuration >= 60
                  ? `${Math.floor(selectedDuration / 60)}h${selectedDuration % 60 > 0 ? ` ${selectedDuration % 60}m` : ''}`
                  : `${selectedDuration}m`}
              </Text>
            </View>
            <View style={styles.bottomPriceCol}>
              {pricing.is_free ? (
                <Text style={styles.bottomPriceFree}>Free</Text>
              ) : (
                <Text style={styles.bottomPrice}>${pricing.final_price.toFixed(2)}</Text>
              )}
              {pricing.discount_amount > 0 && !pricing.is_free && (
                <Text style={styles.bottomDiscount}>
                  {Math.round((pricing.discount_amount / pricing.base_price) * 100)}% off
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
  header: { paddingHorizontal: layout.screenPaddingH, marginBottom: spacing.base },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.base },
  backText: { fontSize: fontSizes.base, color: colors.primary, fontWeight: fontWeights.semibold },
  title: { fontSize: fontSizes.xl, fontWeight: fontWeights.heavy, color: colors.neutral900 },
  subtitle: { fontSize: fontSizes.base, color: colors.neutral500, marginTop: spacing.xs },

  mainScroll: { flex: 1 },
  mainContent: { paddingHorizontal: layout.screenPaddingH },

  sectionLabel: {
    fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.neutral400,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md, marginTop: spacing.xs,
  },

  // Duration chips
  durationRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  durationChip: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.neutral200,
    alignItems: 'center',
  },
  durationChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  durationChipDisabled: { opacity: 0.35 },
  durationText: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.neutral600 },
  durationTextActive: { color: colors.white },
  durationTextDisabled: { color: colors.neutral400 },

  // Slot grid
  slotGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  slotCell: {
    width: '31%',
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.neutral200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotCellSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotCellDisabled: {
    backgroundColor: colors.white,
    borderColor: colors.neutral100,
  },
  slotCellDimmed: {
    opacity: 0.4,
  },
  slotCellTime: { fontSize: 14, fontWeight: fontWeights.semibold, color: colors.neutral900 },
  slotCellTimeSelected: { color: colors.white },
  slotCellTimeDisabled: { color: colors.neutral300 },
  slotCellTimeDimmed: { color: colors.neutral400 },
  bookedLabel: { fontSize: 9, fontWeight: fontWeights.semibold, color: colors.error, marginTop: 2 },
  demandDot: { width: 6, height: 6, borderRadius: 3, marginTop: spacing.xs },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: spacing.sm },
  emptyTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.neutral900 },
  emptySubtitle: { fontSize: 14, color: colors.neutral400, textAlign: 'center' },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1, borderTopColor: colors.neutral100,
    paddingHorizontal: layout.screenPaddingH, paddingTop: spacing.base, paddingBottom: 34,
  },
  bottomSummary: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md,
  },
  bottomTimeRange: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.neutral900 },
  bottomDuration: { fontSize: fontSizes.sm, color: colors.neutral500, marginTop: 2 },
  bottomPriceCol: { alignItems: 'flex-end' },
  bottomPrice: { fontSize: 22, fontWeight: fontWeights.heavy, color: colors.primary },
  bottomPriceFree: { fontSize: 22, fontWeight: fontWeights.heavy, color: colors.success },
  bottomDiscount: {
    fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.primary,
    backgroundColor: colors.primaryMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm, marginTop: 2,
  },
  continueButton: {
    backgroundColor: colors.primary, borderRadius: borderRadius.lg, padding: spacing.base,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  continueText: { color: colors.white, fontSize: fontSizes.md, fontWeight: fontWeights.bold },
})
