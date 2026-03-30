import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { useAuthStore } from '../../store/authStore'
import { useOpenSpotsStore } from '../../store/openSpotsStore'

function getInitials(name) {
  if (!name) return '?'
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (d.toDateString() === now.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function OpenSpotFeedItem({ spot }) {
  const { user } = useAuthStore()
  const { sendRequest, mySentRequests } = useOpenSpotsStore()
  const isOwn = spot.user_id === user?.id
  const alreadyRequested = mySentRequests.some((r) => r.open_spot_id === spot.id)
  const poster = spot.poster
  const reservation = spot.reservation

  return (
    <View style={styles.card}>
      <Text style={styles.label}>🤝 LOOKING FOR PLAYERS</Text>
      <View style={styles.posterRow}>
        {poster?.avatar_url ? (
          <Image source={{ uri: poster.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{getInitials(poster?.full_name)}</Text>
          </View>
        )}
        <Text style={styles.posterName}>{poster?.full_name || 'Player'}</Text>
      </View>
      <Text style={styles.courtText}>
        {reservation?.court?.name || 'Court'} · {formatShortDate(reservation?.start_time)} {formatTime(reservation?.start_time)}
      </Text>
      {spot.description && (
        <Text style={styles.description}>"{spot.description}"</Text>
      )}
      {!isOwn && !alreadyRequested && (
        <TouchableOpacity
          style={styles.joinBtn}
          onPress={() => sendRequest(spot.id, user?.id)}
        >
          <Text style={styles.joinText}>Request to Join</Text>
        </TouchableOpacity>
      )}
      {alreadyRequested && (
        <Text style={styles.requestedText}>Requested ✓</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fefce8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fef08a',
  },
  label: {
    fontSize: 10, fontWeight: '700', color: '#a16207',
    letterSpacing: 0.5, marginBottom: 8,
  },
  posterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarFallback: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  posterName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  courtText: { fontSize: 13, color: '#475569', marginBottom: 4 },
  description: { fontSize: 13, color: '#64748b', fontStyle: 'italic', marginBottom: 8 },
  joinBtn: {
    backgroundColor: '#2563eb', borderRadius: 8,
    paddingVertical: 7, alignItems: 'center', marginTop: 4,
  },
  joinText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  requestedText: { fontSize: 13, fontWeight: '600', color: '#16a34a', marginTop: 4 },
})
