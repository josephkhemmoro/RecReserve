import { useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useBookingStore } from '../../../store/bookingStore'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function generateDates(count) {
  const dates = []
  const today = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    dates.push(d)
  }
  return dates
}

// Generate time slots from court_availability open_time/close_time
function generateSlots(availability, slotDuration) {
  const slots = []
  if (!availability) return slots

  for (const avail of availability) {
    const [startH, startM] = avail.open_time.split(':').map(Number)
    const [endH, endM] = avail.close_time.split(':').map(Number)
    const startMins = startH * 60 + startM
    const endMins = endH * 60 + endM

    for (let m = startMins; m + slotDuration <= endMins; m += slotDuration) {
      const h = Math.floor(m / 60)
      const min = m % 60
      const endSlotM = m + slotDuration
      const endSlotH = Math.floor(endSlotM / 60)
      const endSlotMin = endSlotM % 60

      slots.push({
        startTime: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
        endTime: `${String(endSlotH).padStart(2, '0')}:${String(endSlotMin).padStart(2, '0')}`,
        startMinutes: m,
      })
    }
  }

  return slots.sort((a, b) => a.startMinutes - b.startMinutes)
}

function formatSlotTime(time24) {
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function BookCourtScreen() {
  const router = useRouter()
  const { courtId } = useLocalSearchParams()
  const { user } = useAuthStore()
  const { setSelectedCourt, setSelectedDate, setSelectedSlot, setDuration, setPrice } = useBookingStore()

  const [court, setCourt] = useState(null)
  const [bookingRules, setBookingRules] = useState(null)
  const [availability, setAvailability] = useState([])
  const [reservations, setReservations] = useState([])
  const [userWaitlistIds, setUserWaitlistIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [selectedDateIdx, setSelectedDateIdx] = useState(0)

  const dates = useMemo(() => {
    const maxDays = bookingRules?.advance_booking_days || 7
    return generateDates(maxDays)
  }, [bookingRules?.advance_booking_days])

  const selectedDate = dates[selectedDateIdx]

  useEffect(() => {
    fetchCourtData()
  }, [courtId])

  useEffect(() => {
    if (selectedDate && court) {
      fetchReservationsForDate()
    }
  }, [selectedDateIdx, court?.id])

  // Realtime subscription: refresh slots when reservations change
  useEffect(() => {
    if (!courtId) return

    const channel = supabase
      .channel(`reservations-${courtId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `court_id=eq.${courtId}`,
        },
        () => {
          fetchReservationsForDate()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [courtId, selectedDateIdx])

  const fetchCourtData = async () => {
    try {
      const [courtRes, availRes] = await Promise.all([
        supabase.from('courts').select('*, club_id').eq('id', courtId).single(),
        supabase.from('court_availability').select('*').eq('court_id', courtId),
      ])

      if (courtRes.error) throw courtRes.error
      setCourt(courtRes.data)

      setAvailability(availRes.data || [])

      // Fetch booking rules for this court's club
      if (courtRes.data?.club_id) {
        const { data: rules } = await supabase
          .from('booking_rules')
          .select('*')
          .eq('club_id', courtRes.data.club_id)
          .single()

        if (rules) setBookingRules(rules)
      }
    } catch (err) {
      console.error('Error fetching court data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchReservationsForDate = async () => {
    const dayStart = new Date(selectedDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(selectedDate)
    dayEnd.setHours(23, 59, 59, 999)

    try {
      const { data } = await supabase
        .from('reservations')
        .select('id, start_time, end_time, status')
        .eq('court_id', courtId)
        .eq('status', 'confirmed')
        .gte('start_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString())

      setReservations(data || [])

      // Fetch waitlist entries for these reservations that belong to current user
      if (data && data.length > 0) {
        const reservationIds = data.map((r) => r.id)
        const { data: waitlistData } = await supabase
          .from('waitlists')
          .select('reservation_id')
          .eq('user_id', user?.id)
          .in('reservation_id', reservationIds)

        setUserWaitlistIds(new Set((waitlistData || []).map((w) => w.reservation_id)))
      } else {
        setUserWaitlistIds(new Set())
      }
    } catch (err) {
      console.error('Error fetching reservations:', err)
    }
  }

  const dayOfWeek = selectedDate ? selectedDate.getDay() : 0
  const dayAvailability = availability.filter((a) => a.day_of_week === dayOfWeek)
  const slotDuration = bookingRules?.max_booking_duration_mins || 60
  const slots = useMemo(
    () => generateSlots(dayAvailability, slotDuration),
    [dayAvailability, slotDuration]
  )

  const getSlotStatus = (slot) => {
    const slotStart = new Date(selectedDate)
    const [sh, sm] = slot.startTime.split(':').map(Number)
    slotStart.setHours(sh, sm, 0, 0)

    const slotEnd = new Date(selectedDate)
    const [eh, em] = slot.endTime.split(':').map(Number)
    slotEnd.setHours(eh, em, 0, 0)

    if (slotStart < new Date()) return { status: 'past', reservationId: null }

    // Find overlapping reservation
    const overlapping = reservations.find((r) => {
      const rStart = new Date(r.start_time)
      const rEnd = new Date(r.end_time)
      return slotStart < rEnd && slotEnd > rStart
    })

    if (overlapping) {
      const onWaitlist = userWaitlistIds.has(overlapping.id)
      return {
        status: onWaitlist ? 'waitlisted' : 'booked',
        reservationId: overlapping.id,
      }
    }

    return { status: 'available', reservationId: null }
  }

  const handleSlotPress = (slot, slotInfo) => {
    if (slotInfo.status === 'available') {
      const dateStr = selectedDate.toISOString().split('T')[0]

      setSelectedCourt(court)
      setSelectedDate(dateStr)
      setSelectedSlot(slot)
      setDuration(slotDuration)
      setPrice(0) // Price determined by edge function / club config

      router.push('/booking/confirm')
    } else if (slotInfo.status === 'booked' && slotInfo.reservationId) {
      handleJoinWaitlist(slotInfo.reservationId)
    }
  }

  const handleJoinWaitlist = async (reservationId) => {
    try {
      // Get current max position for this reservation's waitlist
      const { data: existing } = await supabase
        .from('waitlists')
        .select('position')
        .eq('reservation_id', reservationId)
        .order('position', { ascending: false })
        .limit(1)

      const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 1

      const { error } = await supabase.from('waitlists').insert({
        reservation_id: reservationId,
        user_id: user?.id,
        position: nextPosition,
      })

      if (error) throw error

      Alert.alert('Waitlisted', "You've been added to the waitlist for this slot.")
      fetchReservationsForDate()
    } catch (err) {
      console.error('Error joining waitlist:', err)
      Alert.alert('Error', 'Could not join waitlist. Please try again.')
    }
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{court?.name || 'Book Court'}</Text>
        {court && (
          <Text style={styles.subtitle}>
            {court.sport.charAt(0).toUpperCase() + court.sport.slice(1)}
          </Text>
        )}
      </View>

      {/* Date strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateStrip}
      >
        {dates.map((date, idx) => {
          const isSelected = idx === selectedDateIdx
          const isToday = idx === 0
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.dateChip, isSelected && styles.dateChipActive]}
              onPress={() => setSelectedDateIdx(idx)}
            >
              <Text style={[styles.dateDayName, isSelected && styles.dateTextActive]}>
                {isToday ? 'Today' : DAY_NAMES[date.getDay()]}
              </Text>
              <Text style={[styles.dateNum, isSelected && styles.dateTextActive]}>
                {date.getDate()}
              </Text>
              <Text style={[styles.dateMonth, isSelected && styles.dateTextActive]}>
                {MONTH_NAMES[date.getMonth()]}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Time slots */}
      <ScrollView
        style={styles.slotsContainer}
        contentContainerStyle={styles.slotsContent}
        showsVerticalScrollIndicator={false}
      >
        {slots.length === 0 ? (
          <View style={styles.emptySlots}>
            <Text style={styles.emptySlotsTitle}>No availability</Text>
            <Text style={styles.emptySlotsSubtitle}>
              This court has no time slots for the selected day
            </Text>
          </View>
        ) : (
          <View style={styles.slotsGrid}>
            {slots.map((slot, idx) => {
              const slotInfo = getSlotStatus(slot)
              const { status } = slotInfo
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.slot,
                    status === 'available' && styles.slotAvailable,
                    status === 'booked' && styles.slotBooked,
                    status === 'waitlisted' && styles.slotWaitlisted,
                    status === 'past' && styles.slotPast,
                  ]}
                  onPress={() => handleSlotPress(slot, slotInfo)}
                  disabled={status === 'past' || status === 'waitlisted'}
                >
                  <Text
                    style={[
                      styles.slotTime,
                      status === 'available' && styles.slotTimeAvailable,
                      status === 'booked' && styles.slotTimeBooked,
                      status === 'waitlisted' && styles.slotTimeWaitlisted,
                      status === 'past' && styles.slotTimePast,
                    ]}
                  >
                    {formatSlotTime(slot.startTime)}
                  </Text>
                  <Text
                    style={[
                      styles.slotLabel,
                      status === 'available' && styles.slotLabelAvailable,
                      status === 'booked' && styles.slotLabelBooked,
                      status === 'waitlisted' && styles.slotLabelWaitlisted,
                      status === 'past' && styles.slotLabelPast,
                    ]}
                  >
                    {status === 'available' && 'Available'}
                    {status === 'booked' && 'Join Waitlist'}
                    {status === 'waitlisted' && 'On Waitlist'}
                    {status === 'past' && 'Past'}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 60,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  backButton: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  dateStrip: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  dateChip: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 62,
  },
  dateChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  dateDayName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 2,
  },
  dateNum: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  dateMonth: {
    fontSize: 11,
    color: '#94a3b8',
  },
  dateTextActive: {
    color: '#ffffff',
  },
  slotsContainer: {
    flex: 1,
  },
  slotsContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slot: {
    width: '47%',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  slotAvailable: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  slotBooked: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  slotWaitlisted: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  slotPast: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  slotTime: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  slotTimeAvailable: { color: '#166534' },
  slotTimeBooked: { color: '#9a3412' },
  slotTimeWaitlisted: { color: '#92400e' },
  slotTimePast: { color: '#cbd5e1' },
  slotLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  slotLabelAvailable: { color: '#22c55e' },
  slotLabelBooked: { color: '#f97316' },
  slotLabelWaitlisted: { color: '#eab308' },
  slotLabelPast: { color: '#cbd5e1' },
  emptySlots: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptySlotsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  emptySlotsSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
})
