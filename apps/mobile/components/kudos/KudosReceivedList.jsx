import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native'

function getInitials(name) {
  if (!name) return '?'
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
}

function timeAgo(dateStr) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function KudosReceivedList({ kudos, isLoading }) {
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color="#FF8A65" />
      </View>
    )
  }

  if (kudos.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>
          No kudos yet — play a match and your partners can send you kudos! 🤝
        </Text>
      </View>
    )
  }

  const displayKudos = kudos.slice(0, 10)

  return (
    <View>
      {displayKudos.map((item) => {
        const sender = item.sender
        return (
          <View key={item.id} style={styles.row}>
            {sender?.avatar_url ? (
              <Image source={{ uri: sender.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>
                  {getInitials(sender?.full_name)}
                </Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.name}>
                {sender?.full_name || 'Someone'}
                <Text style={styles.action}> sent you kudos!</Text>
              </Text>
              <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  action: {
    fontWeight: '400',
    color: '#64748b',
  },
  time: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
})
