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
import { useStripe } from '@stripe/stripe-react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useBookingStore } from '../../store/bookingStore'
import { useClubStore } from '../../store/clubStore'

const REPEAT_OPTIONS = [2, 4, 8, 12]

export default function BookingConfirmScreen() {
  const router = useRouter()
  const { initPaymentSheet, presentPaymentSheet } = useStripe()
  const { user } = useAuthStore()
  const { selectedCourt, selectedDate, selectedSlot, duration, price, clearBooking } = useBookingStore()
  const { selectedClub } = useClubStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Recurring
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [repeatWeeks, setRepeatWeeks] = useState(4)

  // Guests
  const [guests, setGuests] = useState([])
  const [guestInput, setGuestInput] = useState('')

  if (!selectedCourt || !selectedDate || !selectedSlot) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No booking details found</Text>
        <TouchableOpacity style={styles.backButtonContainer} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const totalSlots = repeatWeekly ? repeatWeeks : 1
  const totalPrice = price * totalSlots

  const formatDisplayDate = () => {
    return new Date(selectedDate).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
  }

  const formatSlotTime = (time24) => {
    const [h, m] = time24.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
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
    const base = new Date(selectedDate)
    for (let i = 0; i < repeatWeeks; i++) {
      const d = new Date(base)
      d.setDate(base.getDate() + i * 7)
      dates.push(d.toISOString().split('T')[0])
    }
    return dates
  }

  const handleConfirmAndPay = async () => {
    setError('')
    setLoading(true)

    try {
      const { data: paymentData, error: fnError } = await supabase.functions.invoke(
        'create-payment-intent',
        {
          body: {
            amount: Math.round(totalPrice * 100),
            court_id: selectedCourt.id,
            user_id: user?.id,
            date: selectedDate,
            start_time: selectedSlot.startTime,
            end_time: selectedSlot.endTime,
          },
        }
      )

      if (fnError) throw new Error(fnError.message || 'Failed to create payment')
      const { clientSecret, paymentIntentId } = paymentData

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'RecReserve',
      })
      if (initError) throw new Error(initError.message)

      const { error: paymentError } = await presentPaymentSheet()
      if (paymentError) {
        if (paymentError.code === 'Canceled') { setLoading(false); return }
        throw new Error(paymentError.message)
      }

      // Create reservations
      const seriesId = repeatWeekly ? crypto.randomUUID() : null
      const datesToBook = repeatWeekly ? generateWeeklyDates() : [selectedDate]
      const skippedDates = []

      for (const dateStr of datesToBook) {
        const startTime = `${dateStr}T${selectedSlot.startTime}:00`
        const endTime = `${dateStr}T${selectedSlot.endTime}:00`

        const { error: resErr } = await supabase.from('reservations').insert({
          court_id: selectedCourt.id,
          user_id: user?.id,
          club_id: selectedClub?.id,
          start_time: startTime,
          end_time: endTime,
          status: 'confirmed',
          guest_count: guests.length,
          guests: guests.length > 0 ? guests : [],
          stripe_payment_id: paymentIntentId,
          amount_paid: price,
          series_id: seriesId,
        })

        if (resErr) {
          // Slot might be taken (overlap constraint) — skip it
          skippedDates.push(dateStr)
        }
      }

      if (skippedDates.length > 0) {
        Alert.alert(
          'Some Dates Skipped',
          `${skippedDates.length} date(s) were already booked and were skipped.`
        )
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Confirm Booking</Text>
        </View>

        {/* Booking details card */}
        <View style={styles.card}>
          <Text style={styles.courtName}>{selectedCourt.name}</Text>
          <Text style={styles.courtSport}>
            {selectedCourt.sport.charAt(0).toUpperCase() + selectedCourt.sport.slice(1)}
          </Text>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formatDisplayDate()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>
              {formatSlotTime(selectedSlot.startTime)} – {formatSlotTime(selectedSlot.endTime)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>{duration} min</Text>
          </View>
        </View>

        {/* Recurring toggle */}
        <View style={styles.sectionCard}>
          <View style={styles.toggleRow}>
            <Text style={styles.sectionLabel}>Repeat Weekly</Text>
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
                  <Text style={[styles.repeatChipText, repeatWeeks === w && styles.repeatChipTextActive]}>
                    {w} weeks
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Guests */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Guests</Text>
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
            <TouchableOpacity style={styles.addGuestButton} onPress={addGuest}>
              <Text style={styles.addGuestText}>Add</Text>
            </TouchableOpacity>
          </View>
          {guests.map((name, idx) => (
            <View key={idx} style={styles.guestRow}>
              <Text style={styles.guestName}>{name}</Text>
              <TouchableOpacity onPress={() => removeGuest(idx)}>
                <Text style={styles.guestRemove}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Price summary */}
        <View style={styles.card}>
          {repeatWeekly && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{repeatWeeks} sessions × ${price.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.priceLabel}>Total</Text>
            <Text style={styles.priceValue}>${totalPrice.toFixed(2)}</Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmButton, loading && styles.buttonDisabled]}
          onPress={handleConfirmAndPay}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.confirmButtonText}>
              Confirm & Pay ${totalPrice.toFixed(2)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 24 },
  header: { paddingHorizontal: 20, marginBottom: 24 },
  backButton: { fontSize: 16, color: '#2563eb', fontWeight: '600', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  card: { marginHorizontal: 20, backgroundColor: '#ffffff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 12 },
  courtName: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  courtSport: { fontSize: 14, color: '#64748b' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  detailLabel: { fontSize: 14, color: '#64748b' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  priceLabel: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  priceValue: { fontSize: 20, fontWeight: '700', color: '#2563eb' },
  sectionCard: { marginHorizontal: 20, backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 12 },
  sectionLabel: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  repeatOptions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  repeatChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  repeatChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  repeatChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  repeatChipTextActive: { color: '#ffffff' },
  guestInputRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  guestInput: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#1e293b' },
  addGuestButton: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addGuestText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  guestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  guestName: { fontSize: 14, color: '#1e293b' },
  guestRemove: { fontSize: 13, color: '#dc2626', fontWeight: '600' },
  errorContainer: { marginHorizontal: 20, marginTop: 8, backgroundColor: '#fef2f2', borderRadius: 12, padding: 14 },
  errorMessage: { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  errorText: { fontSize: 16, color: '#64748b', marginBottom: 16 },
  backButtonContainer: { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  backButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  footer: { padding: 20 },
  confirmButton: { backgroundColor: '#2563eb', borderRadius: 14, padding: 18, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  confirmButtonText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
})
