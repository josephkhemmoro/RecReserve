import { useEffect, useMemo, useState } from 'react'
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
import { useAnalyticsStore } from '../../store/analyticsStore'
import { useRewardsStore } from '../../store/rewardsStore'
import { haptic } from '../../lib/haptics'
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
  const { rewards, fetchRewards, availableRewards } = useRewardsStore()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedReward, setSelectedReward] = useState(null)

  // Load rewards when we have enough context; failures must not block booking.
  useEffect(() => {
    if (user?.id && selectedClub?.id) {
      fetchRewards(user.id, selectedClub.id).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedClub?.id])

  // Applicable rewards for court bookings — exclude bonus_credit in v1.
  const applicableRewards = useMemo(() => {
    const list = (availableRewards() || []).filter(
      (r) => r.reward_type === 'discount_percent' || r.reward_type === 'free_booking'
    )
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewards])

  if (!selectedCourt || !selectedDate || !startTime || !endTime) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.neutral400} />
        <Text style={styles.emptyTitle}>No booking details</Text>
        <Text style={styles.errorSubtitle}>Please select a court and time first</Text>
        <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const tierFree = priceBreakdown?.is_free ?? false
  const basePrice = priceBreakdown?.base_price ?? 0
  const tierDiscountAmount = priceBreakdown?.discount_amount ?? 0
  const priceAfterTier = priceBreakdown?.final_price ?? 0

  // Apply selected reward on top of tier-discounted price
  let rewardDiscountAmount = 0
  let finalAfterReward = priceAfterTier
  let rewardMakesFree = false
  if (selectedReward && !tierFree) {
    if (selectedReward.reward_type === 'free_booking') {
      rewardDiscountAmount = priceAfterTier
      finalAfterReward = 0
      rewardMakesFree = true
    } else if (selectedReward.reward_type === 'discount_percent') {
      const pct = Number(selectedReward.reward_value) || 0
      rewardDiscountAmount = Math.round(priceAfterTier * pct) / 100
      finalAfterReward = Math.max(0, priceAfterTier - rewardDiscountAmount)
    }
  } else if (selectedReward && tierFree && selectedReward.reward_type === 'free_booking') {
    // Already free; no change.
    rewardMakesFree = true
  }

  const isFree = tierFree || rewardMakesFree || finalAfterReward <= 0
  const discountAmount = tierDiscountAmount // for display of tier discount
  const finalPrice = isFree ? 0 : finalAfterReward

  const formatDisplayDate = () => {
    return new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handleConfirm = async () => {
    if (loading) return // prevent double-tap
    setError('')
    setLoading(true)

    try {
      // Step 1: Server-side validation
      const tzOffset = new Date().getTimezoneOffset()
      const tzSign = tzOffset <= 0 ? '+' : '-'
      const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0')
      const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0')
      const tzStr = `${tzSign}${tzHours}:${tzMins}`

      const startDT = `${selectedDate}T${startTime}:00${tzStr}`
      const endDT = `${selectedDate}T${endTime}:00${tzStr}`

      // Server-side validation (non-blocking if service unavailable)
      try {
        const { data: validation, error: valError } = await supabase.functions.invoke(
          'validate-booking',
          {
            body: {
              court_id: selectedCourt.id,
              club_id: selectedClub?.id,
              start_time: startDT,
              end_time: endDT,
              guest_count: 0,
            },
          }
        )

        // Check the response — our function returns { valid, errors }
        const valResult = validation || null
        if (valResult && valResult.valid === false) {
          const errorMessages = (valResult.errors || [])
            .map((e) => e.message || e)
            .join('\n')
          throw new Error(errorMessages || 'This booking cannot be completed.')
        }

        // If we got no data but an error, log it and continue (don't block booking)
        if (!valResult && valError) {
          console.warn('Validation service returned error, proceeding:', valError)
        }
      } catch (valCatchErr) {
        // Re-throw validation rejections (our thrown errors from above)
        if (valCatchErr.message && !valCatchErr.message.includes('non-2xx') && !valCatchErr.message.includes('FunctionsHttpError')) {
          throw valCatchErr
        }
        // Service errors — log and proceed (don't block booking over infra issues)
        console.warn('Validation service unavailable, proceeding with booking:', valCatchErr.message)
      }

      // Step 2: Handle payment if not free
      let paymentIntentId = null
      let amountCents = 0
      let rewardAppliedFree = false
      const idempotencyKey = `booking_${user?.id}_${selectedCourt.id}_${startDT}`

      if (!isFree && finalPrice > 0) {
        // Send the pre-reward amount (tier-discounted only) so the server can
        // apply any selected reward on top. When no reward is selected, this
        // equals the final displayed price.
        amountCents = Math.round(priceAfterTier * 100)

        const { data: paymentData, error: fnError } = await supabase.functions.invoke(
          'create-payment-intent',
          {
            body: {
              amount: amountCents,
              court_id: selectedCourt.id,
              user_id: user?.id,
              club_id: selectedClub?.id,
              date: selectedDate,
              start_time: startTime,
              end_time: endTime,
              reward_id: selectedReward?.id || null,
            },
          }
        )

        // Function now returns 200 always — check for error in data
        const piResult = paymentData || fnError
        console.log('create-payment-intent response:', JSON.stringify(piResult))
        if (piResult?.error) throw new Error(piResult.error)

        // Free booking case: reward applied server-side, no payment sheet needed.
        if (piResult?.reward_applied === true && piResult?.clientSecret === null) {
          rewardAppliedFree = true
        } else {
          if (!piResult?.clientSecret) throw new Error('Payment service error: ' + JSON.stringify(piResult))
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
      }

      // Step 3: Create reservation atomically via finalize-booking edge function.
      // Server-side: re-validates, idempotency check, verifies Stripe PI succeeded,
      // inserts reservation + payment_records + audit log + notification in one call.
      const bookingIsFree = isFree || rewardAppliedFree
      let insertedResId = null
      let finalizeData = null
      let finalizeInvokeError = null
      try {
        const result = await supabase.functions.invoke('finalize-booking', {
          body: {
            court_id: selectedCourt.id,
            club_id: selectedClub?.id,
            start_time: startDT,
            end_time: endDT,
            guest_count: 0,
            stripe_payment_intent_id: bookingIsFree ? null : paymentIntentId,
            amount_cents: bookingIsFree ? 0 : Math.round(finalPrice * 100),
            is_free: bookingIsFree,
            idempotency_key: idempotencyKey,
          },
        })
        finalizeData = result.data
        finalizeInvokeError = result.error
      } catch (invokeCatch) {
        finalizeInvokeError = invokeCatch
      }

      // If finalize returned a structured application error (validation, payment verify),
      // surface it directly — do NOT fall back to direct insert (would bypass server checks).
      if (finalizeData?.error) {
        const detail = Array.isArray(finalizeData.errors) && finalizeData.errors.length
          ? finalizeData.errors.map((e) => e.message || e).join('\n')
          : finalizeData.error
        throw new Error(detail)
      }

      if (finalizeData?.reservation_id) {
        insertedResId = finalizeData.reservation_id
      } else {
        // Infrastructure failure (function unreachable). Payment is already captured,
        // so attempt a direct insert as a last-ditch fallback to avoid an orphaned charge.
        console.warn('finalize-booking unavailable, falling back to direct insert:', finalizeInvokeError?.message)
        const { data: insertedRes, error: resErr } = await supabase
          .from('reservations')
          .insert({
            court_id: selectedCourt.id,
            user_id: user?.id,
            club_id: selectedClub?.id,
            start_time: startDT,
            end_time: endDT,
            status: 'confirmed',
            stripe_payment_id: bookingIsFree ? null : paymentIntentId,
            amount_paid: bookingIsFree ? 0 : finalPrice,
            validated_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (resErr) throw new Error('Failed to create reservation: ' + resErr.message)
        insertedResId = insertedRes?.id
      }
      const insertedRes = insertedResId ? { id: insertedResId } : null

      // Step 4: Mark reward redeemed, if one was used.
      if (selectedReward && insertedRes?.id) {
        try {
          const { error: redeemErr } = await supabase.rpc('redeem_player_reward', {
            p_reward_id: selectedReward.id,
            p_user_id: user?.id,
            p_reservation_id: insertedRes.id,
          })
          if (redeemErr) console.warn('Failed to mark reward redeemed:', redeemErr)
        } catch (redeemCatch) {
          console.warn('Failed to mark reward redeemed (exception):', redeemCatch)
        }
        // Refresh rewards store so the UI reflects the consumed reward.
        useRewardsStore
          .getState()
          .fetchRewards(user?.id, selectedClub?.id)
          .catch(() => {})
      }

      // Fire-and-forget streak update
      if (user?.id && selectedClub?.id) {
        useStreakStore.getState().triggerStreakUpdate(user.id, selectedClub.id).catch(() => {})
      }

      useAnalyticsStore.getState().trackBookingCompleted(user?.id, selectedClub?.id, selectedCourt?.id)
      haptic.success()
      router.replace('/booking/success')
      // Clear booking AFTER navigation to avoid flash of empty state
      setTimeout(() => clearBooking(), 500)
    } catch (err) {
      haptic.error()
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

        {/* Apply a Reward */}
        {applicableRewards.length > 0 && (
          <View style={styles.rewardSelectCard}>
            <Text style={styles.priceTitle}>Apply a reward</Text>
            <View style={styles.divider} />
            <View style={styles.rewardChipsRow}>
              <TouchableOpacity
                style={[styles.rewardChip, !selectedReward && styles.rewardChipActive]}
                onPress={() => setSelectedReward(null)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.rewardChipText, !selectedReward && styles.rewardChipTextActive]}
                >
                  No reward
                </Text>
              </TouchableOpacity>
              {applicableRewards.map((r) => {
                const isActive = selectedReward?.id === r.id
                const badge =
                  r.reward_type === 'free_booking'
                    ? 'Free'
                    : `${r.reward_value}% off`
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.rewardChip, isActive && styles.rewardChipActive]}
                    onPress={() => setSelectedReward(isActive ? null : r)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.rewardChipText, isActive && styles.rewardChipTextActive]}
                      numberOfLines={1}
                    >
                      {r.title || 'Reward'}
                    </Text>
                    <View style={[styles.rewardChipBadge, isActive && styles.rewardChipBadgeActive]}>
                      <Text
                        style={[
                          styles.rewardChipBadgeText,
                          isActive && styles.rewardChipBadgeTextActive,
                        ]}
                      >
                        {badge}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}

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
                  {tierFree
                    ? `${tier?.name || 'Tier'} — Free booking`
                    : `${tier?.name || 'Tier'} discount (${tier?.discount_percent}%)`}
                </Text>
              </View>
              <Text style={styles.discountAmount}>-${discountAmount.toFixed(2)}</Text>
            </View>
          )}

          {selectedReward && rewardDiscountAmount > 0 && (
            <View style={styles.priceRow}>
              <View style={styles.discountLabel}>
                <Text style={styles.discountText} numberOfLines={1}>
                  Reward: {selectedReward.title || 'Reward'}
                </Text>
              </View>
              <Text style={styles.discountAmount}>-${rewardDiscountAmount.toFixed(2)}</Text>
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
            <View style={styles.errorHeader}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={styles.errorTitle}>Booking Not Available</Text>
            </View>
            <Text style={styles.errorMessage}>{error}</Text>
            <Text style={styles.errorHint}>
              Please adjust your selection or contact the club for assistance.
            </Text>
          </View>
        ) : null}

        {/* Booking Policy Info */}
        <View style={styles.policyCard}>
          <Text style={styles.policyTitle}>Booking Policy</Text>
          <View style={styles.divider} />
          <View style={styles.policyRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.neutral500} />
            <Text style={styles.policyText}>
              {isFree
                ? 'Your membership includes free court bookings.'
                : `You'll be charged $${finalPrice.toFixed(2)} via Stripe.`}
            </Text>
          </View>
          <View style={styles.policyRow}>
            <Ionicons name="close-circle-outline" size={16} color={colors.neutral500} />
            <Text style={styles.policyText}>
              Cancellation is free up to the club's cutoff window. Late cancellations may incur a fee.
            </Text>
          </View>
          <View style={styles.policyRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.neutral500} />
            <Text style={styles.policyText}>
              Your booking is validated and confirmed server-side for safety.
            </Text>
          </View>
        </View>

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

  // Reward selector
  rewardSelectCard: {
    marginHorizontal: layout.screenPaddingH,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: layout.cardPaddingLg,
    borderWidth: 1,
    borderColor: colors.neutral100,
    marginBottom: layout.itemGap,
  },
  rewardChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral200,
    backgroundColor: colors.white,
    maxWidth: '100%',
  },
  rewardChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  rewardChipText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.neutral700,
    flexShrink: 1,
  },
  rewardChipTextActive: {
    color: colors.primary,
  },
  rewardChipBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.neutral100,
  },
  rewardChipBadgeActive: {
    backgroundColor: colors.primary,
  },
  rewardChipBadgeText: {
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: colors.neutral700,
  },
  rewardChipBadgeTextActive: {
    color: colors.white,
  },

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
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorMessage: { color: colors.error, fontSize: 14, flex: 1 },
  errorHint: { fontSize: 12, color: colors.neutral500, marginTop: spacing.sm, fontStyle: 'italic' },
  errorTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.error },
  emptyTitle: { fontSize: 18, fontWeight: fontWeights.semibold, color: colors.neutral900 },
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

  // Booking Policy
  policyCard: {
    marginHorizontal: layout.screenPaddingH,
    backgroundColor: colors.primarySurface,
    borderRadius: borderRadius.xl,
    padding: layout.cardPaddingLg,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    marginBottom: layout.itemGap,
  },
  policyTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.neutral900 },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  policyText: { flex: 1, fontSize: 13, color: colors.neutral600, lineHeight: 18 },
})
