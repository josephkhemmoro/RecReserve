import { useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { colors, spacing, borderRadius, fontSizes, fontWeights, layout } from '../../theme'

export default function BookingSuccessScreen() {
  const router = useRouter()
  const scaleAnim = useRef(new Animated.Value(0)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const checkScale = useRef(new Animated.Value(0)).current
  const buttonsOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Sequence: circle scales up → check pops → text fades → buttons fade
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(checkScale, {
        toValue: 1,
        tension: 100,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(buttonsOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Animated checkmark circle */}
        <Animated.View
          style={[
            styles.checkCircle,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: checkScale }] }}>
            <Ionicons name="checkmark" size={48} color={colors.success} />
          </Animated.View>
        </Animated.View>

        {/* Text */}
        <Animated.View style={[styles.textBlock, { opacity: opacityAnim }]}>
          <Text style={styles.title}>Booking Confirmed!</Text>
          <Text style={styles.subtitle}>
            Your court has been reserved. You'll receive a confirmation notification shortly.
          </Text>
        </Animated.View>
      </View>

      {/* Buttons */}
      <Animated.View style={[styles.footer, { opacity: buttonsOpacity }]}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace('/(tabs)/reservations')}
        >
          <Ionicons name="calendar" size={18} color={colors.white} />
          <Text style={styles.primaryButtonText}>View My Reservations</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Ionicons name="tennisball-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>Book Another Court</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
    paddingTop: 80,
    paddingBottom: spacing['3xl'],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  textBlock: { alignItems: 'center' },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.neutral900,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: fontSizes.base,
    color: colors.neutral500,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },
  footer: {
    gap: layout.itemGap,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: borderRadius.lg,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
  },
})
