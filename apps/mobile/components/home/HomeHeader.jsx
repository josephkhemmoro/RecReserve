import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, textStyles, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Avatar } from '../ui'

function getGreeting(firstName, hour) {
  if (hour < 12) return `Good morning, ${firstName}`
  if (hour < 17) return `Good afternoon, ${firstName}`
  return `Good evening, ${firstName}`
}

export function HomeHeader({
  firstName,
  selectedClub,
  unreadCount,
  rebookSuggestion,
  onToggleClubPicker,
  onRebook,
}) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const hour = new Date().getHours()
  const showSuggestion = rebookSuggestion && !dismissed

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.greeting} numberOfLines={1}>
          {getGreeting(firstName, hour)}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/(tabs)/notifications')}
          >
            <Icon name="notifications-outline" size="md" color={colors.neutral800} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.clubBtn} onPress={onToggleClubPicker}>
            <Avatar uri={selectedClub?.logo_url} name={selectedClub?.name || '?'} size="sm" />
            <Icon name="chevron-down" size="sm" color={colors.neutral400} />
          </TouchableOpacity>
        </View>
      </View>

      {showSuggestion && (
        <View style={styles.suggestion}>
          <Icon name="repeat-outline" size="sm" color={colors.primary} style={{ marginTop: 2 }} />
          <View style={styles.suggestionContent}>
            <Text style={styles.suggestionText}>{rebookSuggestion.message}</Text>
            <Text style={styles.suggestionSub}>{rebookSuggestion.preferredCourtName}</Text>
          </View>
          <TouchableOpacity style={styles.rebookBtn} onPress={onRebook}>
            <Text style={styles.rebookText}>Book Again</Text>
            <Icon name="arrow-forward" size="sm" color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dismissBtn} onPress={() => setDismissed(true)}>
            <Icon name="close" size="sm" color={colors.neutral400} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.base },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { ...textStyles.heading3, color: colors.neutral900, flex: 1, marginRight: spacing.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBtn: { position: 'relative', padding: spacing.xs },
  badge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: colors.accent, borderRadius: borderRadius.full, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: colors.white },
  clubBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  suggestion: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primarySurface, borderRadius: borderRadius.lg,
    padding: spacing.md, marginTop: spacing.md,
    borderWidth: 1, borderColor: colors.primaryMuted, gap: spacing.sm,
  },
  suggestionContent: { flex: 1 },
  suggestionText: { ...textStyles.label, color: colors.neutral800 },
  suggestionSub: { ...textStyles.caption, color: colors.neutral500, marginTop: 1 },
  rebookBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: spacing.sm },
  rebookText: { ...textStyles.label, color: colors.primary },
  dismissBtn: { padding: spacing.xs },
})
