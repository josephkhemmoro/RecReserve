import { View, Text, StyleSheet } from 'react-native'
import { getRelativeTime } from '../../lib/timeHelpers'
import { colors, textStyles, spacing } from '../../theme'
import { Avatar, Button, Badge } from '../ui'

export function SpotRequestsList({ requests, spotOwnerName, onAccept, onDecline }) {
  if (!requests || requests.length === 0) {
    return <View style={styles.empty}><Text style={styles.emptyText}>No requests yet</Text></View>
  }

  return (
    <View style={styles.container}>
      {requests.map((req) => {
        const requester = req.requester
        return (
          <View key={req.id} style={styles.row}>
            <Avatar uri={requester?.avatar_url} name={requester?.full_name || 'Player'} size="sm" />
            <View style={styles.info}>
              <Text style={styles.name}>{requester?.full_name || 'Player'}</Text>
              {req.message && <Text style={styles.message}>{req.message}</Text>}
              <Text style={styles.time}>{getRelativeTime(req.created_at)}</Text>
            </View>
            <View style={styles.actions}>
              {req.status === 'pending' ? (
                <>
                  <Button title="Accept" onPress={() => onAccept(req.id)} variant="primary" size="sm" />
                  <Button title="Decline" onPress={() => onDecline(req.id)} variant="ghost" size="sm" />
                </>
              ) : req.status === 'accepted' ? (
                <Badge label="Accepted" variant="success" size="sm" />
              ) : (
                <Badge label="Declined" variant="default" size="sm" />
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
  empty: { paddingVertical: spacing.md },
  emptyText: { ...textStyles.bodySmall, color: colors.neutral400, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.neutral100, gap: spacing.sm },
  info: { flex: 1 },
  name: { ...textStyles.bodyMedium, color: colors.neutral900 },
  message: { ...textStyles.caption, color: colors.neutral500, marginTop: 2 },
  time: { ...textStyles.caption, color: colors.neutral400, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.xs },
})
