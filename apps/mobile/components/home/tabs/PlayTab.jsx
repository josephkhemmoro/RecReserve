import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { colors, spacing, borderRadius } from '../../../theme'
import { Icon, Button } from '../../ui'

const FORMAT_LABELS = { singles: 'Singles', doubles: 'Doubles', mixed_doubles: 'Mixed', social: 'Social', round_robin: 'Round Robin' }

export function PlayTab({ clubId }) {
  const router = useRouter()
  const { user } = useAuthStore()
  const [games, setGames] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clubId) return
    const load = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const [gamesRes, groupsRes] = await Promise.all([
          supabase.from('open_games')
            .select('id, title, sport, format, skill_level, date, start_time, max_players, creator:users!open_games_creator_id_fkey(full_name)')
            .eq('club_id', clubId).eq('status', 'open').gte('date', today)
            .order('date').order('start_time').limit(5),
          user?.id
            ? supabase.from('play_group_members')
                .select('group_id, group:play_groups!inner(id, name, sport, recurring_day, recurring_time)')
                .eq('user_id', user.id).eq('status', 'active').limit(3)
            : Promise.resolve({ data: [] }),
        ])
        const gameIds = (gamesRes.data || []).map((g) => g.id)
        let countMap = {}
        if (gameIds.length > 0) {
          const { data: parts } = await supabase.from('game_participants').select('game_id').in('game_id', gameIds).eq('status', 'joined')
          for (const p of parts || []) countMap[p.game_id] = (countMap[p.game_id] || 0) + 1
        }
        setGames((gamesRes.data || []).map((g) => ({ ...g, joined_count: (countMap[g.id] || 0) + 1 })))
        setGroups((groupsRes.data || []).map((gm) => gm.group).filter(Boolean))
      } catch (err) { console.error('Error loading play tab:', err) }
      finally { setLoading(false) }
    }
    load()
  }, [clubId, user?.id])

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const formatDate = (d) => {
    const date = new Date(d + 'T00:00:00')
    const now = new Date()
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
    if (date.toDateString() === now.toDateString()) return 'Today'
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  const formatTime = (t) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` }

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>

  return (
    <View style={styles.container}>
      <View style={styles.quickActions}>
        {[
          { label: 'Create Game', icon: 'add-circle-outline', bg: colors.primarySurface, color: colors.primary, route: '/games/create' },
          { label: 'Open Games', icon: 'tennisball-outline', bg: colors.accentMuted, color: colors.accent, route: '/games' },
          { label: 'Open Spots', icon: 'hand-left-outline', bg: colors.warningLight, color: colors.warning, route: '/open-spots' },
          { label: 'Groups', icon: 'people-outline', bg: colors.successLight, color: colors.success, route: '/groups' },
        ].map((a) => (
          <TouchableOpacity key={a.label} style={styles.actionCard} onPress={() => router.push(a.route)}>
            <View style={[styles.actionIcon, { backgroundColor: a.bg }]}><Icon name={a.icon} size="md" color={a.color} /></View>
            <Text style={styles.actionLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {games.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Games Needing Players</Text>
            <TouchableOpacity onPress={() => router.push('/games')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
          </View>
          {games.map((game) => {
            const spotsLeft = game.max_players - (game.joined_count || 1)
            return (
              <TouchableOpacity key={game.id} style={styles.gameCard} onPress={() => router.push(`/games/${game.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gameTitle}>{game.title || `${FORMAT_LABELS[game.format] || game.format} — ${game.sport}`}</Text>
                  <Text style={styles.gameMeta}>{formatDate(game.date)} · {formatTime(game.start_time)} · {game.skill_level}</Text>
                </View>
                {spotsLeft > 0 && <View style={styles.spotsBadge}><Text style={styles.spotsText}>{spotsLeft} left</Text></View>}
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {groups.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Groups</Text>
            <TouchableOpacity onPress={() => router.push('/groups')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
          </View>
          {groups.map((group) => (
            <TouchableOpacity key={group.id} style={styles.groupCard} onPress={() => router.push(`/groups/${group.id}`)}>
              <Icon name="people" size="md" color={colors.primary} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.groupName}>{group.name}</Text>
                {group.recurring_day != null && <Text style={styles.groupMeta}>{DAY_LABELS[group.recurring_day]}s{group.recurring_time ? ` at ${group.recurring_time}` : ''}</Text>}
              </View>
              <Icon name="chevron-forward" size="sm" color={colors.neutral300} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {games.length === 0 && groups.length === 0 && (
        <View style={styles.emptyState}>
          <Icon name="tennisball-outline" size="lg" color={colors.neutral300} />
          <Text style={styles.emptyTitle}>No games yet</Text>
          <Text style={styles.emptySub}>Create an open game or join a group to find partners</Text>
          <Button title="Create a Game" onPress={() => router.push('/games/create')} variant="primary" size="md" icon="add-outline" />
        </View>
      )}
      <View style={{ height: 100 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  loading: { paddingVertical: 60, alignItems: 'center' },
  quickActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  actionCard: { flex: 1, alignItems: 'center', gap: spacing.sm },
  actionIcon: { width: 48, height: 48, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '600', color: colors.neutral600, textAlign: 'center' },
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900 },
  seeAll: { fontSize: 13, fontWeight: '600', color: colors.primary },
  gameCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.neutral50, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm },
  gameTitle: { fontSize: 14, fontWeight: '700', color: colors.neutral900 },
  gameMeta: { fontSize: 12, color: colors.neutral500, marginTop: 2 },
  spotsBadge: { backgroundColor: colors.accent + '20', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm },
  spotsText: { fontSize: 11, fontWeight: '700', color: colors.accent },
  groupCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.neutral50, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm },
  groupName: { fontSize: 14, fontWeight: '700', color: colors.neutral900 },
  groupMeta: { fontSize: 12, color: colors.neutral500, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.neutral900 },
  emptySub: { fontSize: 13, color: colors.neutral400, textAlign: 'center', paddingHorizontal: spacing.xl },
})
