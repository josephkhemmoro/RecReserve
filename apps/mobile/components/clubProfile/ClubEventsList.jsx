import { useState } from 'react'
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
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
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const startStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (!end) return `${dateStr} · ${startStr}`
  const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${dateStr} · ${startStr} - ${endStr}`
}

export function ClubEventsList({ upcomingEvents, pastEvents, isMember }) {
  const { user } = useAuthStore()
  const [showPast, setShowPast] = useState(false)
  const [registeringId, setRegisteringId] = useState(null)

  const handleRegister = async (eventId) => {
    if (!user?.id) return
    setRegisteringId(eventId)
    try {
      const { error } = await supabase.from('event_registrations').insert({
        event_id: eventId,
        user_id: user.id,
        status: 'registered',
      })
      if (error) {
        if (error.code === '23505') {
          Alert.alert('Already Registered', 'You are already registered for this event.')
        } else {
          throw error
        }
      } else {
        Alert.alert('Registered!', 'You have been registered for this event.')
      }
    } catch (err) {
      console.error('Error registering:', err)
      Alert.alert('Error', 'Failed to register. Please try again.')
    } finally {
      setRegisteringId(null)
    }
  }

  const hasUpcoming = upcomingEvents && upcomingEvents.length > 0
  const hasPast = pastEvents && pastEvents.length > 0

  if (!hasUpcoming && !hasPast) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerIcon}>📅</Text>
          <Text style={styles.title}>Events & Tournaments</Text>
        </View>
        <Text style={styles.emptyText}>No events yet.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>📅</Text>
        <Text style={styles.title}>Events & Tournaments</Text>
      </View>

      {hasUpcoming && (
        <>
          <Text style={styles.subHeader}>Upcoming</Text>
          {upcomingEvents.map((event) => {
            const icon = EVENT_ICONS[event.event_type] || '📅'
            const capacityText = event.max_participants
              ? `${event.registered_count}/${event.max_participants} registered`
              : `${event.registered_count} registered`
            const priceText = event.price > 0 ? `$${event.price}` : 'Free'

            return (
              <View key={event.id} style={styles.eventCard}>
                <Text style={styles.eventTitle}>{icon} {event.title}</Text>
                <Text style={styles.eventType}>
                  {(event.event_type || '').replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  {' · '}
                  {formatEventDate(event.start_time, event.end_time)}
                </Text>
                <Text style={styles.eventMeta}>{capacityText} · {priceText}</Text>
                {event.description && (
                  <Text style={styles.eventDesc} numberOfLines={2}>{event.description}</Text>
                )}
                {isMember && (
                  <TouchableOpacity
                    style={styles.registerBtn}
                    onPress={() => handleRegister(event.id)}
                    disabled={registeringId === event.id}
                  >
                    <Text style={styles.registerText}>
                      {registeringId === event.id ? 'Registering...' : 'Register'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          })}
        </>
      )}

      {hasPast && (
        <>
          <TouchableOpacity
            style={styles.pastToggle}
            onPress={() => setShowPast(!showPast)}
          >
            <Text style={styles.pastToggleText}>
              {showPast ? 'Hide past events' : 'Show past events'}
            </Text>
            <Ionicons name={showPast ? 'chevron-up' : 'chevron-down'} size={16} color="#64748b" />
          </TouchableOpacity>

          {showPast && pastEvents.map((event) => {
            const icon = EVENT_ICONS[event.event_type] || '📅'
            return (
              <View key={event.id} style={styles.pastCard}>
                <Text style={styles.pastTitle}>{icon} {event.title}</Text>
                <Text style={styles.pastMeta}>
                  {new Date(event.start_time).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                  {event.price > 0 ? ` · $${event.price}` : ' · Free'}
                </Text>
              </View>
            )
          })}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  headerIcon: { fontSize: 18 },
  title: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  emptyText: { fontSize: 14, color: '#94a3b8' },
  subHeader: { fontSize: 13, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 },
  eventCard: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 8,
  },
  eventTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  eventType: { fontSize: 13, color: '#64748b', marginBottom: 2 },
  eventMeta: { fontSize: 13, color: '#94a3b8', marginBottom: 4 },
  eventDesc: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 8 },
  registerBtn: {
    backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 4,
  },
  registerText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  pastToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 12, marginTop: 8,
  },
  pastToggleText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  pastCard: {
    backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 6,
  },
  pastTitle: { fontSize: 14, fontWeight: '600', color: '#475569' },
  pastMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
})
