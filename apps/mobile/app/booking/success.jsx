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
            <Ionicons name="checkmark" size={48} color="#15803d" />
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
          <Ionicons name="calendar" size={18} color="#ffffff" />
          <Text style={styles.primaryButtonText}>View My Reservations</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Ionicons name="tennisball-outline" size={18} color="#2563eb" />
          <Text style={styles.secondaryButtonText}>Book Another Court</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
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
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  textBlock: { alignItems: 'center' },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  footer: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
})
