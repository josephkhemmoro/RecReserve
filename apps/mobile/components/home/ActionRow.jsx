import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, textStyles, spacing, borderRadius, shadows } from '../../theme'
import { Icon } from '../ui'

const ACTIONS = [
  { key: 'book', icon: 'tennisball-outline', label: 'Book', route: '/courts' },
  { key: 'players', icon: 'people-outline', label: 'Players', route: '/players' },
  { key: 'events', icon: 'calendar-outline', label: 'Events', route: null },
]

export function ActionRow({ clubId }) {
  const router = useRouter()

  if (!clubId) return null

  return (
    <View style={styles.container}>
      {ACTIONS.map((action) => (
        <TouchableOpacity
          key={action.key}
          style={styles.button}
          onPress={() => {
            if (action.route) router.push(action.route)
            else router.push(`/club/${clubId}`)
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Icon name={action.icon} size="md" color={colors.primary} />
          </View>
          <Text style={styles.label}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    ...shadows.sm,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { ...textStyles.label, color: colors.neutral800 },
})
