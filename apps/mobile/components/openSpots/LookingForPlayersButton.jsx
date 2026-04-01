import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, textStyles, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Badge } from '../ui'

export function LookingForPlayersButton({ activeSpotCount, onPress }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.content}>
        <Icon name="people-outline" size="md" color={colors.primary} />
        <Text style={styles.text}>Looking for Players</Text>
      </View>
      {activeSpotCount > 0 && <Badge label={`${activeSpotCount} open`} variant="primary" size="sm" />}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg,
    marginBottom: spacing.lg, borderWidth: 1.5, borderColor: colors.neutral200, ...shadows.sm,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { ...textStyles.bodyMedium, color: colors.neutral900, fontWeight: '700' },
})
