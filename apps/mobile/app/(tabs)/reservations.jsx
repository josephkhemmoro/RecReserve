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
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'

const TABS = ['Upcoming', 'Past']

export default function ReservationsScreen() {
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const [activeTab, setActiveTab] = useState('Upcoming')
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)
  const [bookingRules, setBookingRules] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const now = new Date().toISOString()

      let query = supabase
        .from('reservations')
        .select('*, court:courts(name, sport)')
        .eq('user_id', user?.id)
        .eq('club_id', selectedClub?.id)

      if (activeTab === 'Upcoming') {
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
      if (selectedClub?.id) {
        requests.push(
          supabase.from('booking_rules').select('*').eq('club_id', selectedClub.id).single()
        )
      }

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
  }, [fetchData])

  const onRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const canCancel = (reservation) => {
    if (!bookingRules?.cancellation_cutoff_hours) return true
    const cutoffMs = bookingRules.cancellation_cutoff_hours * 60 * 60 * 1000
    const startTime = new Date(reservation.start_time).getTime()
    const now = Date.now()
    return startTime - now > cutoffMs
  }

  const handleCancel = (reservation) => {
    if (!canCancel(reservation)) {
      Alert.alert(
        'Cannot Cancel',
        `Reservations must be cancelled at least ${bookingRules?.cancellation_cutoff_hours || 0} hours in advance.`
      )
      return
    }

    Alert.alert(
      'Cancel Reservation',
      'Are you sure you want to cancel this reservation?',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Reservation',
          style: 'destructive',
          onPress: () => confirmCancel(reservation),
        },
      ]
    )
  }

  const confirmCancel = async (reservation) => {
    setCancellingId(reservation.id)
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', reservation.id)

      if (error) throw error

      // Trigger refund via edge function if payment exists
      if (reservation.stripe_payment_id) {
        await supabase.functions.invoke('process-refund', {
          body: {
            payment_intent_id: reservation.stripe_payment_id,
            reservation_id: reservation.id,
          },
        })
      }

      fetchData()
    } catch (err) {
      Alert.alert('Error', 'Failed to cancel reservation. Please try again.')
    } finally {
      setCancellingId(null)
    }
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getStatusStyle = (reservation) => {
    if (reservation.status === 'cancelled') return { bg: '#fef2f2', text: '#dc2626', label: 'Cancelled' }
    if (reservation.status === 'completed') return { bg: '#f0fdf4', text: '#16a34a', label: 'Completed' }
    if (new Date(reservation.start_time) < new Date()) return { bg: '#f1f5f9', text: '#64748b', label: 'Past' }
    return { bg: '#eff6ff', text: '#2563eb', label: 'Confirmed' }
  }

  const renderReservation = ({ item }) => {
    const statusInfo = getStatusStyle(item)
    const cancelable = activeTab === 'Upcoming' && canCancel(item)
    const withinCutoff = activeTab === 'Upcoming' && !canCancel(item)

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={styles.courtName}>{item.court?.name || 'Court'}</Text>
            <Text style={styles.dateTime}>
              {formatDate(item.start_time)} · {formatTime(item.start_time)} – {formatTime(item.end_time)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusText, { color: statusInfo.text }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {activeTab === 'Upcoming' && (
          <View style={styles.cardFooter}>
            {cancelable ? (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => handleCancel(item)}
                disabled={cancellingId === item.id}
              >
                {cancellingId === item.id ? (
                  <ActivityIndicator size="small" color="#dc2626" />
                ) : (
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                )}
              </TouchableOpacity>
            ) : withinCutoff ? (
              <Text style={styles.cutoffText}>
                Within {bookingRules?.cancellation_cutoff_hours}h cancellation window
              </Text>
            ) : null}
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Reservations</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : reservations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            {activeTab === 'Upcoming' ? 'No upcoming reservations' : 'No past reservations'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === 'Upcoming'
              ? 'Book a court to see your reservations here'
              : 'Your completed and cancelled reservations will appear here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={reservations}
          renderItem={renderReservation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 70,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
    marginRight: 12,
  },
  courtName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  dateTime: {
    fontSize: 13,
    color: '#64748b',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'flex-start',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  cancelButtonText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
  cutoffText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
})
