import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, textStyles, spacing } from '../../theme'
import { Icon } from './Icon'

export function SectionHeader({ title, icon, action }) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {icon && <Icon name={icon} size="sm" color={colors.neutral500} />}
        <Text style={styles.title}>{title}</Text>
      </View>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={styles.action}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...textStyles.heading4,
    color: colors.neutral900,
  },
  action: {
    ...textStyles.label,
    color: colors.primary,
  },
})
