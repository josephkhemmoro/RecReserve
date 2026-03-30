import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { KudosPlayerPicker } from './KudosPlayerPicker'
import { useAuthStore } from '../../store/authStore'

export function KudosPrompt({ reservationId, clubId, onDismiss }) {
  const { user } = useAuthStore()
  const [showPicker, setShowPicker] = useState(false)
  const [sent, setSent] = useState(false)

  if (sent) {
    // Brief confirmation — auto-dismiss after 2 seconds
    setTimeout(onDismiss, 2000)
    return (
      <View style={[styles.card, styles.cardSent]}>
        <Text style={styles.sentText}>Kudos sent! ✅</Text>
      </View>
    )
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.content}>
          <Text style={styles.title}>How was your match? 🎾</Text>
          <Text style={styles.subtitle}>Send kudos to a fellow player</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.sendButton}
            onPress={() => setShowPicker(true)}
          >
            <Text style={styles.sendButtonText}>Send Kudos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KudosPlayerPicker
        visible={showPicker}
        clubId={clubId}
        reservationId={reservationId}
        senderId={user?.id}
        onClose={() => setShowPicker(false)}
        onKudosSent={() => {
          setShowPicker(false)
          setSent(true)
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 138, 101, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 101, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSent: {
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
    borderColor: 'rgba(76, 175, 80, 0.2)',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sendButton: {
    backgroundColor: '#FF8A65',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  dismissButton: {
    padding: 4,
  },
  dismissText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
  },
  sentText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4CAF50',
    textAlign: 'center',
    flex: 1,
  },
})
