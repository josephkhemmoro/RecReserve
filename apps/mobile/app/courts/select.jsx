import { useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { supabase } from '../../lib/supabase'
import { useClubStore } from '../../store/clubStore'
import { useBookingStore } from '../../store/bookingStore'
import { useMembershipStore } from '../../store/membershipStore'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function generateDates(count = 14) {
  const dates = []
  const today = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    dates.push(d)
  }
  return dates
}

export default function CourtSelectScreen() {
  const router = useRouter()
  const { sport } = useLocalSearchParams()
  const { selectedClub } = useClubStore()
  const { setSelectedCourt, setSelectedDate } = useBookingStore()
  const tier = useMembershipStore((s) => s.tier)

  const [loading, setLoading] = useState(true)
  const [courts, setCourts] = useState([])
  const [selectedDateIdx, setSelectedDateIdx] = useState(0)

  const dates = useMemo(() => generateDates(14), [])
  const selectedDateObj = dates[selectedDateIdx]
  const selectedDateStr = selectedDateObj.toISOString().split('T')[0]

  useEffect(() => {
    if (selectedClub?.id && sport) fetchCourts()
  }, [selectedClub?.id, sport])

  const fetchCourts = async () => {
    try {
      const { data, error } = await supabase
        .from('courts')
        .select('id, name, sport, hourly_rate, is_active')
        .eq('club_id', selectedClub.id)
        .eq('is_active', true)
        .or(`sport.eq.${sport},sport.eq.both`)
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
        <Text style={styles.subtitle}>
          {sport === 'tennis' ? 'Tennis' : 'Pickleball'} at {selectedClub.name}
        </Text>
      </View>

      {/* Date Strip */}
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
              No {sport} courts found for this club
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

  // Date strip
  dateStrip: { paddingHorizontal: 16, paddingBottom: 20, gap: 8 },
  dateChip: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 62,
  },
  dateChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  dateDayName: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginBottom: 2 },
  dateNum: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  dateMonth: { fontSize: 11, color: '#94a3b8' },
  dateTextActive: { color: '#ffffff' },

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
