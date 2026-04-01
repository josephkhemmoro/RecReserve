import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { colors, fontSizes, fontWeights, spacing, borderRadius, shadows } from '../../theme'
import { Icon } from './Icon'

const VARIANT_STYLES = {
  primary: {
    button: { backgroundColor: colors.primary, ...shadows.sm },
    text: { color: colors.white },
    pressed: colors.primaryDark,
  },
  accent: {
    button: { backgroundColor: colors.accent, ...shadows.sm },
    text: { color: colors.white },
    pressed: colors.accentDark,
  },
  secondary: {
    button: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.primary },
    text: { color: colors.primary },
    pressed: colors.primarySurface,
  },
  ghost: {
    button: { backgroundColor: 'transparent' },
    text: { color: colors.primary },
    pressed: colors.primarySurface,
  },
  danger: {
    button: { backgroundColor: colors.errorLight, borderWidth: 1, borderColor: '#FECACA' },
    text: { color: colors.error },
    pressed: '#FEE2E2',
  },
}

const SIZE_STYLES = {
  sm: { paddingVertical: 8, paddingHorizontal: 14, fontSize: fontSizes.sm },
  md: { paddingVertical: 12, paddingHorizontal: spacing.lg, fontSize: fontSizes.base },
  lg: { paddingVertical: 16, paddingHorizontal: spacing.xl, fontSize: fontSizes.md },
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}) {
  const v = VARIANT_STYLES[variant] || VARIANT_STYLES.primary
  const s = SIZE_STYLES[size] || SIZE_STYLES.md

  return (
    <TouchableOpacity
      style={[
        styles.base,
        v.button,
        { paddingVertical: s.paddingVertical, paddingHorizontal: s.paddingHorizontal },
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text.color} />
      ) : (
        <>
          {icon && <Icon name={icon} size="sm" color={v.text.color} />}
          <Text style={[styles.text, v.text, { fontSize: s.fontSize }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.45 },
  text: { fontWeight: fontWeights.bold },
})
