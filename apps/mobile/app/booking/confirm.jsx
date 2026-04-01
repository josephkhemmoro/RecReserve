import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
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
import { colors, spacing, borderRadius, fontSizes, fontWeights, layout } from '../../theme'


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
    clearBooking,
  } = useBookingStore()
  const { selectedClub } = useClubStore()
  const tier = useMembershipStore((s) => s.tier)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!selectedCourt || !selectedDate || !startTime || !endTime) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.neutral400} />
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

  const formatDisplayDate = () => {
    return new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handleConfirm = async () => {
    setError('')
    setLoading(true)

    try {
      let paymentIntentId = null

      // Skip Stripe if free
      if (!isFree && finalPrice > 0) {
        const { data: paymentData, error: fnError } = await supabase.functions.invoke(
          'create-payment-intent',
          {
            body: {
              amount: Math.round(finalPrice * 100),
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

      // Create reservation
      const tzOffset = new Date().getTimezoneOffset()
      const tzSign = tzOffset <= 0 ? '+' : '-'
      const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0')
      const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0')
      const tzStr = `${tzSign}${tzHours}:${tzMins}`

      const startDT = `${selectedDate}T${startTime}:00${tzStr}`
      const endDT = `${selectedDate}T${endTime}:00${tzStr}`

      const { error: resErr } = await supabase.from('reservations').insert({
        court_id: selectedCourt.id,
        user_id: user?.id,
        club_id: selectedClub?.id,
        start_time: startDT,
        end_time: endDT,
        status: 'confirmed',
        stripe_payment_id: paymentIntentId,
        amount_paid: isFree ? 0 : finalPrice,
      })

      if (resErr) throw new Error('Failed to create reservation')

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
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
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
              <Ionicons name="calendar-outline" size={16} color={colors.neutral500} />
              <Text style={styles.detailValue}>{formatDisplayDate()}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={16} color={colors.neutral500} />
              <Text style={styles.detailValue}>
                {formatTime12(startTime)} – {formatTime12(endTime)}
              </Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons name="hourglass-outline" size={16} color={colors.neutral500} />
              <Text style={styles.detailValue}>
                {durationMinutes >= 60
                  ? `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 > 0 ? ` ${durationMinutes % 60}m` : ''}`
                  : `${durationMinutes} min`}
              </Text>
            </View>
          </View>
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

          <View style={styles.totalDivider} />
          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Total</Text>
            {isFree ? (
              <Text style={styles.totalFree}>Free</Text>
            ) : (
              <Text style={styles.totalAmount}>${finalPrice.toFixed(2)}</Text>
            )}
          </View>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
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
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.confirmButtonText}>
              {isFree ? 'Confirm Booking' : `Confirm & Pay $${finalPrice.toFixed(2)}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 60 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing['3xl'],
    gap: spacing.sm,
  },
  header: { paddingHorizontal: layout.screenPaddingH, marginBottom: spacing.lg },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.base },
  backText: { fontSize: fontSizes.base, color: colors.primary, fontWeight: fontWeights.semibold },
  title: { fontSize: 22, fontWeight: fontWeights.bold, color: colors.neutral900 },

  card: {
    marginHorizontal: layout.screenPaddingH,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: layout.cardPaddingLg,
    borderWidth: 1,
    borderColor: colors.neutral100,
    marginBottom: layout.itemGap,
  },
  courtName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.neutral900, marginBottom: spacing.xs },
  divider: { height: 1, backgroundColor: colors.neutral100, marginVertical: spacing.base },
  detailRow: { marginBottom: spacing.md },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detailValue: { fontSize: fontSizes.base, color: colors.neutral900, fontWeight: fontWeights.medium },

  sectionCard: {
    marginHorizontal: layout.screenPaddingH,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: layout.cardPadding,
    borderWidth: 1,
    borderColor: colors.neutral100,
    marginBottom: layout.itemGap,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: layout.itemGap },
  sectionLabel: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.neutral900 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  repeatOptions: { flexDirection: 'row', gap: spacing.sm, marginTop: layout.itemGap },
  repeatChip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral200,
  },
  repeatChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  repeatChipText: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.neutral500 },
  repeatChipTextActive: { color: colors.white },

  guestInputRow: { flexDirection: 'row', gap: spacing.sm },
  guestInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.neutral900,
  },
  addGuestBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral100,
  },
  guestName: { fontSize: 14, color: colors.neutral900 },

  // Price breakdown
  priceCard: {
    marginHorizontal: layout.screenPaddingH,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: layout.cardPaddingLg,
    borderWidth: 1,
    borderColor: colors.neutral100,
    marginBottom: layout.itemGap,
  },
  priceTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.neutral900 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  priceLabel: { fontSize: 14, color: colors.neutral500, flex: 1 },
  priceAmount: { fontSize: 14, fontWeight: fontWeights.semibold, color: colors.neutral900 },
  discountLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  discountText: { fontSize: 14, color: colors.success, fontWeight: fontWeights.medium },
  discountAmount: { fontSize: 14, fontWeight: fontWeights.semibold, color: colors.success },
  totalDivider: { height: 1, backgroundColor: colors.neutral200, marginVertical: spacing.md },
  totalLabel: { fontSize: 18, fontWeight: fontWeights.bold, color: colors.neutral900 },
  totalAmount: { fontSize: 22, fontWeight: fontWeights.bold, color: colors.primary },
  totalFree: { fontSize: 22, fontWeight: fontWeights.bold, color: colors.success },

  errorContainer: {
    marginHorizontal: layout.screenPaddingH,
    marginTop: spacing.xs,
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorMessage: { color: colors.error, fontSize: 14, flex: 1 },
  errorTitle: { fontSize: 18, fontWeight: fontWeights.semibold, color: colors.neutral900 },
  errorSubtitle: { fontSize: 14, color: colors.neutral400, textAlign: 'center' },
  goBackBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  goBackText: { color: colors.white, fontSize: fontSizes.base, fontWeight: fontWeights.semibold },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral100,
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.base,
    paddingBottom: 34,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: 18,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  confirmButtonText: { color: colors.white, fontSize: fontSizes.md, fontWeight: fontWeights.bold },
})
