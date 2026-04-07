import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { colors, spacing, borderRadius, fontSizes, fontWeights, layout } from '../../theme'
import { Icon, Button } from '../../components/ui'
import { useAnalyticsStore } from '../../store/analyticsStore'

const FORMATS = [
  { value: 'doubles', label: 'Doubles', icon: 'people-outline', players: 4 },
  { value: 'singles', label: 'Singles', icon: 'person-outline', players: 2 },
  { value: 'mixed_doubles', label: 'Mixed', icon: 'people-outline', players: 4 },
  { value: 'social', label: 'Social', icon: 'happy-outline', players: 8 },
  { value: 'round_robin', label: 'Round Robin', icon: 'sync-outline', players: 8 },
]
const SKILLS = [
  { value: 'all', label: 'All Levels', color: colors.info },
  { value: 'beginner', label: 'Beginner', color: colors.success },
  { value: 'intermediate', label: 'Intermediate', color: colors.warning },
  { value: 'advanced', label: 'Advanced', color: colors.error },
]
const SPORTS = [
  { value: 'pickleball', label: 'Pickleball' },
  { value: 'tennis', label: 'Tennis' },
]

export default function CreateGameScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const [sport, setSport] = useState('pickleball')
  const [format, setFormat] = useState('doubles')
  const [skill, setSkill] = useState('all')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [saving, setSaving] = useState(false)

  // Generate next 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i)
    return { date: d.toISOString().split('T')[0], label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }
  })

  // Time slots
  const times = Array.from({ length: 13 }, (_, i) => {
    const h = 7 + i; const ampm = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 || 12
    return { value: `${String(h).padStart(2, '0')}:00`, label: `${h12}:00 ${ampm}` }
  })

  const selectedFormat = FORMATS.find((f) => f.value === format)

  const handleCreate = async () => {
    if (!user?.id || !selectedClub?.id || !date || !startTime) {
      Alert.alert('Missing Info', 'Please select a date and time.')
      return
    }
    setSaving(true)
    try {
      const endH = parseInt(startTime.split(':')[0]) + 1
      const endTime = `${String(endH).padStart(2, '0')}:00`

      const { data: game, error } = await supabase.from('open_games').insert({
        creator_id: user.id, club_id: selectedClub.id, sport, format, skill_level: skill,
        date, start_time: startTime, end_time: endTime,
        players_needed: (selectedFormat?.players || 4) - 1,
        max_players: selectedFormat?.players || 4,
        status: 'open',
      }).select('id').single()

      if (error) throw error

      // Create feed event
      await supabase.from('feed_events').insert({
        club_id: selectedClub.id, actor_id: user.id,
        event_type: 'open_game_created',
        metadata: { game_id: game.id, sport, format, skill_level: skill, date },
      }).catch(() => {})

      useAnalyticsStore.getState().trackGameCreated(user.id, selectedClub.id, game.id, format, sport)
      router.replace('/games')
    } catch (err) { Alert.alert('Error', err.message || 'Failed to create game') }
    finally { setSaving(false) }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Icon name="arrow-back" size="md" color={colors.primary} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Create a Game</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Sport */}
        <Text style={styles.sectionLabel}>Sport</Text>
        <View style={styles.chipRow}>
          {SPORTS.map((s) => (
            <TouchableOpacity key={s.value} style={[styles.selectChip, sport === s.value && styles.selectChipActive]} onPress={() => setSport(s.value)}>
              <Text style={[styles.selectChipText, sport === s.value && styles.selectChipTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Format */}
        <Text style={styles.sectionLabel}>Format</Text>
        <View style={styles.chipRow}>
          {FORMATS.map((f) => (
            <TouchableOpacity key={f.value} style={[styles.selectChip, format === f.value && styles.selectChipActive]} onPress={() => setFormat(f.value)}>
              <Icon name={f.icon} size="sm" color={format === f.value ? colors.white : colors.neutral600} />
              <Text style={[styles.selectChipText, format === f.value && styles.selectChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Skill Level */}
        <Text style={styles.sectionLabel}>Skill Level</Text>
        <View style={styles.chipRow}>
          {SKILLS.map((s) => (
            <TouchableOpacity key={s.value} style={[styles.selectChip, skill === s.value && { backgroundColor: s.color, borderColor: s.color }]} onPress={() => setSkill(s.value)}>
              <Text style={[styles.selectChipText, skill === s.value && { color: colors.white }]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date */}
        <Text style={styles.sectionLabel}>Date</Text>
        <View style={styles.chipRow}>
          {days.map((d) => (
            <TouchableOpacity key={d.date} style={[styles.dateChip, date === d.date && styles.dateChipActive]} onPress={() => setDate(d.date)}>
              <Text style={[styles.dateChipText, date === d.date && styles.dateChipTextActive]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Time */}
        <Text style={styles.sectionLabel}>Time</Text>
        <View style={styles.chipRow}>
          {times.map((t) => (
            <TouchableOpacity key={t.value} style={[styles.timeChip, startTime === t.value && styles.timeChipActive]} onPress={() => setStartTime(t.value)}>
              <Text style={[styles.timeChipText, startTime === t.value && styles.timeChipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.createButton, (!date || !startTime || saving) && { opacity: 0.6 }]} onPress={handleCreate} disabled={!date || !startTime || saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : (
            <Text style={styles.createText}>Post Game · {selectedFormat?.players || 4} players</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.neutral900 },
  content: { paddingHorizontal: spacing.lg },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.neutral400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md, marginTop: spacing.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  selectChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.base, paddingVertical: spacing.md, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.neutral200, backgroundColor: colors.white },
  selectChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectChipText: { fontSize: 14, fontWeight: '600', color: colors.neutral600 },
  selectChipTextActive: { color: colors.white },
  dateChip: { paddingHorizontal: spacing.base, paddingVertical: spacing.md, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.neutral200 },
  dateChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dateChipText: { fontSize: 13, fontWeight: '600', color: colors.neutral600 },
  dateChipTextActive: { color: colors.white },
  timeChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.neutral200 },
  timeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  timeChipText: { fontSize: 13, fontWeight: '600', color: colors.neutral600 },
  timeChipTextActive: { color: colors.white },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.neutral100, paddingHorizontal: layout.screenPaddingH, paddingTop: spacing.base, paddingBottom: 34 },
  createButton: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, padding: 18, alignItems: 'center' },
  createText: { color: colors.white, fontSize: fontSizes.md, fontWeight: fontWeights.bold },
})
