import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useStripe } from '@stripe/stripe-react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useBookingStore } from '../../store/bookingStore'
import { useClubStore } from '../../store/clubStore'
import { useMembershipStore } from '../../store/membershipStore'
import { useStreakStore } from '../../store/streakStore'

const REPEAT_OPTIONS = [2, 4, 8, 12]

function formatTime12(time24) {
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function BookingConfirmScreen() {
  const router = useRouter()
  const { initPaymentSheet, presentPaymentSheet } = useStripe()
  const { user } = useAuthStore()
  const {
    selectedCourt,
    selectedDate,
    startTime,
    endTime,
    durationMinutes,
    priceBreakdown,
    repeatWeekly,
    repeatWeeks,
    guests,
    setRepeatWeekly,
    setRepeatWeeks,
    setGuests,
    clearBooking,
  } = useBookingStore()
  const { selectedClub } = useClubStore()
  const tier = useMembershipStore((s) => s.tier)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [guestInput, setGuestInput] = useState('')

  if (!selectedCourt || !selectedDate || !startTime || !endTime) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color="#94a3b8" />
        <Text style={styles.errorTitle}>No booking details</Text>
        <Text style={styles.errorSubtitle}>Please select a court and time first</Text>
        <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const isFree = priceBreakdown?.is_free ?? false
  const basePrice = priceBreakdown?.base_price ?? 0
  const discountAmount = priceBreakdown?.discount_amount ?? 0
  const finalPrice = priceBreakdown?.final_price ?? 0

  const totalSessions = repeatWeekly ? repeatWeeks : 1
  const totalPrice = finalPrice * totalSessions

  const formatDisplayDate = () => {
    return new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const addGuest = () => {
    const name = guestInput.trim()
    if (!name) return
    setGuests([...guests, name])
    setGuestInput('')
  }

  const removeGuest = (idx) => {
    setGuests(guests.filter((_, i) => i !== idx))
  }

  const generateWeeklyDates = () => {
    const dates = []
    const base = new Date(selectedDate + 'T00:00:00')
    for (let i = 0; i < repeatWeeks; i++) {
      const d = new Date(base)
      d.setDate(base.getDate() + i * 7)
      dates.push(d.toISOString().split('T')[0])
    }
    return dates
  }

  const handleConfirm = async () => {
    setError('')
    setLoading(true)

    try {
      let paymentIntentId = null

      // Skip Stripe if free
      if (!isFree && totalPrice > 0) {
        const { data: paymentData, error: fnError } = await supabase.functions.invoke(
          'create-payment-intent',
          {
            body: {
              amount: Math.round(totalPrice * 100),
              court_id: selectedCourt.id,
              user_id: user?.id,
              club_id: selectedClub?.id,
              date: selectedDate,
              start_time: startTime,
              end_time: endTime,
            },
          }
        )

        if (fnError) throw new Error(fnError.message || 'Failed to create payment')
        const { clientSecret } = paymentData
        paymentIntentId = paymentData.paymentIntentId

        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'RecReserve',
        })
        if (initError) throw new Error(initError.message)

        const { error: paymentError } = await presentPaymentSheet()
        if (paymentError) {
          if (paymentError.code === 'Canceled') {
            setLoading(false)
            return
          }
          throw new Error(paymentError.message)
        }
      }

      // Create reservations
      const seriesId = repeatWeekly ? crypto.randomUUID() : null
      const datesToBook = repeatWeekly ? generateWeeklyDates() : [selectedDate]
      const skippedDates = []

      for (const dateStr of datesToBook) {
        const startDT = `${dateStr}T${startTime}:00`
        const endDT = `${dateStr}T${endTime}:00`

        const { error: resErr } = await supabase.from('reservations').insert({
          court_id: selectedCourt.id,
          user_id: user?.id,
          club_id: selectedClub?.id,
          start_time: startDT,
          end_time: endDT,
          status: 'confirmed',
          guest_count: guests.length,
          guests: guests.length > 0 ? guests : [],
          stripe_payment_id: paymentIntentId,
          amount_paid: isFree ? 0 : finalPrice,
          series_id: seriesId,
        })

        if (resErr) skippedDates.push(dateStr)
      }

      if (skippedDates.length > 0) {
        Alert.alert(
          'Some Dates Skipped',
          `${skippedDates.length} date(s) were already booked and were skipped.`
        )
      }

      // Fire-and-forget streak update — don't block booking flow
      if (user?.id && selectedClub?.id) {
        useStreakStore.getState().triggerStreakUpdate(user.id, selectedClub.id).catch(() => {})
      }

      clearBooking()
      router.replace('/booking/success')
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Ionicons name="arrow-back" size={22} color="#2563eb" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Confirm Booking</Text>
        </View>

        {/* Court & Time Card */}
        <View style={styles.card}>
          <Text style={styles.courtName}>{selectedCourt.name}</Text>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={16} color="#64748b" />
              <Text style={styles.detailValue}>{formatDisplayDate()}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={16} color="#64748b" />
              <Text style={styles.detailValue}>
                {formatTime12(startTime)} – {formatTime12(endTime)}
              </Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons name="hourglass-outline" size={16} color="#64748b" />
              <Text style={styles.detailValue}>
                {durationMinutes >= 60
                  ? `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 > 0 ? ` ${durationMinutes % 60}m` : ''}`
                  : `${durationMinutes} min`}
              </Text>
            </View>
          </View>
        </View>

        {/* Repeat Weekly */}
        <View style={styles.sectionCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <Ionicons name="repeat-outline" size={18} color="#1e293b" />
              <Text style={styles.sectionLabel}>Repeat Weekly</Text>
            </View>
            <Switch
              value={repeatWeekly}
              onValueChange={setRepeatWeekly}
              trackColor={{ false: '#e2e8f0', true: '#bfdbfe' }}
              thumbColor={repeatWeekly ? '#2563eb' : '#f8fafc'}
            />
          </View>
          {repeatWeekly && (
            <View style={styles.repeatOptions}>
              {REPEAT_OPTIONS.map((w) => (
                <TouchableOpacity
                  key={w}
                  style={[styles.repeatChip, repeatWeeks === w && styles.repeatChipActive]}
                  onPress={() => setRepeatWeeks(w)}
                >
                  <Text
                    style={[
                      styles.repeatChipText,
                      repeatWeeks === w && styles.repeatChipTextActive,
                    ]}
                  >
                    {w} wk
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Guests */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={18} color="#1e293b" />
            <Text style={styles.sectionLabel}>Guests</Text>
          </View>
          <View style={styles.guestInputRow}>
            <TextInput
              style={styles.guestInput}
              placeholder="Guest name"
              placeholderTextColor="#9ca3af"
              value={guestInput}
              onChangeText={setGuestInput}
              onSubmitEditing={addGuest}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addGuestBtn} onPress={addGuest}>
              <Ionicons name="add" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
          {guests.map((name, idx) => (
            <View key={idx} style={styles.guestRow}>
              <Text style={styles.guestName}>{name}</Text>
              <TouchableOpacity onPress={() => removeGuest(idx)}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Price Breakdown */}
        <View style={styles.priceCard}>
          <Text style={styles.priceTitle}>Price Breakdown</Text>
          <View style={styles.divider} />

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>
              Base rate ({selectedCourt.hourly_rate ? `$${selectedCourt.hourly_rate}/hr` : ''} x{' '}
              {durationMinutes >= 60
                ? `${(durationMinutes / 60).toFixed(1)}h`
                : `${durationMinutes}m`}
              )
            </Text>
            <Text style={styles.priceAmount}>${basePrice.toFixed(2)}</Text>
          </View>

          {discountAmount > 0 && (
            <View style={styles.priceRow}>
              <View style={styles.discountLabel}>
                <Text style={styles.discountText}>
                  {isFree
                    ? `${tier?.name || 'Tier'} — Free booking`
                    : `${tier?.name || 'Tier'} discount (${tier?.discount_percent}%)`}
                </Text>
              </View>
              <Text style={styles.discountAmount}>-${discountAmount.toFixed(2)}</Text>
            </View>
          )}

          {repeatWeekly && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>x {repeatWeeks} sessions</Text>
              <Text style={styles.priceAmount}>${totalPrice.toFixed(2)}</Text>
            </View>
          )}

          <View style={styles.totalDivider} />
          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Total</Text>
            {isFree ? (
              <Text style={styles.totalFree}>Free</Text>
            ) : (
              <Text style={styles.totalAmount}>${totalPrice.toFixed(2)}</Text>
            )}
          </View>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color="#dc2626" />
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
        ) : null}

        {/* Spacer for bottom bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed bottom button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmButton, loading && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.confirmButtonText}>
              {isFree ? 'Confirm Booking' : `Confirm & Pay $${totalPrice.toFixed(2)}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    gap: 8,
  },
  header: { paddingHorizontal: 20, marginBottom: 20 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  backText: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', color: '#1e293b' },

  card: {
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 12,
  },
  courtName: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 16 },
  detailRow: { marginBottom: 10 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailValue: { fontSize: 15, color: '#1e293b', fontWeight: '500' },

  sectionCard: {
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 12,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionLabel: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  repeatOptions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  repeatChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  repeatChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  repeatChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  repeatChipTextActive: { color: '#ffffff' },

  guestInputRow: { flexDirection: 'row', gap: 8 },
  guestInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1e293b',
  },
  addGuestBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  guestName: { fontSize: 14, color: '#1e293b' },

  // Price breakdown
  priceCard: {
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 12,
  },
  priceTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: { fontSize: 14, color: '#64748b', flex: 1 },
  priceAmount: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  discountLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  discountText: { fontSize: 14, color: '#15803d', fontWeight: '500' },
  discountAmount: { fontSize: 14, fontWeight: '600', color: '#15803d' },
  totalDivider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 12 },
  totalLabel: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  totalAmount: { fontSize: 22, fontWeight: '700', color: '#2563eb' },
  totalFree: { fontSize: 22, fontWeight: '700', color: '#15803d' },

  errorContainer: {
    marginHorizontal: 20,
    marginTop: 4,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorMessage: { color: '#dc2626', fontSize: 14, flex: 1 },
  errorTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b' },
  errorSubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
  goBackBtn: {
    marginTop: 12,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  goBackText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
  },
  confirmButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  confirmButtonText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
})
