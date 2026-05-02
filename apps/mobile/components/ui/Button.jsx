import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { colors, fontSizes, fontWeights, spacing, borderRadius, shadows } from '../../theme'
import { Icon } from './Icon'
import { haptic } from '../../lib/haptics'

const SPRING_CONFIG = { damping: 12, stiffness: 200, mass: 0.8 }

const VARIANT_STYLES = {
  primary: {
    button: { backgroundColor: colors.primary, ...shadows.sm },
    text: { color: colors.white },
  },
  accent: {
    button: { backgroundColor: colors.accent, ...shadows.sm },
    text: { color: colors.white },
  },
  secondary: {
    button: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.primary },
    text: { color: colors.primary },
  },
  ghost: {
    button: { backgroundColor: 'transparent' },
    text: { color: colors.primary },
  },
  danger: {
    button: { backgroundColor: colors.errorLight, borderWidth: 1, borderColor: '#FECACA' },
    text: { color: colors.error },
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
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = () => {
    scale.value = withTiming(0.94, { duration: 80 })
  }

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG)
  }

  const handlePress = () => {
    haptic.light()
    onPress?.()
  }

  return (
    <Animated.View style={[animatedStyle, fullWidth && styles.fullWidth, style]}>
      <Pressable
        style={[
          styles.base,
          v.button,
          { paddingVertical: s.paddingVertical, paddingHorizontal: s.paddingHorizontal },
          fullWidth && styles.fullWidth,
          (disabled || loading) && styles.disabled,
        ]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={v.text.color} />
        ) : (
          <>
            {icon && <Icon name={icon} size="sm" color={v.text.color} />}
            <Text style={[styles.text, v.text, { fontSize: s.fontSize }]}>{title}</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
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
