import { View, Text, StyleSheet } from 'react-native'
import { getRelativeTime } from '../../lib/timeHelpers'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Avatar, Icon } from '../ui'

const EVENT_CONFIG = {
  booking: { icon: 'tennisball-outline', color: colors.primary },
  streak_milestone: { icon: 'flame', color: colors.streak },
  kudos: { icon: 'heart-outline', color: colors.kudos },
  event_created: { icon: 'calendar-outline', color: colors.info },
  member_joined: { icon: 'person-add-outline', color: colors.success },
}

function getFeedText(event) {
  const name = event.actor?.full_name || 'Someone'
  const meta = event.metadata || {}

  switch (event.event_type) {
    case 'booking':
      return { text: `booked ${meta.court_name || 'a court'}`, name }
    case 'streak_milestone':
      return { text: `hit a ${meta.milestone}-week streak! ${meta.milestone_label || ''}`, name }
    case 'kudos':
      return { text: `sent kudos to ${meta.receiver_name || 'a teammate'}`, name }
    case 'event_created':
      return { text: `New event: ${meta.event_title || 'Untitled'}`, name: '' }
    case 'member_joined':
      return { text: 'joined the club', name }
    default:
      return { text: 'did something', name }
  }
}

export function FeedItem({ event }) {
  const { text, name } = getFeedText(event)
  const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.booking
  const actor = event.actor

  return (
    <View style={styles.container}>
      <Avatar uri={actor?.avatar_url} name={actor?.full_name || '?'} size="sm" />
      <View style={styles.content}>
        <Text style={styles.text} numberOfLines={2}>
          {name ? <Text style={styles.name}>{name} </Text> : null}
          <Text>{text}</Text>
        </Text>
        <View style={styles.meta}>
          <Icon name={config.icon} size="sm" color={config.color} />
          <Text style={styles.time}>{getRelativeTime(event.created_at)}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: spacing.md, borderBottomWidth: 1,
    borderBottomColor: colors.neutral100, gap: spacing.sm,
  },
  content: { flex: 1 },
  text: { ...textStyles.bodySmall, color: colors.neutral700, lineHeight: 20 },
  name: { fontWeight: '700', color: colors.neutral900 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  time: { ...textStyles.caption, color: colors.neutral400 },
})
