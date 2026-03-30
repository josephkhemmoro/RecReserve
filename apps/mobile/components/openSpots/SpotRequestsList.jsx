import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { getRelativeTime } from '../../lib/timeHelpers'

function getInitials(name) {
  if (!name) return '?'
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
}

export function SpotRequestsList({ requests, spotOwnerName, onAccept, onDecline }) {
  if (!requests || requests.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No requests yet</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {requests.map((req) => {
        const requester = req.requester
        return (
          <View key={req.id} style={styles.row}>
            {requester?.avatar_url ? (
              <Image source={{ uri: requester.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{getInitials(requester?.full_name)}</Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.name}>{requester?.full_name || 'Player'}</Text>
              {req.message ? <Text style={styles.message}>{req.message}</Text> : null}
              <Text style={styles.time}>{getRelativeTime(req.created_at)}</Text>
            </View>
            <View style={styles.actions}>
              {req.status === 'pending' ? (
                <>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => onAccept(req.id)}
                  >
                    <Text style={styles.acceptText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineBtn}
                    onPress={() => onDecline(req.id)}
                  >
                    <Text style={styles.declineText}>Decline</Text>
                  </TouchableOpacity>
                </>
              ) : req.status === 'accepted' ? (
                <View style={styles.statusBadge}>
                  <Text style={styles.acceptedText}>Accepted ✓</Text>
                </View>
              ) : (
                <View style={styles.statusBadge}>
                  <Text style={styles.declinedText}>Declined</Text>
                </View>
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  empty: { paddingVertical: 12 },
  emptyText: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  message: { fontSize: 13, color: '#64748b', marginTop: 2 },
  time: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 6 },
  acceptBtn: {
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  acceptText: { fontSize: 12, fontWeight: '600', color: '#16a34a' },
  declineBtn: {
    backgroundColor: '#fef2f2',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  declineText: { fontSize: 12, fontWeight: '600', color: '#dc2626' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4 },
  acceptedText: { fontSize: 12, fontWeight: '600', color: '#16a34a' },
  declinedText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
})
