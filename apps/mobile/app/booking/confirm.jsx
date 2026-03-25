import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useStripe } from '@stripe/stripe-react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useBookingStore } from '../../store/bookingStore'
import { useClubStore } from '../../store/clubStore'

export default function BookingConfirmScreen() {
  const router = useRouter()
  const { initPaymentSheet, presentPaymentSheet } = useStripe()
  const { user } = useAuthStore()
  const { selectedCourt, selectedDate, selectedSlot, duration, price, clearBooking } = useBookingStore()
  const { selectedClub } = useClubStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!selectedCourt || !selectedDate || !selectedSlot) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No booking details found</Text>
        <TouchableOpacity
          style={styles.backButtonContainer}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const formatDisplayDate = () => {
    const date = new Date(selectedDate)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatSlotTime = (time24) => {
    const [h, m] = time24.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  const handleConfirmAndPay = async () => {
    setError('')
    setLoading(true)

    try {
      // Create PaymentIntent via Supabase Edge Function
      const { data: paymentData, error: fnError } = await supabase.functions.invoke(
        'create-payment-intent',
        {
          body: {
            amount: Math.round(price * 100),
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

      // Initialize Stripe payment sheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'RecReserve',
      })

      if (initError) throw new Error(initError.message)

      // Present payment sheet
      const { error: paymentError } = await presentPaymentSheet()

      if (paymentError) {
        if (paymentError.code === 'Canceled') {
          setLoading(false)
          return
        }
        throw new Error(paymentError.message)
      }

      // Payment successful — create reservation
      const startTime = `${selectedDate}T${selectedSlot.startTime}:00`
      const endTime = `${selectedDate}T${selectedSlot.endTime}:00`

      const { error: reservationError } = await supabase
        .from('reservations')
        .insert({
          court_id: selectedCourt.id,
          user_id: user?.id,
          club_id: selectedClub?.id,
          start_time: startTime,
          end_time: endTime,
          status: 'confirmed',
          guest_count: 0,
          stripe_payment_id: paymentIntentId,
          amount_paid: price,
        })

      if (reservationError) throw reservationError

      clearBooking()
      router.replace('/booking/success')
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Confirm Booking</Text>
      </View>

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

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.priceLabel}>Total</Text>
          <Text style={styles.priceValue}>${price.toFixed(2)}</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      ) : null}

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
              Confirm & Pay ${price.toFixed(2)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 24,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 24,
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
  card: {
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  courtName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  courtSport: {
    fontSize: 14,
    color: '#64748b',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2563eb',
  },
  errorContainer: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
  },
  errorMessage: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 16,
  },
  backButtonContainer: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    marginTop: 'auto',
  },
  confirmButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
})
