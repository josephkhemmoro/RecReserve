import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'

function formatSmartDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)

  if (date.toDateString() === now.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function getCountdown(startTime) {
  const diff = new Date(startTime).getTime() - Date.now()
  if (diff < 0) return null
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours >= 24) return null
  if (hours > 0) return `Starts in ${hours}h ${mins > 0 ? `${mins}m` : ''}`
  if (mins > 0) return `Starts in ${mins}m`
  return 'Starting now'
}

export function NextSessionCard({ reservation, hasClub }) {
  const router = useRouter()

  if (!hasClub) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/(tabs)/clubs')}
        activeOpacity={0.7}
      >
        <Text style={styles.emptyTitle}>Join a club to start booking! 🎾</Text>
        <View style={styles.ctaBtn}>
          <Text style={styles.ctaBtnText}>Find a Club</Text>
        </View>
      </TouchableOpacity>
    )
  }

  if (!reservation) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/courts')}
        activeOpacity={0.7}
      >
        <Text style={styles.emptyTitle}>No upcoming sessions</Text>
        <Text style={styles.emptySubtitle}>Ready to get on court?</Text>
        <View style={styles.ctaBtn}>
          <Text style={styles.ctaBtnText}>Book a Court</Text>
        </View>
      </TouchableOpacity>
    )
  }

  const countdown = getCountdown(reservation.start_time)

  return (
    <TouchableOpacity
      style={[styles.card, styles.cardWithAccent]}
      onPress={() => router.push('/(tabs)/reservations')}
      activeOpacity={0.7}
    >
      <Text style={styles.label}>NEXT SESSION</Text>
      <Text style={styles.courtName}>{reservation.court?.name || 'Court'}</Text>
      <Text style={styles.dateTime}>
        {formatSmartDate(reservation.start_time)} · {formatTime(reservation.start_time)} – {formatTime(reservation.end_time)}
      </Text>
      {countdown && <Text style={styles.countdown}>{countdown}</Text>}
      <Text style={styles.viewLink}>View Details →</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardWithAccent: {
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  label: {
    fontSize: 10, fontWeight: '700', color: '#94a3b8',
    letterSpacing: 1, marginBottom: 6,
  },
  courtName: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  dateTime: { fontSize: 14, color: '#475569', marginBottom: 4 },
  countdown: { fontSize: 13, fontWeight: '600', color: '#2563eb', marginBottom: 6 },
  viewLink: { fontSize: 13, fontWeight: '600', color: '#2563eb', marginTop: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 12 },
  ctaBtn: {
    backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 10,
    alignItems: 'center', marginTop: 4,
  },
  ctaBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
})
