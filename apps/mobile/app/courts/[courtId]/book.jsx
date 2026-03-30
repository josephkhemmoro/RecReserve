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
import { DEMAND_BG_COLORS } from '../../../lib/demandHelpers'
import { SlotDemandIndicator } from '../../../components/booking/SlotDemandIndicator'
import { DemandLegend } from '../../../components/booking/DemandLegend'

const SLOT_INCREMENT = 30 // 30-minute increments

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
    // Add close time as a possible end-time marker
    slots.push({
      minutes: endMins,
      time: `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`,
      isEndOnly: true,
    })
  }

  return slots.sort((a, b) => a.minutes - b.minutes)
}

function formatTime12(time24) {
  const [h, m] = time24.split(':').map(Number)
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
  const [startSlot, setStartSlot] = useState(null)
  const [endSlot, setEndSlot] = useState(null)

  const durationMinutes = startSlot && endSlot ? endSlot.minutes - startSlot.minutes : 0
  const hourlyRate = court?.hourly_rate ?? 0
  const pricing = usePricing(hourlyRate, durationMinutes)
  const { demandMap, isLoading: demandLoading } = useSlotDemand(selectedClub?.id, date)

  const dateObj = useMemo(() => new Date(date + 'T00:00:00'), [date])
  const dayOfWeek = dateObj.getDay()

  const allSlots = useMemo(
    () => generateTimeSlots(availability, dayOfWeek),
    [availability, dayOfWeek]
  )

  // Filter out end-only markers for display (only used as valid end times)
  const displaySlots = allSlots.filter((s) => !s.isEndOnly)

  useEffect(() => {
    fetchData()
  }, [courtId, date])

  // Realtime subscription
  useEffect(() => {
    if (!courtId) return
    const channel = supabase
      .channel(`reservations-book-${courtId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `court_id=eq.${courtId}`,
        },
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
      const dayStart = `${date}T00:00:00`
      const dayEnd = `${date}T23:59:59`

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

  const isSlotBooked = (slot) => {
    const slotStart = slot.minutes
    const slotEnd = slotStart + SLOT_INCREMENT

    return reservations.some((r) => {
      const rStart = new Date(r.start_time)
      const rStartMins = rStart.getHours() * 60 + rStart.getMinutes()
      const rEnd = new Date(r.end_time)
      const rEndMins = rEnd.getHours() * 60 + rEnd.getMinutes()
      return slotStart < rEndMins && slotEnd > rStartMins
    })
  }

  const isSlotPast = (slot) => {
    const now = new Date()
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    if (date > todayLocal) return false
    if (date < todayLocal) return true
    const nowMins = now.getHours() * 60 + now.getMinutes()
    return slot.minutes < nowMins
  }

  const isSlotInRange = (slot) => {
    if (!startSlot || !endSlot) return false
    return slot.minutes >= startSlot.minutes && slot.minutes < endSlot.minutes
  }

  const isSlotStart = (slot) => startSlot && slot.minutes === startSlot.minutes

  // Check if selecting this end would cross a booked slot
  const wouldCrossBooking = (start, end) => {
    return displaySlots.some((s) => {
      return s.minutes >= start.minutes && s.minutes < end.minutes && isSlotBooked(s)
    })
  }

  const handleSlotPress = (slot) => {
    if (isSlotBooked(slot) || isSlotPast(slot)) return

    if (!startSlot) {
      // First tap: select start
      setStartSlot(slot)
      setEndSlot(null)
    } else if (!endSlot) {
      if (slot.minutes <= startSlot.minutes) {
        // Tapped before or same as start — reset to this as new start
        setStartSlot(slot)
        setEndSlot(null)
      } else {
        // Check for bookings between start and this slot
        const candidateEnd = { minutes: slot.minutes + SLOT_INCREMENT, time: '' }
        if (wouldCrossBooking(startSlot, candidateEnd)) {
          // Can't cross a booked slot — reset
          setStartSlot(slot)
          setEndSlot(null)
        } else {
          setEndSlot({ minutes: slot.minutes + SLOT_INCREMENT, time: '' })
        }
      }
    } else {
      // Both selected — start over
      setStartSlot(slot)
      setEndSlot(null)
    }
  }

  const handleContinue = () => {
    if (!startSlot || !endSlot || durationMinutes <= 0) return

    const endTime = `${String(Math.floor(endSlot.minutes / 60)).padStart(2, '0')}:${String(endSlot.minutes % 60).padStart(2, '0')}`

    setTimeRange(startSlot.time, endTime, durationMinutes)
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
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={22} color="#2563eb" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{court?.name || 'Select Time'}</Text>
        <Text style={styles.subtitle}>{formatDisplayDate()}</Text>
      </View>

      {/* Instructions */}
      <View style={styles.instructionBar}>
        <Ionicons
          name={!startSlot ? 'hand-left-outline' : 'resize-outline'}
          size={16}
          color="#64748b"
        />
        <Text style={styles.instructionText}>
          {!startSlot
            ? 'Tap a slot to set your start time'
            : !endSlot
              ? 'Now tap a slot to set your end time'
              : 'Tap a slot to start over'}
        </Text>
      </View>

      {/* Demand legend */}
      {!demandLoading && Object.keys(demandMap).length > 0 && <DemandLegend />}

      {/* Scarcity nudge for prime-time */}
      {!demandLoading && displaySlots.some((s) => {
        const mins = s.minutes
        const demand = demandMap[s.time]
        return mins >= 17 * 60 && mins < 20 * 60 && demand?.demandLevel === 'almost_full'
      }) && (
        <View style={styles.nudgeBanner}>
          <Text style={styles.nudgeText}>Popular day! Prime-time slots are filling fast.</Text>
        </View>
      )}

      {/* Time slots */}
      <ScrollView
        style={styles.slotsScroll}
        contentContainerStyle={styles.slotsContent}
        showsVerticalScrollIndicator={false}
      >
        {displaySlots.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No availability</Text>
            <Text style={styles.emptySubtitle}>
              This court has no time slots for the selected day
            </Text>
          </View>
        ) : (
          displaySlots.map((slot) => {
            const booked = isSlotBooked(slot)
            const past = isSlotPast(slot)
            const inRange = isSlotInRange(slot)
            const isStart = isSlotStart(slot)
            const disabled = booked || past

            let slotStyle = styles.slotDefault
            let timeStyle = styles.slotTimeDefault
            let labelText = formatTime12(slot.time)
            let sublabel = ''
            const demand = demandMap[slot.time]
            const isAvailable = !past && !booked && !isStart && !inRange

            if (past) {
              slotStyle = styles.slotPast
              timeStyle = styles.slotTimePast
              sublabel = 'Past'
            } else if (booked) {
              slotStyle = styles.slotBooked
              timeStyle = styles.slotTimeBooked
              sublabel = 'Booked'
            } else if (isStart && !endSlot) {
              slotStyle = styles.slotStart
              timeStyle = styles.slotTimeSelected
              sublabel = 'Start'
            } else if (inRange) {
              slotStyle = styles.slotInRange
              timeStyle = styles.slotTimeSelected
            } else if (isStart) {
              slotStyle = styles.slotStart
              timeStyle = styles.slotTimeSelected
              sublabel = 'Start'
            }

            // Apply demand background tint to available slots only
            const demandBg = isAvailable && demand
              ? { backgroundColor: DEMAND_BG_COLORS[demand.demandLevel] || '#ffffff' }
              : null

            return (
              <TouchableOpacity
                key={slot.minutes}
                style={[styles.slotRow, slotStyle, demandBg]}
                onPress={() => handleSlotPress(slot)}
                disabled={disabled}
                activeOpacity={0.6}
              >
                <Text style={[styles.slotTime, timeStyle]}>{labelText}</Text>
                {sublabel ? (
                  <Text style={[styles.slotSublabel, booked && styles.slotSublabelBooked]}>
                    {sublabel}
                  </Text>
                ) : null}
                {isAvailable && demand && (
                  <SlotDemandIndicator demandLevel={demand.demandLevel} compact />
                )}
                {inRange && !isStart && (
                  <View style={styles.selectedDot} />
                )}
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>

      {/* Bottom bar with pricing and continue */}
      {startSlot && endSlot && durationMinutes > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomInfo}>
            <Text style={styles.bottomTimeRange}>
              {formatTime12(startSlot.time)} – {formatTime12(
                `${String(Math.floor(endSlot.minutes / 60)).padStart(2, '0')}:${String(endSlot.minutes % 60).padStart(2, '0')}`
              )}
            </Text>
            <Text style={styles.bottomDuration}>
              {durationMinutes >= 60
                ? `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 > 0 ? ` ${durationMinutes % 60}m` : ''}`
                : `${durationMinutes}m`}
            </Text>
          </View>
          <View style={styles.bottomPriceRow}>
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
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 60 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  header: { paddingHorizontal: 20, marginBottom: 12 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  backText: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', color: '#1e293b' },
  subtitle: { fontSize: 15, color: '#64748b', marginTop: 4 },

  instructionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 10,
  },
  instructionText: { fontSize: 13, color: '#64748b', fontWeight: '500' },

  nudgeBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  nudgeText: {
    fontSize: 13,
    color: '#c2410c',
    fontWeight: '500',
    textAlign: 'center',
  },
  slotsScroll: { flex: 1 },
  slotsContent: { paddingHorizontal: 20, paddingBottom: 20 },

  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  slotDefault: {
    backgroundColor: '#ffffff',
    borderColor: '#f1f5f9',
  },
  slotPast: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    opacity: 0.5,
  },
  slotBooked: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  slotStart: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  slotInRange: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },

  slotTime: { fontSize: 16, fontWeight: '600', flex: 1 },
  slotTimeDefault: { color: '#1e293b' },
  slotTimePast: { color: '#cbd5e1' },
  slotTimeBooked: { color: '#dc2626' },
  slotTimeSelected: { color: '#ffffff' },

  slotSublabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  slotSublabelBooked: { color: '#dc2626' },

  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  emptySubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },

  // Bottom bar
  bottomBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
  },
  bottomInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bottomTimeRange: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  bottomDuration: { fontSize: 13, color: '#64748b' },
  bottomPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  bottomPrice: { fontSize: 22, fontWeight: '700', color: '#2563eb' },
  bottomPriceFree: { fontSize: 22, fontWeight: '700', color: '#15803d' },
  bottomDiscount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  continueButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
})
