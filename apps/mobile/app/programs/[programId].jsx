import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { colors, spacing, borderRadius, fontSizes, fontWeights, layout } from '../../theme'
import { Icon, Badge } from '../../components/ui'

const TYPE_LABELS = { lesson_series: 'Lesson Series', clinic_series: 'Clinic Series', camp: 'Camp', academy: 'Academy', drop_in_series: 'Drop-In Series' }

export default function ProgramDetailScreen() {
  const { programId } = useLocalSearchParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const [program, setProgram] = useState(null)
  const [registrantCount, setRegistrantCount] = useState(0)
  const [isRegistered, setIsRegistered] = useState(false)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    if (!programId) return
    const load = async () => {
      try {
        const [progRes, countRes, regRes] = await Promise.all([
          supabase.from('programs').select('*, instructor:users!programs_instructor_id_fkey(full_name, avatar_url), court:courts(name)').eq('id', programId).single(),
          supabase.from('program_registrations').select('id', { count: 'exact', head: true }).eq('program_id', programId).eq('status', 'registered'),
          user?.id ? supabase.from('program_registrations').select('id').eq('program_id', programId).eq('user_id', user.id).eq('status', 'registered').limit(1) : Promise.resolve({ data: [] }),
        ])
        setProgram(progRes.data)
        setRegistrantCount(countRes.count || 0)
        setIsRegistered((regRes.data || []).length > 0)
      } catch (err) { console.error('Error:', err) }
      finally { setLoading(false) }
    }
    load()
  }, [programId, user?.id])

  const handleRegister = async () => {
    if (!user?.id || !program) return
    setRegistering(true)
    try {
      if (program.max_participants && registrantCount >= program.max_participants) {
        Alert.alert('Program Full', 'This program has reached capacity.')
        return
      }
      const { error } = await supabase.from('program_registrations').insert({
        program_id: program.id, user_id: user.id, status: 'registered', amount_paid: program.price || 0,
      })
      if (error) { if (error.code === '23505') Alert.alert('Already Registered'); else throw error }
      else { setIsRegistered(true); setRegistrantCount((c) => c + 1); Alert.alert('Registered!', 'You have been registered for this program.') }
    } catch (err) { Alert.alert('Error', err.message || 'Failed to register') }
    finally { setRegistering(false) }
  }

  const handleCancel = () => {
    Alert.alert('Cancel Registration', 'Are you sure?', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel', style: 'destructive', onPress: async () => {
        try {
          await supabase.from('program_registrations').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('program_id', program.id).eq('user_id', user.id)
          setIsRegistered(false); setRegistrantCount((c) => Math.max(0, c - 1))
        } catch (err) { Alert.alert('Error', 'Failed to cancel') }
      }},
    ])
  }

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
  if (!program) return <View style={styles.centered}><Text style={styles.errorText}>Program not found</Text></View>

  const typeLabel = TYPE_LABELS[program.program_type] || program.program_type
  const isFull = program.max_participants && registrantCount >= program.max_participants
  const startDate = new Date(program.start_date + 'T00:00:00')

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Icon name="arrow-back" size="md" color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <Badge label={typeLabel} variant="brand" />
          <Text style={styles.programTitle}>{program.title}</Text>

          {program.instructor?.full_name && (
            <View style={styles.infoRow}>
              <Icon name="person-outline" size="sm" color={colors.neutral500} />
              <Text style={styles.infoText}>Instructor: {program.instructor.full_name}</Text>
            </View>
          )}
          {program.court?.name && (
            <View style={styles.infoRow}>
              <Icon name="location-outline" size="sm" color={colors.neutral500} />
              <Text style={styles.infoText}>{program.court.name}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Icon name="calendar-outline" size="sm" color={colors.neutral500} />
            <Text style={styles.infoText}>{startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}{program.end_date ? ` - ${new Date(program.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : ''}</Text>
          </View>
          {program.start_time && (
            <View style={styles.infoRow}>
              <Icon name="time-outline" size="sm" color={colors.neutral500} />
              <Text style={styles.infoText}>{program.start_time} - {program.end_time}</Text>
            </View>
          )}
          {program.skill_level && (
            <View style={styles.infoRow}>
              <Icon name="fitness-outline" size="sm" color={colors.neutral500} />
              <Text style={styles.infoText}>Skill: {program.skill_level}</Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Icon name="people-outline" size="sm" color={colors.primary} />
              <Text style={styles.statText}>{registrantCount}{program.max_participants ? ` / ${program.max_participants}` : ''}</Text>
            </View>
            <View style={styles.statChip}>
              <Icon name="pricetag-outline" size="sm" color={colors.primary} />
              <Text style={styles.statText}>{program.price > 0 ? `$${program.price}` : 'Free'}</Text>
            </View>
            {program.member_price != null && program.member_price !== program.price && (
              <View style={styles.statChip}>
                <Text style={styles.statText}>Members: ${program.member_price}</Text>
              </View>
            )}
          </View>
        </View>

        {program.description && (
          <View style={styles.descCard}>
            <Text style={styles.descTitle}>About</Text>
            <Text style={styles.descText}>{program.description}</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        {isRegistered ? (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel Registration</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.registerButton, (isFull || registering) && styles.buttonDisabled]} onPress={handleRegister} disabled={isFull || registering}>
            {registering ? <ActivityIndicator color={colors.white} /> : (
              <Text style={styles.registerText}>{isFull ? 'Program Full' : program.price > 0 ? `Register · $${program.price}` : 'Register — Free'}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  errorText: { fontSize: 16, color: colors.neutral500 },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.base },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backText: { fontSize: fontSizes.base, color: colors.primary, fontWeight: fontWeights.semibold },
  heroCard: { marginHorizontal: spacing.lg, backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.neutral100, marginBottom: spacing.md },
  programTitle: { fontSize: 22, fontWeight: '700', color: colors.neutral900, marginVertical: spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  infoText: { fontSize: 14, color: colors.neutral600 },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.primarySurface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
  statText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  descCard: { marginHorizontal: spacing.lg, backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.neutral100 },
  descTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900, marginBottom: spacing.sm },
  descText: { fontSize: 14, color: colors.neutral600, lineHeight: 22 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.neutral100, paddingHorizontal: spacing.lg, paddingTop: spacing.base, paddingBottom: 34 },
  registerButton: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, padding: 18, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  registerText: { color: colors.white, fontSize: fontSizes.md, fontWeight: fontWeights.bold },
  cancelButton: { backgroundColor: colors.errorLight, borderRadius: borderRadius.lg, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: colors.error + '30' },
  cancelText: { color: colors.error, fontSize: fontSizes.md, fontWeight: fontWeights.bold },
})
