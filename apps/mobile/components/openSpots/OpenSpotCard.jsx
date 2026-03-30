import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { getRelativeTime } from '../../lib/timeHelpers'

function getInitials(name) {
  if (!name) return '?'
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
}

function formatDateTime(startTime, endTime) {
  const start = new Date(startTime)
  const end = new Date(endTime)
  const dateStr = start.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const timeStr = `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
  return `${dateStr} · ${timeStr}`
}

const SKILL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

export function OpenSpotCard({ spot, currentUserId, alreadyRequested, onRequestJoin }) {
  const poster = spot.poster
  const reservation = spot.reservation
  const court = reservation?.court
  const spotsRemaining = spot.spots_needed - (spot.accepted_count || 0)
  const isFilled = spotsRemaining <= 0
  const isOwnPost = spot.user_id === currentUserId

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        {poster?.avatar_url ? (
          <Image source={{ uri: poster.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{getInitials(poster?.full_name)}</Text>
          </View>
        )}
        <View style={styles.posterInfo}>
          <Text style={styles.posterName}>{poster?.full_name || 'Player'}</Text>
          <Text style={styles.timeAgo}>{getRelativeTime(spot.created_at)}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <Text style={styles.detailLine}>
          🎾 {court?.name || 'Court'}
        </Text>
        <Text style={styles.detailLine}>
          📅 {formatDateTime(reservation?.start_time, reservation?.end_time)}
        </Text>
        <Text style={styles.detailLine}>
          👥 Looking for {spotsRemaining} more player{spotsRemaining !== 1 ? 's' : ''}
        </Text>
      </View>

      {spot.description ? (
        <Text style={styles.description}>💬 "{spot.description}"</Text>
      ) : null}

      {spot.skill_level && spot.skill_level !== 'any' ? (
        <View style={styles.skillBadge}>
          <Text style={styles.skillText}>🎯 {SKILL_LABELS[spot.skill_level] || spot.skill_level}</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        {isFilled ? (
          <View style={styles.filledBadge}>
            <Text style={styles.filledText}>Filled!</Text>
          </View>
        ) : isOwnPost ? (
          <Text style={styles.ownPostText}>Your post</Text>
        ) : alreadyRequested ? (
          <View style={styles.requestedBadge}>
            <Text style={styles.requestedText}>Requested ✓</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.joinButton} onPress={() => onRequestJoin(spot.id)}>
            <Text style={styles.joinButtonText}>Request to Join</Text>
          </TouchableOpacity>
        )}

        {spot.request_count > 0 && (
          <Text style={styles.interestedText}>{spot.request_count} interested</Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  posterInfo: { flex: 1 },
  posterName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  timeAgo: { fontSize: 12, color: '#94a3b8' },
  details: { gap: 4, marginBottom: 8 },
  detailLine: { fontSize: 14, color: '#475569', lineHeight: 20 },
  description: { fontSize: 14, color: '#64748b', fontStyle: 'italic', marginBottom: 8 },
  skillBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  skillText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  joinButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  joinButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  requestedBadge: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  requestedText: { color: '#16a34a', fontSize: 13, fontWeight: '600' },
  filledBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filledText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  ownPostText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  interestedText: { fontSize: 13, color: '#94a3b8' },
})
