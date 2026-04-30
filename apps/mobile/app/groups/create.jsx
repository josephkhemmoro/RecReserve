import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Switch, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { colors, spacing, borderRadius } from '../../theme'
import { Icon, Button } from '../../components/ui'

const SPORTS = [
  { value: 'pickleball', label: 'Pickleball' },
  { value: 'tennis', label: 'Tennis' },
]

const SKILLS = [
  { value: 'all', label: 'All Levels', color: colors.info },
  { value: 'beginner', label: 'Beginner', color: colors.success },
  { value: 'intermediate', label: 'Intermediate', color: colors.warning },
  { value: 'advanced', label: 'Advanced', color: colors.error },
]

const DAYS = [
  { value: 0, label: 'Sun' }, { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
]

const TIMES = Array.from({ length: 13 }, (_, i) => {
  const h = 7 + i
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return { value: `${String(h).padStart(2, '0')}:00`, label: `${h12}:00 ${ampm}` }
})

export default function CreateGroupScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sport, setSport] = useState('pickleball')
  const [skill, setSkill] = useState('all')
  const [day, setDay] = useState(null)
  const [time, setTime] = useState(null)
  const [maxMembers, setMaxMembers] = useState('12')
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)

  const canSubmit = name.trim().length >= 3

  const handleCreate = async () => {
    if (!user?.id || !selectedClub?.id) {
      Alert.alert('Not signed in', 'Please sign in and choose a club first.')
      return
    }
    if (!canSubmit) {
      Alert.alert('Name required', 'Group name must be at least 3 characters.')
      return
    }
    setSaving(true)
    try {
      const insert = {
        club_id: selectedClub.id,
        creator_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        sport,
        skill_level: skill,
        recurring_day: day,
        recurring_time: time,
        recurring_duration_mins: 60,
        max_members: maxMembers ? parseInt(maxMembers, 10) || null : null,
        is_public: isPublic,
        is_active: true,
      }
      const { data: group, error } = await supabase
        .from('play_groups')
        .insert(insert)
        .select('id')
        .single()
      if (error) throw error

      // Add creator as admin member
      await supabase.from('play_group_members').insert({
        group_id: group.id, user_id: user.id, role: 'admin', status: 'active',
      }).catch(() => {})

      router.replace(`/groups/${group.id}`)
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create group')
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Icon name="arrow-back" size="md" color={colors.primary} /></TouchableOpacity>
        <Text style={styles.title}>Create Play Group</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.label}>Group name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Tuesday Night Doubles"
            placeholderTextColor={colors.neutral400}
            maxLength={60}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What's this group about? Any rules, expectations, vibes?"
            placeholderTextColor={colors.neutral400}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Sport</Text>
          <View style={styles.chipRow}>
            {SPORTS.map((s) => (
              <TouchableOpacity key={s.value} style={[styles.chip, sport === s.value && styles.chipActive]} onPress={() => setSport(s.value)}>
                <Text style={[styles.chipText, sport === s.value && styles.chipTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Skill level</Text>
          <View style={styles.chipRow}>
            {SKILLS.map((s) => (
              <TouchableOpacity
                key={s.value}
                style={[styles.chip, skill === s.value && { backgroundColor: s.color + '20', borderColor: s.color }]}
                onPress={() => setSkill(s.value)}
              >
                <Text style={[styles.chipText, skill === s.value && { color: s.color, fontWeight: '700' }]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Recurring day (optional)</Text>
          <View style={styles.chipRow}>
            {DAYS.map((d) => (
              <TouchableOpacity key={d.value} style={[styles.chip, day === d.value && styles.chipActive]} onPress={() => setDay(day === d.value ? null : d.value)}>
                <Text style={[styles.chipText, day === d.value && styles.chipTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {day !== null && (
          <View style={styles.section}>
            <Text style={styles.label}>Time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeRow}>
              {TIMES.map((t) => (
                <TouchableOpacity key={t.value} style={[styles.chip, time === t.value && styles.chipActive]} onPress={() => setTime(time === t.value ? null : t.value)}>
                  <Text style={[styles.chipText, time === t.value && styles.chipTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Max members</Text>
          <TextInput
            style={[styles.input, { width: 100 }]}
            value={maxMembers}
            onChangeText={(v) => setMaxMembers(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="12"
            placeholderTextColor={colors.neutral400}
          />
        </View>

        <View style={[styles.section, styles.toggleRow]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Public group</Text>
            <Text style={styles.helpText}>{isPublic ? 'Anyone in the club can find and join' : 'Invite-only — members must be added by an admin'}</Text>
          </View>
          <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: colors.primary }} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={saving ? 'Creating…' : 'Create Group'}
          onPress={handleCreate}
          variant="primary"
          size="lg"
          disabled={saving || !canSubmit}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 70 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.base },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.neutral900, marginLeft: spacing.md, textAlign: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] + 80 },
  section: { marginBottom: spacing.lg },
  label: { fontSize: 14, fontWeight: '600', color: colors.neutral800, marginBottom: spacing.sm },
  helpText: { fontSize: 12, color: colors.neutral500, marginTop: 4 },
  input: { backgroundColor: colors.neutral50, borderWidth: 1, borderColor: colors.neutral100, borderRadius: borderRadius.md, padding: spacing.md, fontSize: 15, color: colors.neutral900 },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeRow: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.neutral50, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.neutral100 },
  chipActive: { backgroundColor: colors.primarySurface, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.neutral700, fontWeight: '600' },
  chipTextActive: { color: colors.primary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  footer: { padding: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.neutral100 },
})
