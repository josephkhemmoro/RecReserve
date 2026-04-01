import { View, Text, Alert, StyleSheet } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Icon, Button, Badge } from '../ui'

const EVENT_ICONS = {
  tournament: 'trophy-outline',
  open_play: 'tennisball-outline',
  clinic: 'school-outline',
  lesson: 'book-outline',
}

function formatEventDate(startTime, endTime) {
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : null
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)

  let dayStr
  if (start.toDateString() === now.toDateString()) dayStr = 'Today'
  else if (start.toDateString() === tomorrow.toDateString()) dayStr = 'Tomorrow'
  else dayStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const startStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (!end) return `${dayStr} · ${startStr}`
  const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${dayStr} · ${startStr} - ${endStr}`
}

export function EventFeedItem({ event }) {
  const { user } = useAuthStore()
  const iconName = EVENT_ICONS[event.event_type] || 'calendar-outline'
  const priceText = event.price > 0 ? `$${event.price}` : 'Free'
  const spotsText = event.max_participants
    ? `${event.registered_count || 0}/${event.max_participants} spots`
    : `${event.registered_count || 0} registered`

  const handleRegister = async () => {
    if (!user?.id) return
    try {
      const { error } = await supabase.from('event_registrations').insert({
        event_id: event.id, user_id: user.id, status: 'registered',
      })
      if (error) {
        if (error.code === '23505') Alert.alert('Already Registered')
        else throw error
      } else Alert.alert('Registered!', 'You have been registered for this event.')
    } catch { Alert.alert('Error', 'Failed to register.') }
  }

  return (
    <View style={styles.card}>
      <Badge label="UPCOMING EVENT" variant="success" icon="calendar-outline" size="sm" />
      <View style={styles.titleRow}>
        <Icon name={iconName} size="md" color={colors.success} />
        <Text style={styles.title}>{event.title}</Text>
      </View>
      <Text style={styles.dateText}>{formatEventDate(event.start_time, event.end_time)}</Text>
      <Text style={styles.meta}>{spotsText} · {priceText}</Text>
      <Button title="Register" onPress={handleRegister} variant="primary" size="sm" fullWidth />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.successLight, borderRadius: borderRadius.lg,
    padding: spacing.base, marginBottom: spacing.md,
    borderWidth: 1, borderColor: '#BBF7D0', gap: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...textStyles.bodyMedium, color: colors.neutral900, flex: 1 },
  dateText: { ...textStyles.bodySmall, color: colors.neutral600 },
  meta: { ...textStyles.caption, color: colors.neutral500 },
})
