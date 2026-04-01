import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useOpenSpotsStore } from '../../store/openSpotsStore'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Icon, Button } from '../ui'

const SKILL_OPTIONS = [
  { value: 'any', label: 'All Levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

function formatDateTime(startTime, endTime) {
  const start = new Date(startTime)
  const end = new Date(endTime)
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const startStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${dateStr} · ${startStr} - ${endStr}`
}

export function CreateOpenSpotModal({ visible, reservation, userId, clubId, onClose, onCreated }) {
  const { createOpenSpot, isSending } = useOpenSpotsStore()
  const [spotsNeeded, setSpotsNeeded] = useState(1)
  const [skillLevel, setSkillLevel] = useState('any')
  const [description, setDescription] = useState('')

  const handlePost = async () => {
    const success = await createOpenSpot({ reservationId: reservation.id, userId, clubId, spotsNeeded, description: description.trim() || undefined, skillLevel })
    if (success) { setSpotsNeeded(1); setSkillLevel('any'); setDescription(''); onCreated() }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Find Players</Text>
            <TouchableOpacity onPress={onClose}><Icon name="close" size="md" color={colors.neutral500} /></TouchableOpacity>
          </View>

          <View style={styles.reservationInfo}>
            <View style={styles.infoRow}><Icon name="tennisball-outline" size="sm" color={colors.neutral500} /><Text style={styles.courtName}>{reservation.court_name}</Text></View>
            <View style={styles.infoRow}><Icon name="calendar-outline" size="sm" color={colors.neutral500} /><Text style={styles.dateTime}>{formatDateTime(reservation.start_time, reservation.end_time)}</Text></View>
          </View>

          <Text style={styles.label}>Players needed</Text>
          <View style={styles.chipRow}>
            {[1, 2, 3].map((n) => (
              <TouchableOpacity key={n} style={[styles.chip, spotsNeeded === n && styles.chipActive]} onPress={() => setSpotsNeeded(n)}>
                <Text style={[styles.chipText, spotsNeeded === n && styles.chipTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Skill level</Text>
          <View style={styles.chipRow}>
            {SKILL_OPTIONS.map((opt) => (
              <TouchableOpacity key={opt.value} style={[styles.chip, skillLevel === opt.value && styles.chipActive]} onPress={() => setSkillLevel(opt.value)}>
                <Text style={[styles.chipText, skillLevel === opt.value && styles.chipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Note (optional)</Text>
          <TextInput style={styles.input} placeholder="Looking for doubles partner..." placeholderTextColor={colors.neutral400} value={description} onChangeText={setDescription} maxLength={150} multiline />

          <Button title="Post Open Spot" onPress={handlePost} variant="primary" size="lg" fullWidth loading={isSending} disabled={isSending} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg, paddingBottom: spacing['3xl'] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base },
  title: { ...textStyles.heading3, color: colors.neutral900 },
  reservationInfo: { backgroundColor: colors.neutral50, borderRadius: borderRadius.lg, padding: spacing.base, marginBottom: spacing.lg, gap: spacing.xs },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  courtName: { ...textStyles.bodyMedium, color: colors.neutral800 },
  dateTime: { ...textStyles.bodySmall, color: colors.neutral600 },
  label: { ...textStyles.labelUpper, color: colors.neutral400, marginBottom: spacing.sm, marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.base, paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: colors.neutral50, borderWidth: 1.5, borderColor: colors.neutral200 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.label, color: colors.neutral600 },
  chipTextActive: { color: colors.white },
  input: { backgroundColor: colors.neutral50, borderWidth: 1, borderColor: colors.neutral200, borderRadius: borderRadius.md, padding: spacing.md, fontSize: 14, color: colors.neutral900, minHeight: 60, textAlignVertical: 'top', marginBottom: spacing.base },
})
