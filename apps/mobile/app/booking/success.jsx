import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'

export default function BookingSuccessScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.subtitle}>
          Your court has been reserved. You'll receive a confirmation notification shortly.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.primaryButtonText}>Back to Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace('/(tabs)/reservations')}
        >
          <Text style={styles.secondaryButtonText}>View Reservations</Text>
        </TouchableOpacity>
      </View>
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  checkMark: {
    fontSize: 36,
    color: '#16a34a',
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
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
    alignItems: 'center',
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
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
})
