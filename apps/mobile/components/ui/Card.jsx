import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, spacing, shadows, borderRadius } from '../../theme'

const VARIANTS = {
  default: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  elevated: {
    backgroundColor: colors.white,
    ...shadows.md,
  },
  outlined: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral200,
  },
  highlighted: {
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
}

export function Card({ children, variant = 'default', onPress, style }) {
  const variantStyle = VARIANTS[variant] || VARIANTS.default
  const cardStyle = [styles.base, variantStyle, style]

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    )
  }

  return <View style={cardStyle}>{children}</View>
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
})
