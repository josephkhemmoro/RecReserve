import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

const EVENT_ICONS = {
  tournament: '🏆',
  open_play: '🎾',
  clinic: '📚',
  lesson: '🎓',
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
  const icon = EVENT_ICONS[event.event_type] || '📅'
  const priceText = event.price > 0 ? `$${event.price}` : 'Free'
  const spotsText = event.max_participants
    ? `${event.registered_count || 0}/${event.max_participants} spots`
    : `${event.registered_count || 0} registered`

  const handleRegister = async () => {
    if (!user?.id) return
    try {
      const { error } = await supabase.from('event_registrations').insert({
        event_id: event.id,
        user_id: user.id,
        status: 'registered',
      })
      if (error) {
        if (error.code === '23505') Alert.alert('Already Registered')
        else throw error
      } else {
        Alert.alert('Registered!', 'You have been registered for this event.')
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to register.')
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>📅 UPCOMING EVENT</Text>
      <Text style={styles.title}>{icon} {event.title}</Text>
      <Text style={styles.dateText}>
        {formatEventDate(event.start_time, event.end_time)}
      </Text>
      <Text style={styles.meta}>{spotsText} · {priceText}</Text>
      <TouchableOpacity style={styles.registerBtn} onPress={handleRegister}>
        <Text style={styles.registerText}>Register</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  label: {
    fontSize: 10, fontWeight: '700', color: '#15803d',
    letterSpacing: 0.5, marginBottom: 6,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  dateText: { fontSize: 13, color: '#475569', marginBottom: 2 },
  meta: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  registerBtn: {
    backgroundColor: '#16a34a', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  registerText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
})
