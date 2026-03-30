import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useOpenSpotsStore } from '../../store/openSpotsStore'

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
    const success = await createOpenSpot({
      reservationId: reservation.id,
      userId,
      clubId,
      spotsNeeded,
      description: description.trim() || undefined,
      skillLevel,
    })
    if (success) {
      setSpotsNeeded(1)
      setSkillLevel('any')
      setDescription('')
      onCreated()
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Find Players 🤝</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.reservationInfo}>
            <Text style={styles.courtName}>
              🎾 {reservation.court_name}
            </Text>
            <Text style={styles.dateTime}>
              📅 {formatDateTime(reservation.start_time, reservation.end_time)}
            </Text>
          </View>

          <Text style={styles.label}>Players needed</Text>
          <View style={styles.chipRow}>
            {[1, 2, 3].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.chip, spotsNeeded === n && styles.chipActive]}
                onPress={() => setSpotsNeeded(n)}
              >
                <Text style={[styles.chipText, spotsNeeded === n && styles.chipTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Skill level</Text>
          <View style={styles.chipRow}>
            {SKILL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, skillLevel === opt.value && styles.chipActive]}
                onPress={() => setSkillLevel(opt.value)}
              >
                <Text style={[styles.chipText, skillLevel === opt.value && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Looking for doubles partner..."
            placeholderTextColor="#9ca3af"
            value={description}
            onChangeText={setDescription}
            maxLength={150}
            multiline
          />

          <TouchableOpacity
            style={[styles.postButton, isSending && styles.buttonDisabled]}
            onPress={handlePost}
            disabled={isSending}
          >
            {isSending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.postButtonText}>Post Open Spot</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  reservationInfo: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 4,
  },
  courtName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  dateTime: { fontSize: 14, color: '#64748b' },
  label: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 8, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#ffffff' },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1e293b',
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  postButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  postButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
})
