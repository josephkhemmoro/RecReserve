import { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { colors, textStyles, spacing } from '../../theme'
import { Icon } from '../ui'

export function StreakBadge({ streak, size = 'medium' }) {
  const scaleAnim = useRef(new Animated.Value(streak > 0 ? 0.85 : 1)).current

  useEffect(() => {
    if (streak > 0) {
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start()
    }
  }, [streak])

  if (streak === 0) {
    return <View style={styles.container}><Text style={[styles.zeroText, size === 'small' && styles.zeroTextSmall]}>Start a streak!</Text></View>
  }

  const isSmall = size === 'small'
  let iconColor = colors.streak
  if (streak >= 26) iconColor = colors.accent
  else if (streak >= 12) iconColor = colors.streak

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      {streak >= 26 && <Icon name="trophy" size={isSmall ? 'sm' : 'md'} color={colors.accent} />}
      <Icon name="flame" size={isSmall ? 'sm' : 'md'} color={iconColor} />
      <Text style={[styles.number, { color: iconColor, fontSize: isSmall ? 14 : 18 }, streak >= 4 && styles.numberBold]}>{streak}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  number: { fontWeight: '600' },
  numberBold: { fontWeight: '700' },
  zeroText: { ...textStyles.bodySmall, color: colors.neutral400 },
  zeroTextSmall: { fontSize: 12 },
})
