import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useStripe } from '@stripe/stripe-react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { colors, textStyles, spacing, borderRadius, shadows, fontSizes, fontWeights } from '../../theme'
import { Icon, Badge, Button } from '../../components/ui'

const EVENT_ICONS = { tournament: 'trophy-outline', open_play: 'tennisball-outline', clinic: 'school-outline', lesson: 'book-outline' }
const EVENT_TYPE_LABELS = { tournament: 'Tournament', open_play: 'Open Play', clinic: 'Clinic', lesson: 'Lesson' }

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const { initPaymentSheet, presentPaymentSheet } = useStripe()

  const [event, setEvent] = useState(null)
  const [registrantCount, setRegistrantCount] = useState(0)
  const [isRegistered, setIsRegistered] = useState(false)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!eventId) return
    const load = async () => {
      try {
        const [eventRes, countRes, regRes] = await Promise.all([
          supabase.from('events').select('*, court:courts(name)').eq('id', eventId).single(),
          supabase.from('event_registrations').select('id', { count: 'exact', head: true })
            .eq('event_id', eventId).eq('status', 'registered'),
          user?.id
            ? supabase.from('event_registrations').select('id, status')
                .eq('event_id', eventId).eq('user_id', user.id).eq('status', 'registered').limit(1)
            : Promise.resolve({ data: [] }),
        ])

        setEvent(eventRes.data)
        setRegistrantCount(countRes.count || 0)
        setIsRegistered((regRes.data || []).length > 0)
      } catch (err) {
        console.error('Error loading event:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [eventId, user?.id])

  const handleRegister = async () => {
    if (!user?.id || !event) return
    setRegistering(true)

    try {
      // Check capacity
      if (event.max_participants && registrantCount >= event.max_participants) {
        Alert.alert('Event Full', 'This event has reached capacity.')
        setRegistering(false)
        return
      }

      let paymentIntentId = null

      // Handle payment for paid events
      if (event.price > 0) {
        const { data: paymentData, error: fnError } = await supabase.functions.invoke(
          'create-event-payment',
          {
            body: {
              event_id: event.id,
              club_id: event.club_id,
              amount: Math.round(event.price * 100),
            },
          }
        )

        if (fnError) throw new Error(fnError.message || 'Payment failed')

        const { clientSecret } = paymentData
        paymentIntentId = paymentData.paymentIntentId

        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'RecReserve',
        })
        if (initError) throw new Error(initError.message)

        const { error: paymentError } = await presentPaymentSheet()
        if (paymentError) {
          if (paymentError.code === 'Canceled') { setRegistering(false); return }
          throw new Error(paymentError.message)
        }
      }

      // Create registration
      const { error: regError } = await supabase.from('event_registrations').insert({
        event_id: event.id,
        user_id: user.id,
        status: 'registered',
        stripe_payment_id: paymentIntentId,
        amount_paid: event.price || 0,
      })

      if (regError) {
        if (regError.code === '23505') {
          Alert.alert('Already Registered', 'You are already registered for this event.')
        } else {
          throw regError
        }
      } else {
        setIsRegistered(true)
        setRegistrantCount((c) => c + 1)
        Alert.alert('Registered!', 'You have been registered for this event.')
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to register')
    } finally {
      setRegistering(false)
    }
  }

  const handleCancelRegistration = () => {
    Alert.alert('Cancel Registration', 'Are you sure you want to cancel your registration?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Registration', style: 'destructive', onPress: async () => {
          setCancelling(true)
          try {
            await supabase
              .from('event_registrations')
              .update({ status: 'cancelled' })
              .eq('event_id', event.id)
              .eq('user_id', user.id)

            setIsRegistered(false)
            setRegistrantCount((c) => Math.max(0, c - 1))
          } catch (err) {
            Alert.alert('Error', 'Failed to cancel registration')
          } finally {
            setCancelling(false)
          }
        },
      },
    ])
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Event not found</Text>
        <Button title="Go Back" onPress={() => router.back()} variant="primary" size="md" />
      </View>
    )
  }

  const iconName = EVENT_ICONS[event.event_type] || 'calendar-outline'
  const typeLabel = EVENT_TYPE_LABELS[event.event_type] || event.event_type
  const isPast = new Date(event.end_time) < new Date()
  const isFull = event.max_participants && registrantCount >= event.max_participants

  const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const formatTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Icon name="arrow-back" size="md" color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>

        {/* Event Header */}
        <View style={styles.heroCard}>
          <View style={styles.typeRow}>
            <Icon name={iconName} size="md" color={colors.primary} />
            <Badge label={typeLabel} variant="brand" />
          </View>
          <Text style={styles.eventTitle}>{event.title}</Text>

          {event.court && (
            <View style={styles.infoRow}>
              <Icon name="location-outline" size="sm" color={colors.neutral500} />
              <Text style={styles.infoText}>{event.court.name}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Icon name="calendar-outline" size="sm" color={colors.neutral500} />
            <Text style={styles.infoText}>{formatDate(event.start_time)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Icon name="time-outline" size="sm" color={colors.neutral500} />
            <Text style={styles.infoText}>{formatTime(event.start_time)} - {formatTime(event.end_time)}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Icon name="people-outline" size="sm" color={colors.primary} />
              <Text style={styles.statText}>
                {registrantCount}{event.max_participants ? ` / ${event.max_participants}` : ''} registered
              </Text>
            </View>
            <View style={styles.statChip}>
              <Icon name="pricetag-outline" size="sm" color={colors.primary} />
              <Text style={styles.statText}>{event.price > 0 ? `$${event.price}` : 'Free'}</Text>
            </View>
          </View>
        </View>

        {/* Description */}
        {event.description && (
          <View style={styles.descCard}>
            <Text style={styles.descTitle}>About</Text>
            <Text style={styles.descText}>{event.description}</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom CTA */}
      {!isPast && (
        <View style={styles.footer}>
          {isRegistered ? (
            <TouchableOpacity
              style={styles.cancelRegButton}
              onPress={handleCancelRegistration}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color={colors.error} />
              ) : (
                <Text style={styles.cancelRegText}>Cancel Registration</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.registerButton, (isFull || registering) && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isFull || registering}
            >
              {registering ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.registerText}>
                  {isFull ? 'Event Full' : event.price > 0 ? `Register · $${event.price}` : 'Register — Free'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  errorText: { fontSize: 16, color: colors.neutral500 },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.base },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backText: { fontSize: fontSizes.base, color: colors.primary, fontWeight: fontWeights.semibold },
  heroCard: {
    marginHorizontal: spacing.lg, backgroundColor: colors.white, borderRadius: borderRadius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.neutral100, marginBottom: spacing.md,
  },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  eventTitle: { fontSize: 22, fontWeight: '700', color: colors.neutral900, marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  infoText: { fontSize: 14, color: colors.neutral600 },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.primarySurface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md,
  },
  statText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  descCard: {
    marginHorizontal: spacing.lg, backgroundColor: colors.white, borderRadius: borderRadius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.neutral100,
  },
  descTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900, marginBottom: spacing.sm },
  descText: { fontSize: 14, color: colors.neutral600, lineHeight: 22 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.neutral100,
    paddingHorizontal: spacing.lg, paddingTop: spacing.base, paddingBottom: 34,
  },
  registerButton: {
    backgroundColor: colors.primary, borderRadius: borderRadius.lg, padding: 18, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  registerText: { color: colors.white, fontSize: fontSizes.md, fontWeight: fontWeights.bold },
  cancelRegButton: {
    backgroundColor: colors.errorLight, borderRadius: borderRadius.lg, padding: 18, alignItems: 'center',
    borderWidth: 1, borderColor: colors.error + '30',
  },
  cancelRegText: { color: colors.error, fontSize: fontSizes.md, fontWeight: fontWeights.bold },
})
