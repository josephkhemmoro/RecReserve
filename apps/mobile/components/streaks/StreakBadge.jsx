import { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'

export function StreakBadge({ streak, size = 'medium' }) {
  const scaleAnim = useRef(new Animated.Value(streak > 0 ? 0.85 : 1)).current

  useEffect(() => {
    if (streak > 0) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 160,
        useNativeDriver: true,
      }).start()
    }
  }, [streak])

  if (streak === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.zeroText, size === 'small' && styles.zeroTextSmall]}>
          Start a streak!
        </Text>
      </View>
    )
  }

  const isSmall = size === 'small'
  const flameSize = isSmall ? 14 : 18
  const numberSize = isSmall ? 14 : 18

  let flameColor = '#FF6B35'
  let numberColor = '#FF6B35'
  let prefix = ''

  if (streak >= 26) {
    flameColor = '#FFD700'
    numberColor = '#FFD700'
    prefix = '👑 '
  } else if (streak >= 12) {
    flameColor = '#FFD700'
    numberColor = '#D4A017'
  } else if (streak >= 4) {
    flameColor = '#FF6B35'
    numberColor = '#E55A2B'
  }

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      {prefix ? <Text style={{ fontSize: flameSize }}>{prefix}</Text> : null}
      <Text style={{ fontSize: flameSize }}>🔥</Text>
      <Text
        style={[
          styles.number,
          { fontSize: numberSize, color: numberColor },
          streak >= 4 && styles.numberBold,
        ]}
      >
        {streak}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  number: {
    fontWeight: '600',
  },
  numberBold: {
    fontWeight: '700',
  },
  zeroText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  zeroTextSmall: {
    fontSize: 12,
  },
})
