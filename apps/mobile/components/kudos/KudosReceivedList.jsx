import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { colors, textStyles, spacing } from '../../theme'
import { Avatar } from '../ui'

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
  if (isLoading) return <View style={styles.centered}><ActivityIndicator size="small" color={colors.primary} /></View>
  if (kudos.length === 0) return <View style={styles.emptyState}><Text style={styles.emptyText}>No kudos yet — play a match and your partners can send you kudos!</Text></View>

  return (
    <View>
      {kudos.slice(0, 10).map((item) => {
        const sender = item.sender
        return (
          <View key={item.id} style={styles.row}>
            <Avatar uri={sender?.avatar_url} name={sender?.full_name || 'Someone'} size="sm" />
            <View style={styles.info}>
              <Text style={styles.name}>{sender?.full_name || 'Someone'} <Text style={styles.action}>sent you kudos!</Text></Text>
              <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  centered: { paddingVertical: spacing.lg, alignItems: 'center' },
  emptyState: { paddingVertical: spacing.base },
  emptyText: { ...textStyles.bodySmall, color: colors.neutral400, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.neutral100, gap: spacing.sm },
  info: { flex: 1 },
  name: { ...textStyles.bodySmall, fontWeight: '600', color: colors.neutral900 },
  action: { fontWeight: '400', color: colors.neutral500 },
  time: { ...textStyles.caption, color: colors.neutral400, marginTop: 2 },
})
