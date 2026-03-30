import { View, Text, Image, StyleSheet } from 'react-native'
import { getRelativeTime } from '../../lib/timeHelpers'

function getInitials(name) {
  if (!name) return '?'
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
}

function formatFeedTime(timeStr) {
  const d = new Date(timeStr)
  return d.toLocaleString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getFeedContent(event) {
  const name = event.actor?.full_name || 'Someone'
  const meta = event.metadata || {}

  switch (event.event_type) {
    case 'booking':
      return { icon: '🎾', text: `booked ${meta.court_name || 'a court'}`, name }
    case 'streak_milestone':
      return { icon: '🔥', text: `hit a ${meta.milestone}-week streak! ${meta.milestone_label || ''}`, name }
    case 'kudos':
      return { icon: '🤝', text: `sent kudos to ${meta.receiver_name || 'a teammate'}`, name }
    case 'event_created':
      return { icon: '📅', text: `New event: ${meta.event_title || 'Untitled'}`, name: '' }
    case 'member_joined':
      return { icon: '👋', text: 'joined the club!', name }
    default:
      return { icon: '📣', text: 'did something', name }
  }
}

export function FeedItem({ event }) {
  const { icon, text, name } = getFeedContent(event)
  const actor = event.actor

  return (
    <View style={styles.container}>
      {actor?.avatar_url ? (
        <Image source={{ uri: actor.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarText}>{getInitials(actor?.full_name)}</Text>
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.text} numberOfLines={2}>
          <Text style={styles.icon}>{icon} </Text>
          {name ? <Text style={styles.name}>{name} </Text> : null}
          <Text>{text}</Text>
        </Text>
        <Text style={styles.time}>{getRelativeTime(event.created_at)}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  content: {
    flex: 1,
  },
  text: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
  },
  icon: {
    fontSize: 14,
  },
  name: {
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
})
