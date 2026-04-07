import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useClubStore } from '../../../store/clubStore'
import { colors, spacing, borderRadius, fontSizes, fontWeights, layout } from '../../../theme'
import { Icon, Badge } from '../../../components/ui'

export default function ReservationDetailScreen() {
  const { reservationId } = useLocalSearchParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()

  const [reservation, setReservation] = useState(null)
  const [bookingRules, setBookingRules] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!reservationId) return
    const load = async () => {
      try {
        const [resRes, rulesRes] = await Promise.all([
          supabase.from('reservations')
            .select('*, court:courts(name)')
            .eq('id', reservationId)
            .single(),
          selectedClub?.id
            ? supabase.from('booking_rules').select('*').eq('club_id', selectedClub.id).single()
            : Promise.resolve({ data: null }),
        ])
        setReservation(resRes.data)
        setBookingRules(rulesRes.data)
      } catch (err) {
        console.error('Error loading reservation:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [reservationId, selectedClub?.id])

  const canCancel = () => {
    if (!reservation || !bookingRules?.cancellation_cutoff_hours) return true
    if (reservation.status !== 'confirmed') return false
    const cutoffMs = bookingRules.cancellation_cutoff_hours * 60 * 60 * 1000
    const startTime = new Date(reservation.start_time).getTime()
    return startTime - Date.now() > cutoffMs
  }

  const handleCancel = () => {
    if (!canCancel()) {
      Alert.alert('Cannot Cancel', `Must cancel at least ${bookingRules?.cancellation_cutoff_hours || 0} hours in advance.`)
      return
    }

    const isSeries = !!reservation.recurring_group_id

    if (isSeries) {
      Alert.alert('Cancel Reservation', 'This is part of a recurring series.', [
        { text: 'Keep', style: 'cancel' },
        { text: 'Cancel This One', onPress: () => confirmCancel(false) },
        { text: 'Cancel Entire Series', style: 'destructive', onPress: () => confirmCancel(true) },
      ])
    } else {
      Alert.alert('Cancel Reservation', 'Are you sure?', [
        { text: 'Keep', style: 'cancel' },
        { text: 'Cancel', style: 'destructive', onPress: () => confirmCancel(false) },
      ])
    }
  }

  const confirmCancel = async (cancelSeries) => {
    setCancelling(true)
    try {
      const now = new Date().toISOString()

      if (cancelSeries && reservation.recurring_group_id) {
        await supabase
          .from('reservations')
          .update({ status: 'cancelled', cancelled_at: now, cancelled_by: user?.id })
          .eq('recurring_group_id', reservation.recurring_group_id)
          .eq('status', 'confirmed')
          .gte('start_time', now)
      } else {
        await supabase
          .from('reservations')
          .update({ status: 'cancelled', cancelled_at: now, cancelled_by: user?.id })
          .eq('id', reservation.id)
      }

      // Clean up open spots
      await supabase.from('open_spots').delete().eq('reservation_id', reservation.id)

      // Process refund if paid
      if (reservation.stripe_payment_id) {
        await supabase.functions.invoke('process-refund', {
          body: { payment_intent_id: reservation.stripe_payment_id, reservation_id: reservation.id },
        })
      }

      // Trigger waitlist promotion
      await supabase.functions.invoke('promote-waitlist', {
        body: {
          reservation_id: reservation.id,
          court_id: reservation.court_id,
          club_id: reservation.club_id,
          start_time: reservation.start_time,
          end_time: reservation.end_time,
        },
      }).catch(() => {})

      Alert.alert('Cancelled', 'Your reservation has been cancelled.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (err) {
      Alert.alert('Error', 'Failed to cancel reservation.')
    } finally {
      setCancelling(false)
    }
  }

  const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const formatTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  const getStatusStyle = (status) => {
    if (status === 'cancelled') return { bg: colors.errorLight, text: colors.error, label: 'Cancelled' }
    if (status === 'no_show') return { bg: colors.warningLight, text: colors.warning, label: 'No-Show' }
    if (status === 'completed') return { bg: colors.successLight, text: colors.success, label: 'Completed' }
    if (status === 'pending_payment') return { bg: colors.warningLight, text: colors.warning, label: 'Pending Payment' }
    return { bg: colors.primarySurface, text: colors.primary, label: 'Confirmed' }
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  if (!reservation) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Reservation not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.linkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const statusInfo = getStatusStyle(reservation.status)
  const isPast = new Date(reservation.end_time) < new Date()
  const canCancelNow = canCancel() && !isPast && reservation.status === 'confirmed'

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Icon name="arrow-back" size="md" color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Reservation</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTopRow}>
            <Text style={styles.courtName}>{reservation.court?.name || 'Court'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
            </View>
          </View>

          {reservation.is_recurring && (
            <View style={styles.recurringTag}>
              <Icon name="repeat-outline" size="sm" color="#7c3aed" />
              <Text style={styles.recurringText}>Recurring Booking</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Icon name="calendar-outline" size="sm" color={colors.neutral500} />
            <Text style={styles.detailText}>{formatDate(reservation.start_time)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="time-outline" size="sm" color={colors.neutral500} />
            <Text style={styles.detailText}>
              {formatTime(reservation.start_time)} - {formatTime(reservation.end_time)}
            </Text>
          </View>

          {reservation.amount_paid > 0 && (
            <View style={styles.detailRow}>
              <Icon name="card-outline" size="sm" color={colors.neutral500} />
              <Text style={styles.detailText}>${reservation.amount_paid.toFixed(2)} paid</Text>
            </View>
          )}

          {reservation.guest_count > 0 && (
            <View style={styles.detailRow}>
              <Icon name="people-outline" size="sm" color={colors.neutral500} />
              <Text style={styles.detailText}>{reservation.guest_count} guest{reservation.guest_count > 1 ? 's' : ''}</Text>
            </View>
          )}

          {reservation.notes && (
            <>
              <View style={styles.divider} />
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{reservation.notes}</Text>
            </>
          )}

          {reservation.cancelled_at && (
            <>
              <View style={styles.divider} />
              <Text style={styles.cancelledInfo}>
                Cancelled on {new Date(reservation.cancelled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </>
          )}
        </View>

        {/* Cancel Cutoff Warning */}
        {!isPast && reservation.status === 'confirmed' && !canCancel() && bookingRules?.cancellation_cutoff_hours && (
          <View style={styles.cutoffWarning}>
            <Icon name="information-circle-outline" size="sm" color={colors.warning} />
            <Text style={styles.cutoffText}>
              Within {bookingRules.cancellation_cutoff_hours}h cancellation window — cancellation no longer available
            </Text>
          </View>
        )}

        {/* Refund Info */}
        {reservation.status === 'cancelled' && reservation.amount_paid > 0 && (
          <View style={styles.refundInfo}>
            <Icon name="card-outline" size="sm" color={colors.info} />
            <Text style={styles.refundText}>
              A refund of ${reservation.amount_paid.toFixed(2)} has been initiated. It may take 5-10 business days to appear on your statement.
            </Text>
          </View>
        )}

        {/* No-show Info */}
        {reservation.status === 'no_show' && (
          <View style={styles.noShowInfo}>
            <Icon name="warning-outline" size="sm" color={colors.warning} />
            <Text style={styles.noShowText}>
              This reservation was marked as a no-show. Repeated no-shows may affect your booking privileges.
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Cancel Button */}
      {canCancelNow && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <Text style={styles.cancelButtonText}>Cancel Reservation</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  errorText: { fontSize: 16, color: colors.neutral500 },
  linkText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  header: { paddingHorizontal: layout.screenPaddingH, marginBottom: spacing.lg },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.base },
  backText: { fontSize: fontSizes.base, color: colors.primary, fontWeight: fontWeights.semibold },
  title: { fontSize: 22, fontWeight: '700', color: colors.neutral900 },
  card: {
    marginHorizontal: layout.screenPaddingH, backgroundColor: colors.white,
    borderRadius: borderRadius.xl, padding: layout.cardPaddingLg,
    borderWidth: 1, borderColor: colors.neutral100,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  courtName: { fontSize: 18, fontWeight: '700', color: colors.neutral900 },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  statusText: { fontSize: 12, fontWeight: '700' },
  recurringTag: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginTop: spacing.sm, backgroundColor: '#faf5ff', paddingHorizontal: spacing.sm,
    paddingVertical: 3, borderRadius: borderRadius.sm, alignSelf: 'flex-start',
  },
  recurringText: { fontSize: 12, fontWeight: '600', color: '#7c3aed' },
  divider: { height: 1, backgroundColor: colors.neutral100, marginVertical: spacing.base },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  detailText: { fontSize: 14, color: colors.neutral900, fontWeight: '500' },
  notesLabel: { fontSize: 13, fontWeight: '600', color: colors.neutral500, marginBottom: spacing.xs },
  notesText: { fontSize: 14, color: colors.neutral600, lineHeight: 20 },
  cancelledInfo: { fontSize: 13, color: colors.neutral400, fontStyle: 'italic' },
  cutoffWarning: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: layout.screenPaddingH, marginTop: spacing.md,
    backgroundColor: colors.warningLight, borderRadius: borderRadius.md, padding: spacing.base,
  },
  cutoffText: { flex: 1, fontSize: 13, color: colors.warning },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.neutral100,
    paddingHorizontal: layout.screenPaddingH, paddingTop: spacing.base, paddingBottom: 34,
  },
  cancelButton: {
    backgroundColor: colors.errorLight, borderRadius: borderRadius.lg,
    padding: 18, alignItems: 'center', borderWidth: 1, borderColor: colors.error + '30',
  },
  cancelButtonText: { color: colors.error, fontSize: fontSizes.md, fontWeight: fontWeights.bold },
  refundInfo: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    marginHorizontal: layout.screenPaddingH, marginTop: spacing.md,
    backgroundColor: colors.infoLight, borderRadius: borderRadius.md, padding: spacing.base,
  },
  refundText: { flex: 1, fontSize: 13, color: colors.info, lineHeight: 18 },
  noShowInfo: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    marginHorizontal: layout.screenPaddingH, marginTop: spacing.md,
    backgroundColor: colors.warningLight, borderRadius: borderRadius.md, padding: spacing.base,
  },
  noShowText: { flex: 1, fontSize: 13, color: colors.warning, lineHeight: 18 },
})
