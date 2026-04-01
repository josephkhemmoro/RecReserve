import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { KudosPlayerPicker } from './KudosPlayerPicker'
import { useAuthStore } from '../../store/authStore'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Icon } from '../ui'

export function KudosPrompt({ reservationId, clubId, onDismiss }) {
  const { user } = useAuthStore()
  const [showPicker, setShowPicker] = useState(false)
  const [sent, setSent] = useState(false)

  if (sent) {
    setTimeout(onDismiss, 2000)
    return (
      <View style={[styles.card, styles.cardSent]}>
        <Icon name="checkmark-circle" size="sm" color={colors.success} />
        <Text style={styles.sentText}>Kudos sent!</Text>
      </View>
    )
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.content}>
          <Text style={styles.title}>How was your match?</Text>
          <Text style={styles.subtitle}>Send kudos to a fellow player</Text>
        </View>
        <TouchableOpacity style={styles.sendButton} onPress={() => setShowPicker(true)}>
          <Icon name="heart-outline" size="sm" color={colors.white} />
          <Text style={styles.sendButtonText}>Send Kudos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
          <Icon name="close" size="sm" color={colors.neutral400} />
        </TouchableOpacity>
      </View>
      <KudosPlayerPicker visible={showPicker} clubId={clubId} reservationId={reservationId} senderId={user?.id} onClose={() => setShowPicker(false)} onKudosSent={() => { setShowPicker(false); setSent(true) }} />
    </>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.kudosLight, borderRadius: borderRadius.lg, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: `${colors.kudos}30`,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cardSent: { backgroundColor: colors.successLight, borderColor: `${colors.success}30`, justifyContent: 'center', gap: spacing.sm },
  content: { flex: 1, marginRight: spacing.md },
  title: { ...textStyles.bodyMedium, color: colors.neutral900 },
  subtitle: { ...textStyles.caption, color: colors.neutral500 },
  sendButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.kudos, borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sendButtonText: { ...textStyles.buttonSmall, color: colors.white },
  dismissBtn: { padding: spacing.xs, marginLeft: spacing.sm },
  sentText: { ...textStyles.bodyMedium, color: colors.success },
})
