import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useClubStore } from '../../store/clubStore'
import { colors, textStyles, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Avatar, Button } from '../../components/ui'
import { TouchableOpacity } from 'react-native'

export default function PlayerProfileScreen() {
  const { userId } = useLocalSearchParams()
  const router = useRouter()
  const { selectedClub } = useClubStore()

  const [player, setPlayer] = useState(null)
  const [streak, setStreak] = useState(null)
  const [kudosCount, setKudosCount] = useState(0)
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId || !selectedClub?.id) return
    const load = async () => {
      try {
        const [userRes, streakRes, kudosRes, milestonesRes] = await Promise.all([
          supabase.from('users').select('id, full_name, avatar_url, created_at').eq('id', userId).single(),
          supabase.from('player_streaks').select('*').eq('user_id', userId).eq('club_id', selectedClub.id).single(),
          supabase.from('kudos').select('id', { count: 'exact', head: true }).eq('receiver_id', userId).eq('club_id', selectedClub.id),
          supabase.from('streak_milestones').select('*').eq('user_id', userId).eq('club_id', selectedClub.id).order('achieved_at', { ascending: false }),
        ])

        setPlayer(userRes.data)
        setStreak(streakRes.data)
        setKudosCount(kudosRes.count || 0)
        setMilestones(milestonesRes.data || [])
      } catch (err) {
        console.error('Error loading player:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId, selectedClub?.id])

  const MILESTONE_LABELS = { 4: '1 Month Strong', 8: '2 Month Warrior', 12: 'Quarter Master', 26: 'Half-Year Hero', 52: 'Year-Round Legend' }
  const MILESTONE_ICONS = { 4: '\uD83D\uDD25', 8: '\u26A1', 12: '\uD83C\uDFC6', 26: '\uD83D\uDC51', 52: '\uD83C\uDFBE' }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  if (!player) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Player not found</Text>
        <Button title="Go Back" onPress={() => router.back()} variant="primary" size="md" />
      </View>
    )
  }

  const memberSince = new Date(player.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size="md" color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Player Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Avatar uri={player.avatar_url} name={player.full_name} size="lg" />
          <Text style={styles.playerName}>{player.full_name}</Text>
          <Text style={styles.memberSince}>Member since {memberSince}</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{streak?.current_streak ?? 0}</Text>
            <Text style={styles.statLabel}>Week Streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{streak?.longest_streak ?? 0}</Text>
            <Text style={styles.statLabel}>Best Streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{kudosCount}</Text>
            <Text style={styles.statLabel}>Kudos</Text>
          </View>
        </View>

        {/* Milestones */}
        {milestones.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            {milestones.map((m) => (
              <View key={m.id} style={styles.milestoneRow}>
                <Text style={styles.milestoneIcon}>{MILESTONE_ICONS[m.milestone] || '\uD83C\uDFC5'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.milestoneName}>{MILESTONE_LABELS[m.milestone] || `${m.milestone} weeks`}</Text>
                  <Text style={styles.milestoneDate}>{new Date(m.achieved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 70 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.neutral900 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  profileCard: { alignItems: 'center', marginBottom: spacing.xl },
  playerName: { fontSize: 22, fontWeight: '700', color: colors.neutral900, marginTop: spacing.md },
  memberSince: { fontSize: 13, color: colors.neutral500, marginTop: spacing.xs },
  errorText: { fontSize: 16, color: colors.neutral500 },
  statsRow: {
    flexDirection: 'row', backgroundColor: colors.neutral50, borderRadius: borderRadius.lg,
    padding: spacing.base, marginBottom: spacing.xl,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.neutral900 },
  statLabel: { fontSize: 12, color: colors.neutral500, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.neutral200, marginVertical: spacing.xs },
  section: { marginBottom: spacing.xl },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900, marginBottom: spacing.md },
  milestoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.neutral50, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  milestoneIcon: { fontSize: 24 },
  milestoneName: { fontSize: 14, fontWeight: '600', color: colors.neutral900 },
  milestoneDate: { fontSize: 12, color: colors.neutral500, marginTop: 2 },
})
