import { View, Text, StyleSheet } from 'react-native'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Icon } from './Icon'
import { Button } from './Button'

export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <View style={styles.container}>
      <Icon name={icon} size="lg" color={colors.neutral300} style={styles.icon} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {action && (
        <Button
          title={action.label}
          onPress={action.onPress}
          variant="secondary"
          size="sm"
          style={styles.button}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.xl,
  },
  icon: { marginBottom: spacing.md },
  title: {
    ...textStyles.bodyMedium,
    color: colors.neutral700,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...textStyles.bodySmall,
    color: colors.neutral400,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: { marginTop: spacing.base },
})
