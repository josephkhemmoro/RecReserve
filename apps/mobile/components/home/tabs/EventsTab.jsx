import { useState } from 'react'
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { colors, textStyles, spacing, borderRadius } from '../../../theme'
import { Icon, Button } from '../../ui'

const EVENT_ICONS = { tournament: 'trophy-outline', open_play: 'tennisball-outline', clinic: 'school-outline', lesson: 'book-outline' }

function formatEventDate(startTime, endTime) {
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : null
  const now = new Date()
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  let dayStr
  if (start.toDateString() === now.toDateString()) dayStr = 'Today'
  else if (start.toDateString() === tomorrow.toDateString()) dayStr = 'Tomorrow'
  else dayStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const startStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (!end) return `${dayStr} · ${startStr}`
  return `${dayStr} · ${startStr} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
}

export function EventsTab({ upcomingEvents, pastEvents }) {
  const { user } = useAuthStore()
  const [showPast, setShowPast] = useState(false)
  const [registeringId, setRegisteringId] = useState(null)

  const handleRegister = async (eventId) => {
    if (!user?.id) return
    setRegisteringId(eventId)
    try {
      const { error } = await supabase.from('event_registrations').insert({ event_id: eventId, user_id: user.id, status: 'registered' })
      if (error) { if (error.code === '23505') Alert.alert('Already Registered'); else throw error }
      else Alert.alert('Registered!', 'You have been registered for this event.')
    } catch { Alert.alert('Error', 'Failed to register.') } finally { setRegisteringId(null) }
  }

  const hasUpcoming = upcomingEvents && upcomingEvents.length > 0
  const hasPast = pastEvents && pastEvents.length > 0

  return (
    <View style={styles.container}>
      {!hasUpcoming && !hasPast ? (
        <View style={styles.empty}>
          <Icon name="calendar-outline" size="lg" color={colors.neutral300} />
          <Text style={styles.emptyTitle}>No events yet</Text>
          <Text style={styles.emptySub}>Check back soon for tournaments, open play, and more</Text>
        </View>
      ) : (
        <>
          {hasUpcoming && upcomingEvents.map((event) => {
            const iconName = EVENT_ICONS[event.event_type] || 'calendar-outline'
            const capacityText = event.max_participants ? `${event.registered_count || 0}/${event.max_participants} spots` : `${event.registered_count || 0} registered`
            const priceText = event.price > 0 ? `$${event.price}` : 'Free'
            return (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventHeader}>
                  <Icon name={iconName} size="md" color={colors.primary} />
                  <Text style={styles.eventTitle}>{event.title}</Text>
                </View>
                <Text style={styles.eventMeta}>{formatEventDate(event.start_time, event.end_time)}</Text>
                <Text style={styles.eventMeta}>{capacityText} · {priceText}</Text>
                {event.description && <Text style={styles.eventDesc} numberOfLines={2}>{event.description}</Text>}
                <Button title={registeringId === event.id ? 'Registering...' : 'Register'} onPress={() => handleRegister(event.id)} variant="primary" size="sm" fullWidth disabled={registeringId === event.id} />
              </View>
            )
          })}

          {hasPast && (
            <>
              <TouchableOpacity style={styles.pastToggle} onPress={() => setShowPast(!showPast)}>
                <Text style={styles.pastToggleText}>{showPast ? 'Hide past events' : 'Show past events'}</Text>
                <Icon name={showPast ? 'chevron-up' : 'chevron-down'} size="sm" color={colors.neutral500} />
              </TouchableOpacity>
              {showPast && pastEvents.map((event) => (
                <View key={event.id} style={styles.pastCard}>
                  <Icon name={EVENT_ICONS[event.event_type] || 'calendar-outline'} size="sm" color={colors.neutral400} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pastTitle}>{event.title}</Text>
                    <Text style={styles.pastMeta}>{new Date(event.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </>
      )}
      <View style={{ height: 100 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  empty: { alignItems: 'center', paddingVertical: spacing['3xl'], gap: spacing.sm },
  emptyTitle: { ...textStyles.bodyMedium, color: colors.neutral700 },
  emptySub: { ...textStyles.bodySmall, color: colors.neutral400, textAlign: 'center' },
  eventCard: { borderWidth: 1, borderColor: colors.neutral150, borderRadius: borderRadius.lg, padding: spacing.base, marginBottom: spacing.md, gap: spacing.xs },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eventTitle: { ...textStyles.bodyMedium, color: colors.neutral900, flex: 1 },
  eventMeta: { ...textStyles.caption, color: colors.neutral500 },
  eventDesc: { ...textStyles.bodySmall, color: colors.neutral600, lineHeight: 18 },
  pastToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  pastToggleText: { ...textStyles.label, color: colors.neutral500 },
  pastCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.neutral50, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.xs },
  pastTitle: { ...textStyles.bodySmall, fontWeight: '600', color: colors.neutral600 },
  pastMeta: { ...textStyles.caption, color: colors.neutral400 },
})
