import { useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { supabase } from '../../lib/supabase'
import { useClubStore } from '../../store/clubStore'
import { useBookingStore } from '../../store/bookingStore'
import { useMembershipStore } from '../../store/membershipStore'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function CourtSelectScreen() {
  const router = useRouter()
  const { selectedClub } = useClubStore()
  const { setSelectedCourt, setSelectedDate } = useBookingStore()
  const tier = useMembershipStore((s) => s.tier)

  const [loading, setLoading] = useState(true)
  const [courts, setCourts] = useState([])
  const [calendarOpen, setCalendarOpen] = useState(false)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const [selectedDateObj, setSelectedDateObj] = useState(today)
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear] = useState(today.getFullYear())

  const selectedDateStr = toDateStr(selectedDateObj)

  // Build calendar grid for the current view month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const startDow = firstDay.getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + 90)

    const cells = []
    // Leading blanks
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d)
      date.setHours(0, 0, 0, 0)
      const isPast = date < today
      const isTooFar = date > maxDate
      cells.push({ date, day: d, disabled: isPast || isTooFar })
    }
    return cells
  }, [viewMonth, viewYear, today])

  const canGoPrev = viewYear > today.getFullYear() || viewMonth > today.getMonth()
  const maxMonth = new Date(today)
  maxMonth.setDate(maxMonth.getDate() + 90)
  const canGoNext =
    viewYear < maxMonth.getFullYear() ||
    (viewYear === maxMonth.getFullYear() && viewMonth < maxMonth.getMonth())

  const goToPrevMonth = () => {
    if (!canGoPrev) return
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (!canGoNext) return
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const handleDateSelect = (cell) => {
    if (!cell || cell.disabled) return
    setSelectedDateObj(cell.date)
    setCalendarOpen(false)
  }

  useEffect(() => {
    if (selectedClub?.id) fetchCourts()
  }, [selectedClub?.id])

  const fetchCourts = async () => {
    try {
      const { data, error } = await supabase
        .from('courts')
        .select('id, name, sport, hourly_rate, is_active')
        .eq('club_id', selectedClub.id)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setCourts(data || [])
    } catch (err) {
      console.error('Error fetching courts:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCourtSelect = (court) => {
    setSelectedCourt(court)
    setSelectedDate(selectedDateStr)
    router.push(`/courts/${court.id}/book?date=${selectedDateStr}`)
  }

  const isFree = tier?.can_book_free
  const discountPercent = tier?.discount_percent ?? 0

  const getDisplayPrice = (hourlyRate) => {
    if (isFree) return null
    if (discountPercent > 0) {
      const discounted = hourlyRate * (1 - discountPercent / 100)
      return Math.round(discounted * 100) / 100
    }
    return hourlyRate
  }

  const formatSelectedDate = () => {
    const isToday = isSameDay(selectedDateObj, today)
    const dayName = isToday ? 'Today' : selectedDateObj.toLocaleDateString('en-US', { weekday: 'short' })
    return `${dayName}, ${MONTH_NAMES[selectedDateObj.getMonth()]} ${selectedDateObj.getDate()}`
  }

  if (!selectedClub) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No club selected</Text>
        <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
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
        <Text style={styles.title}>Select Court</Text>
        <Text style={styles.subtitle}>{selectedClub.name}</Text>
      </View>

      {/* Date Picker Dropdown */}
      <View style={styles.dateSection}>
        <TouchableOpacity
          style={styles.datePicker}
          onPress={() => setCalendarOpen(!calendarOpen)}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={20} color="#2563eb" />
          <Text style={styles.datePickerText}>{formatSelectedDate()}</Text>
          <Ionicons
            name={calendarOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#64748b"
          />
        </TouchableOpacity>

        {calendarOpen && (
          <View style={styles.calendarDropdown}>
            {/* Month/Year header with arrows */}
            <View style={styles.calMonthRow}>
              <TouchableOpacity
                onPress={goToPrevMonth}
                style={[styles.calArrow, !canGoPrev && styles.calArrowDisabled]}
                disabled={!canGoPrev}
              >
                <Ionicons name="chevron-back" size={20} color={canGoPrev ? '#1e293b' : '#cbd5e1'} />
              </TouchableOpacity>
              <Text style={styles.calMonthLabel}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity
                onPress={goToNextMonth}
                style={[styles.calArrow, !canGoNext && styles.calArrowDisabled]}
                disabled={!canGoNext}
              >
                <Ionicons name="chevron-forward" size={20} color={canGoNext ? '#1e293b' : '#cbd5e1'} />
              </TouchableOpacity>
            </View>

            {/* Day-of-week headers */}
            <View style={styles.calDowRow}>
              {DAY_LABELS.map((d) => (
                <Text key={d} style={styles.calDowText}>{d}</Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={styles.calGrid}>
              {calendarDays.map((cell, i) => {
                if (!cell) {
                  return <View key={`blank-${i}`} style={styles.calCell} />
                }
                const isSelected = isSameDay(cell.date, selectedDateObj)
                const isToday = isSameDay(cell.date, today)
                return (
                  <TouchableOpacity
                    key={`day-${cell.day}`}
                    style={[
                      styles.calCell,
                      isSelected && styles.calCellSelected,
                      isToday && !isSelected && styles.calCellToday,
                    ]}
                    onPress={() => handleDateSelect(cell)}
                    disabled={cell.disabled}
                    activeOpacity={0.6}
                  >
                    <Text
                      style={[
                        styles.calDayText,
                        isSelected && styles.calDayTextSelected,
                        isToday && !isSelected && styles.calDayTextToday,
                        cell.disabled && styles.calDayTextDisabled,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}
      </View>

      {/* Courts */}
      <ScrollView
        style={styles.courtsScroll}
        contentContainerStyle={styles.courtsContent}
        showsVerticalScrollIndicator={false}
      >
        {courts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="tennisball-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No courts available</Text>
            <Text style={styles.emptySubtitle}>
              No courts found for this club
            </Text>
          </View>
        ) : (
          courts.map((court) => {
            const displayPrice = getDisplayPrice(court.hourly_rate)
            return (
              <TouchableOpacity
                key={court.id}
                style={styles.courtCard}
                onPress={() => handleCourtSelect(court)}
                activeOpacity={0.7}
              >
                <View style={styles.courtInfo}>
                  <Text style={styles.courtName}>{court.name}</Text>
                </View>

                <View style={styles.courtPriceSection}>
                  {isFree ? (
                    <View style={styles.freeBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#15803d" />
                      <Text style={styles.freeText}>Free</Text>
                    </View>
                  ) : (
                    <View style={styles.priceColumn}>
                      {discountPercent > 0 && (
                        <Text style={styles.originalPrice}>
                          ${court.hourly_rate.toFixed(2)}/hr
                        </Text>
                      )}
                      <Text style={styles.courtPrice}>
                        ${displayPrice.toFixed(2)}/hr
                      </Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                </View>
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
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
    paddingHorizontal: 40,
  },
  header: { paddingHorizontal: 20, marginBottom: 20 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  backText: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', color: '#1e293b' },
  subtitle: { fontSize: 15, color: '#64748b', marginTop: 4 },

  // Date picker
  dateSection: { paddingHorizontal: 20, marginBottom: 16, zIndex: 10 },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  datePickerText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },

  // Calendar dropdown
  calendarDropdown: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  calMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  calArrowDisabled: { opacity: 0.4 },
  calMonthLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
  },
  calDowRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calDowText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: '14.28%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCellSelected: {
    backgroundColor: '#2563eb',
    borderRadius: 22,
    width: 40,
    height: 40,
  },
  calCellToday: {
    borderWidth: 2,
    borderColor: '#2563eb',
    borderRadius: 22,
    width: 40,
    height: 40,
  },
  calDayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  calDayTextSelected: {
    color: '#ffffff',
  },
  calDayTextToday: {
    color: '#2563eb',
  },
  calDayTextDisabled: {
    color: '#d1d5db',
  },

  // Courts list
  courtsScroll: { flex: 1 },
  courtsContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  courtCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  courtInfo: { flex: 1 },
  courtName: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  courtPriceSection: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  priceColumn: { alignItems: 'flex-end' },
  originalPrice: {
    fontSize: 12,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  courtPrice: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  freeText: { fontSize: 14, fontWeight: '700', color: '#15803d' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b' },
  emptySubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
  goBackBtn: {
    marginTop: 16,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  goBackText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
})
