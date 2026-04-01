import { View, Text, StyleSheet } from 'react-native'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Icon } from '../ui'

export function KudosBadge({ count }) {
  if (count === 0) return null
  return (
    <View style={styles.badge}>
      <Icon name="heart" size="sm" color={colors.kudos} />
      <Text style={styles.text}>{count} kudos</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.kudosLight, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.full, gap: spacing.xs },
  text: { ...textStyles.label, color: colors.kudos },
})
