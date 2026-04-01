import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { toLocalISO } from '../../lib/dateUtils'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { useKudosStore } from '../../store/kudosStore'
import { useOpenSpotsStore } from '../../store/openSpotsStore'
import { KudosPrompt } from '../../components/kudos'
import { CreateOpenSpotModal } from '../../components/openSpots'
import { Icon } from '../../components/ui'
import { colors, spacing, borderRadius, shadows } from '../../theme'

const TABS = ['Scheduled', 'Past']

export default function ReservationsScreen() {
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const [activeTab, setActiveTab] = useState('Scheduled')
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)
  const [bookingRules, setBookingRules] = useState(null)
  const [dismissedKudos, setDismissedKudos] = useState(new Set())
  const { sentKudosReservationIds, fetchSentKudosIds } = useKudosStore()
  const { mySpots, fetchMySpots } = useOpenSpotsStore()
  const [spotModalReservation, setSpotModalReservation] = useState(null)
  const postedReservationIds = new Set(mySpots.filter((s) => s.is_active).map((s) => s.reservation_id))

  const fetchData = useCallback(async () => {
    if (!user?.id || !selectedClub?.id) {
      setReservations([])
      setBookingRules(null)
      setLoading(false)
      setRefreshing(false)
      return
    }

    try {
      const now = toLocalISO(new Date())

      let query = supabase
        .from('reservations')
        .select('*, court:courts(name)')
        .eq('user_id', user.id)
        .eq('club_id', selectedClub.id)

      if (activeTab === 'Scheduled') {
        query = query
          .eq('status', 'confirmed')
          .gte('start_time', now)
          .order('start_time', { ascending: true })
      } else {
        query = query
          .or(`status.eq.completed,status.eq.cancelled,start_time.lt.${now}`)
          .order('start_time', { ascending: false })
      }

      const requests = [query]
      requests.push(
        supabase.from('booking_rules').select('*').eq('club_id', selectedClub.id).single()
      )

      const results = await Promise.all(requests)
      const resResult = results[0]

      if (resResult.error) throw resResult.error
      setReservations(resResult.data || [])

      if (results[1] && !results[1].error) setBookingRules(results[1].data)
    } catch (err) {
      console.error('Error fetching reservations:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id, selectedClub?.id, activeTab])

  useEffect(() => {
    setLoading(true)
    fetchData()
    if (user?.id) fetchSentKudosIds(user.id)
    if (user?.id && selectedClub?.id) fetchMySpots(user.id, selectedClub.id)
  }, [fetchData, fetchMySpots, fetchSentKudosIds, selectedClub?.id, user?.id])

  const onRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const canCancel = (reservation) => {
    if (!bookingRules?.cancellation_cutoff_hours) return true
    const cutoffMs = bookingRules.cancellation_cutoff_hours * 60 * 60 * 1000
    const startTime = new Date(reservation.start_time).getTime()
    return startTime - Date.now() > cutoffMs
  }

  const handleCancel = (reservation) => {
    if (!canCancel(reservation)) {
      Alert.alert(
        'Cannot Cancel',
        `Reservations must be cancelled at least ${bookingRules?.cancellation_cutoff_hours || 0} hours in advance.`
      )
      return
    }

    // If part of a series, ask what to cancel
    if (reservation.series_id) {
      Alert.alert(
        'Cancel Reservation',
        'This is part of a recurring series.',
        [
          { text: 'Keep', style: 'cancel' },
          {
            text: 'Cancel This One',
            onPress: () => confirmCancel(reservation, false),
          },
          {
            text: 'Cancel Entire Series',
            style: 'destructive',
            onPress: () => confirmCancel(reservation, true),
          },
        ]
      )
    } else {
      Alert.alert(
        'Cancel Reservation',
        'Are you sure you want to cancel this reservation?',
        [
          { text: 'Keep', style: 'cancel' },
          { text: 'Cancel Reservation', style: 'destructive', onPress: () => confirmCancel(reservation, false) },
        ]
      )
    }
  }

  const confirmCancel = async (reservation, cancelSeries) => {
    setCancellingId(reservation.id)
    try {
      if (cancelSeries && reservation.series_id) {
        // Cancel all future reservations in the series
        const { error } = await supabase
          .from('reservations')
          .update({ status: 'cancelled' })
          .eq('series_id', reservation.series_id)
          .eq('status', 'confirmed')
          .gte('start_time', toLocalISO(new Date()))

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('reservations')
          .update({ status: 'cancelled' })
          .eq('id', reservation.id)

        if (error) throw error
      }

      // Clean up any open spot posted for this reservation
      await supabase
        .from('open_spots')
        .delete()
        .eq('reservation_id', reservation.id)

      if (reservation.stripe_payment_id) {
        await supabase.functions.invoke('process-refund', {
          body: {
            payment_intent_id: reservation.stripe_payment_id,
            reservation_id: reservation.id,
          },
        })
      }

      fetchData()
    } catch (_err) {
      Alert.alert('Error', 'Failed to cancel reservation. Please try again.')
    } finally {
      setCancellingId(null)
    }
  }

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const formatTime = (dateStr) =>
    new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  const getStatusStyle = (reservation) => {
    if (reservation.status === 'cancelled') return { bg: colors.errorLight, text: colors.error, label: 'Cancelled' }
    if (reservation.status === 'no_show') return { bg: colors.warningLight, text: colors.warning, label: 'No-Show' }
    if (reservation.status === 'completed') return { bg: colors.successLight, text: colors.success, label: 'Completed' }
    if (new Date(reservation.start_time) < new Date()) return { bg: colors.neutral100, text: colors.neutral500, label: 'Past' }
    return { bg: colors.primarySurface, text: colors.primary, label: 'Confirmed' }
  }

  // Count remaining in series
  const getSeriesInfo = (reservation) => {
    if (!reservation.series_id) return null
    const seriesItems = reservations.filter(
      (r) => r.series_id === reservation.series_id && r.status === 'confirmed'
    )
    const total = reservations.filter((r) => r.series_id === reservation.series_id).length
    return { remaining: seriesItems.length, total }
  }

  const shouldShowKudosPrompt = (item) => {
    if (activeTab !== 'Past') return false
    const endTime = new Date(item.end_time)
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    if (endTime >= now || endTime < sevenDaysAgo) return false
    if (item.status === 'cancelled') return false
    if (sentKudosReservationIds.includes(item.id)) return false
    if (dismissedKudos.has(item.id)) return false
    return true
  }

  const renderReservation = ({ item }) => {
    const statusInfo = getStatusStyle(item)
    const cancelable = activeTab === 'Scheduled' && canCancel(item)
    const withinCutoff = activeTab === 'Scheduled' && !canCancel(item)
    const seriesInfo = getSeriesInfo(item)
    const guestList = item.guests || []
    const showKudos = shouldShowKudosPrompt(item)

    return (
      <View>
        {showKudos && (
          <KudosPrompt
            reservationId={item.id}
            clubId={item.club_id}
            onDismiss={() => setDismissedKudos((prev) => new Set([...prev, item.id]))}
          />
        )}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.courtName}>{item.court?.name || 'Court'}</Text>
              {seriesInfo && (
                <View style={styles.recurringBadge}>
                  <Text style={styles.recurringBadgeText}>
                    Recurring · {seriesInfo.remaining} left
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.dateTime}>
              {formatDate(item.start_time)} · {formatTime(item.start_time)} – {formatTime(item.end_time)}
            </Text>
            {guestList.length > 0 && (
              <Text style={styles.guestText}>
                Guests: {guestList.join(', ')}
              </Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusText, { color: statusInfo.text }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {activeTab === 'Scheduled' && (
          <View style={styles.cardFooter}>
            <View style={styles.cardFooterRow}>
              {cancelable ? (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => handleCancel(item)}
                  disabled={cancellingId === item.id}
                >
                  {cancellingId === item.id ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  )}
                </TouchableOpacity>
              ) : withinCutoff ? (
                <Text style={styles.cutoffText}>
                  Within {bookingRules?.cancellation_cutoff_hours}h cancellation window
                </Text>
              ) : null}

              {postedReservationIds.has(item.id) ? (
                <View style={styles.spotPostedRow}>
                  <Icon name="checkmark-circle" size="sm" color={colors.success} />
                  <Text style={styles.spotPostedText}>Open spot posted</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.findPlayersRow}
                  onPress={() => setSpotModalReservation({
                    id: item.id,
                    court_name: item.court?.name || 'Court',
                    start_time: item.start_time,
                    end_time: item.end_time,
                  })}
                >
                  <Icon name="people-outline" size="sm" color={colors.primary} />
                  <Text style={styles.findPlayersLink}>Find players</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My bookings</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={loading ? [] : reservations}
        renderItem={renderReservation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          (loading || reservations.length === 0) && { flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {activeTab === 'Scheduled' ? 'No upcoming reservations' : 'No past reservations'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'Scheduled'
                  ? 'Book a court to see your reservations here'
                  : 'Your completed and cancelled reservations will appear here'}
              </Text>
            </View>
          )
        }
      />

      {spotModalReservation && (
        <CreateOpenSpotModal
          visible={!!spotModalReservation}
          reservation={spotModalReservation}
          userId={user?.id}
          clubId={selectedClub?.id}
          onClose={() => setSpotModalReservation(null)}
          onCreated={() => {
            setSpotModalReservation(null)
            if (user?.id && selectedClub?.id) fetchMySpots(user.id, selectedClub.id)
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 70 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.base },
  title: { fontSize: 22, fontWeight: '700', color: colors.neutral900 },
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.neutral150, marginBottom: spacing.base },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.neutral400 },
  tabTextActive: { color: colors.neutral900 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.base, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.neutral100, ...shadows.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flex: 1, marginRight: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs, flexWrap: 'wrap' },
  courtName: { fontSize: 16, fontWeight: '700', color: colors.neutral900 },
  recurringBadge: { backgroundColor: '#faf5ff', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  recurringBadgeText: { fontSize: 11, fontWeight: '600', color: '#7c3aed' },
  dateTime: { fontSize: 13, color: colors.neutral500 },
  guestText: { fontSize: 12, color: colors.neutral400, marginTop: spacing.xs },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  statusText: { fontSize: 12, fontWeight: '700' },
  cardFooter: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.neutral100 },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  findPlayersRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  findPlayersLink: { fontSize: 13, fontWeight: '600', color: colors.primary },
  spotPostedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  spotPostedText: { fontSize: 13, fontWeight: '600', color: colors.success },
  cancelButton: { paddingHorizontal: spacing.base, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.errorLight, backgroundColor: colors.errorLight },
  cancelButtonText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  cutoffText: { fontSize: 12, color: colors.neutral400, fontStyle: 'italic' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing['3xl'] },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.neutral900, marginBottom: spacing.sm },
  emptySubtitle: { fontSize: 14, color: colors.neutral400, textAlign: 'center' },
})
