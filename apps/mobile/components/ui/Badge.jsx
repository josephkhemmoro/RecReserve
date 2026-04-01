import { View, Text, StyleSheet } from 'react-native'
import { colors, fontSizes, fontWeights, borderRadius, spacing } from '../../theme'
import { Icon } from './Icon'

const VARIANTS = {
  default: { bg: colors.neutral100, text: colors.neutral600, icon: null },
  success: { bg: colors.successLight, text: colors.success, icon: 'checkmark-circle' },
  warning: { bg: colors.warningLight, text: colors.warning, icon: 'alert-circle' },
  error: { bg: colors.errorLight, text: colors.error, icon: 'close-circle' },
  info: { bg: colors.infoLight, text: colors.info, icon: 'information-circle' },
  streak: { bg: colors.streakLight, text: colors.streak, icon: 'flame' },
  kudos: { bg: colors.kudosLight, text: colors.kudos, icon: 'heart' },
  primary: { bg: colors.primaryMuted, text: colors.primary, icon: null },
}

export function Badge({ label, variant = 'default', size = 'md', icon: customIcon }) {
  const v = VARIANTS[variant] || VARIANTS.default
  const isSmall = size === 'sm'
  const iconName = customIcon || v.icon

  return (
    <View style={[styles.base, { backgroundColor: v.bg }, isSmall && styles.small]}>
      {iconName && (
        <Icon name={iconName} size="sm" color={v.text} />
      )}
      <Text style={[styles.text, { color: v.text }, isSmall && styles.textSmall]}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },
  textSmall: {
    fontSize: 10,
  },
})
