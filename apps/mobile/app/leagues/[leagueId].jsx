import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { useMembershipStore } from '../../store/membershipStore'
import { colors, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Avatar, Badge, Button } from '../../components/ui'

const FORMAT_LABELS = { ladder: 'Ladder', round_robin: 'Round Robin', league: 'League', knockout: 'Knockout' }
const FORMAT_ICONS = { ladder: 'trending-up-outline', round_robin: 'sync-outline', league: 'trophy-outline', knockout: 'flash-outline' }
const STATUS_LABELS = {
  draft: 'Draft', registration_open: 'Registration Open', in_progress: 'In Progress',
  completed: 'Completed', cancelled: 'Cancelled',
}
const STATUS_COLORS = { draft: colors.neutral400, registration_open: colors.primary, in_progress: colors.success, completed: colors.neutral500, cancelled: colors.error }
const TABS = ['Overview', 'Players', 'Standings', 'Matches']

function formatDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function LeagueDetailScreen() {
  const { leagueId } = useLocalSearchParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const tier = useMembershipStore((s) => s.tier)

  const [league, setLeague] = useState(null)
  const [players, setPlayers] = useState([])
  const [standings, setStandings] = useState([])
  const [matches, setMatches] = useState([])
  const [tab, setTab] = useState('Overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)

  const fetchData = useCallback(async () => {
    if (!leagueId) return
    try {
      const [leagueRes, playersRes, standingsRes, matchesRes] = await Promise.all([
        supabase.from('leagues').select('*').eq('id', leagueId).single(),
        supabase
          .from('league_players')
          .select('id, status, seed, joined_at, user:users(id, full_name, avatar_url)')
          .eq('league_id', leagueId)
          .order('seed', { ascending: true, nullsFirst: false }),
        supabase
          .from('league_standings')
          .select('id, rank, wins, losses, draws, points, matches_played, user:users(id, full_name, avatar_url)')
          .eq('league_id', leagueId)
          .order('rank', { ascending: true, nullsFirst: false }),
        supabase
          .from('league_matches')
          .select('id, round, scheduled_at, status, player1_score, player2_score, winner_id, player1:users!league_matches_player1_id_fkey(id, full_name, avatar_url), player2:users!league_matches_player2_id_fkey(id, full_name, avatar_url)')
          .eq('league_id', leagueId)
          .order('round', { ascending: true })
          .order('scheduled_at', { ascending: true })
          .limit(50),
      ])

      if (leagueRes.error) throw leagueRes.error
      setLeague(leagueRes.data)
      setPlayers(playersRes.data || [])
      setStandings(standingsRes.data || [])
      setMatches(matchesRes.data || [])
    } catch (err) {
      console.error('Failed to load league:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [leagueId])

  useEffect(() => { fetchData() }, [fetchData])

  const myEntry = players.find((p) => p.user?.id === user?.id && p.status === 'active')
  const isRegistered = !!myEntry
  const activeCount = players.filter((p) => p.status === 'active').length
  const isFull = league?.max_players && activeCount >= league.max_players
  const canRegister = league?.status === 'registration_open' && !isRegistered && !isFull

  // Pricing — member discount if tier covers it
  const isMember = !!tier?.id
  const entryFee = Number(league?.entry_fee || 0)
  const memberFee = league?.member_entry_fee != null ? Number(league.member_entry_fee) : entryFee
  const yourPrice = isMember ? memberFee : entryFee
  const isFree = yourPrice <= 0

  const handleRegister = async () => {
    if (!user?.id || !league) return
    if (!isFree) {
      Alert.alert(
        'Payment required',
        `This league has a $${yourPrice.toFixed(2)} entry fee. League payment is not yet supported in the app — contact your club admin to register.`,
      )
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase
        .from('league_players')
        .insert({ league_id: league.id, user_id: user.id, status: 'active', amount_paid: 0 })
      if (error) {
        if (error.code === '23505') Alert.alert('Already Registered', "You're already in this league.")
        else throw error
      } else {
        await fetchData()
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to register')
    } finally {
      setBusy(false)
    }
  }

  const handleWithdraw = () => {
    Alert.alert('Withdraw from league?', 'You may not be able to rejoin once the league is in progress.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw', style: 'destructive', onPress: async () => {
          setBusy(true)
          try {
            const { error } = await supabase
              .from('league_players')
              .update({ status: 'withdrawn' })
              .eq('id', myEntry.id)
            if (error) throw error
            await fetchData()
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to withdraw')
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  if (!league) {
    return (
      <View style={styles.centered}>
        <Icon name="alert-circle-outline" size="lg" color={colors.neutral400} />
        <Text style={styles.emptyTitle}>League not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const formatLabel = FORMAT_LABELS[league.format] || league.format
  const statusColor = STATUS_COLORS[league.status] || colors.neutral500

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Icon name="arrow-back" size="md" color={colors.primary} /></TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{league.name}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData() }} tintColor={colors.primary} />}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={[styles.formatIcon, { backgroundColor: colors.primarySurface }]}>
              <Icon name={FORMAT_ICONS[league.format] || 'trophy-outline'} size="md" color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.leagueName}>{league.name}</Text>
              <Text style={styles.leagueMeta}>{formatLabel}{league.sport ? ` · ${league.sport}` : ''}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABELS[league.status]}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}><Icon name="calendar-outline" size="sm" color={colors.neutral500} /><Text style={styles.detailText}>{formatDate(league.start_date)}{league.end_date ? ` – ${formatDate(league.end_date)}` : ''}</Text></View>
          <View style={styles.detailRow}><Icon name="people-outline" size="sm" color={colors.neutral500} /><Text style={styles.detailText}>{activeCount}{league.max_players ? `/${league.max_players}` : ''} players</Text></View>
          {league.skill_level && <View style={styles.detailRow}><Icon name="trending-up-outline" size="sm" color={colors.neutral500} /><Text style={styles.detailText}>{league.skill_level === 'all' ? 'All skill levels' : `${league.skill_level} level`}</Text></View>}
          <View style={styles.detailRow}>
            <Icon name="cash-outline" size="sm" color={colors.neutral500} />
            <Text style={styles.detailText}>
              {entryFee > 0 ? `$${entryFee.toFixed(2)} entry` : 'Free entry'}
              {isMember && memberFee !== entryFee ? ` · $${memberFee.toFixed(2)} for members` : ''}
            </Text>
          </View>
          <View style={styles.detailRow}><Icon name="trophy-outline" size="sm" color={colors.neutral500} /><Text style={styles.detailText}>Win {league.points_for_win} pts · Draw {league.points_for_draw} pts · Loss {league.points_for_loss} pts</Text></View>
        </View>

        <View style={styles.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'Overview' && (
          <View style={styles.section}>
            {league.description ? <Text style={styles.descText}>{league.description}</Text> : <Text style={styles.muted}>No description provided.</Text>}
          </View>
        )}

        {tab === 'Players' && (
          <View style={styles.section}>
            {players.filter((p) => p.status === 'active').length === 0 ? (
              <Text style={styles.muted}>No registered players yet.</Text>
            ) : (
              players.filter((p) => p.status === 'active').map((p) => (
                <View key={p.id} style={styles.playerRow}>
                  {p.seed != null && <Text style={styles.seed}>#{p.seed}</Text>}
                  <Avatar uri={p.user?.avatar_url} name={p.user?.full_name || '?'} size="sm" />
                  <Text style={styles.playerName}>{p.user?.full_name}{p.user?.id === user?.id ? ' (you)' : ''}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'Standings' && (
          <View style={styles.section}>
            {standings.length === 0 ? (
              <Text style={styles.muted}>Standings will appear once matches are played.</Text>
            ) : (
              <>
                <View style={styles.standingsHeader}>
                  <Text style={[styles.standingsCol, { flex: 0, width: 32 }]}>#</Text>
                  <Text style={[styles.standingsCol, { flex: 1 }]}>Player</Text>
                  <Text style={styles.standingsCol}>W</Text>
                  <Text style={styles.standingsCol}>L</Text>
                  <Text style={styles.standingsCol}>D</Text>
                  <Text style={[styles.standingsCol, { fontWeight: '700' }]}>Pts</Text>
                </View>
                {standings.map((s) => (
                  <View key={s.id} style={styles.playerRow}>
                    <Text style={[styles.standingsCol, { flex: 0, width: 32, fontWeight: '700' }]}>{s.rank ?? '-'}</Text>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Avatar uri={s.user?.avatar_url} name={s.user?.full_name || '?'} size="sm" />
                      <Text style={styles.playerName}>{s.user?.full_name}{s.user?.id === user?.id ? ' (you)' : ''}</Text>
                    </View>
                    <Text style={styles.standingsCol}>{s.wins}</Text>
                    <Text style={styles.standingsCol}>{s.losses}</Text>
                    <Text style={styles.standingsCol}>{s.draws}</Text>
                    <Text style={[styles.standingsCol, { fontWeight: '700', color: colors.primary }]}>{s.points}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {tab === 'Matches' && (
          <View style={styles.section}>
            {matches.length === 0 ? (
              <Text style={styles.muted}>Matches will be scheduled once the league begins.</Text>
            ) : (
              matches.map((m) => {
                const winnerOne = m.winner_id && m.player1?.id === m.winner_id
                const winnerTwo = m.winner_id && m.player2?.id === m.winner_id
                return (
                  <View key={m.id} style={styles.matchRow}>
                    <View style={styles.matchHeader}>
                      <Text style={styles.matchRound}>Round {m.round}</Text>
                      {m.scheduled_at && <Text style={styles.matchDate}>{new Date(m.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>}
                      <View style={[styles.matchStatus, { backgroundColor: m.status === 'completed' ? colors.success + '20' : colors.neutral50 }]}>
                        <Text style={[styles.matchStatusText, m.status === 'completed' && { color: colors.success }]}>{m.status}</Text>
                      </View>
                    </View>
                    <View style={styles.matchTeams}>
                      <View style={styles.matchTeam}>
                        <Avatar uri={m.player1?.avatar_url} name={m.player1?.full_name || '?'} size="sm" />
                        <Text style={[styles.matchPlayerName, winnerOne && { fontWeight: '700', color: colors.success }]}>{m.player1?.full_name || 'TBD'}</Text>
                        {m.player1_score && <Text style={styles.matchScore}>{m.player1_score}</Text>}
                      </View>
                      <View style={styles.matchTeam}>
                        <Avatar uri={m.player2?.avatar_url} name={m.player2?.full_name || '?'} size="sm" />
                        <Text style={[styles.matchPlayerName, winnerTwo && { fontWeight: '700', color: colors.success }]}>{m.player2?.full_name || 'TBD'}</Text>
                        {m.player2_score && <Text style={styles.matchScore}>{m.player2_score}</Text>}
                      </View>
                    </View>
                  </View>
                )
              })
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {league.status === 'cancelled' ? (
          <Button title="League Cancelled" disabled variant="ghost" size="lg" />
        ) : league.status === 'completed' ? (
          <Button title="League Completed" disabled variant="ghost" size="lg" />
        ) : isRegistered ? (
          <Button title={busy ? '...' : 'Withdraw'} onPress={handleWithdraw} variant="ghost" size="lg" disabled={busy} />
        ) : canRegister ? (
          <Button title={busy ? 'Registering…' : isFree ? 'Register' : `Register · $${yourPrice.toFixed(2)}`} onPress={handleRegister} variant="primary" size="lg" disabled={busy} />
        ) : isFull ? (
          <Button title="League Full" disabled variant="primary" size="lg" />
        ) : (
          <Button title="Registration Closed" disabled variant="primary" size="lg" />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 70 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.base },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.neutral900, marginLeft: spacing.md },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] + 80 },
  heroCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.neutral100, ...shadows.sm },
  heroHeader: { flexDirection: 'row', alignItems: 'center' },
  formatIcon: { width: 44, height: 44, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  leagueName: { fontSize: 18, fontWeight: '700', color: colors.neutral900 },
  leagueMeta: { fontSize: 13, color: colors.neutral500, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: colors.neutral100, marginVertical: spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  detailText: { fontSize: 14, color: colors.neutral700, flex: 1 },
  tabs: { flexDirection: 'row', backgroundColor: colors.neutral50, borderRadius: borderRadius.md, padding: 4, marginBottom: spacing.lg },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.white, ...shadows.sm },
  tabText: { fontSize: 13, color: colors.neutral500, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  section: { marginBottom: spacing.lg },
  descText: { fontSize: 14, color: colors.neutral700, lineHeight: 20 },
  muted: { fontSize: 14, color: colors.neutral400, fontStyle: 'italic' },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.neutral100 },
  seed: { fontSize: 13, fontWeight: '700', color: colors.primary, width: 32 },
  playerName: { flex: 1, fontSize: 14, color: colors.neutral800, fontWeight: '500' },
  standingsHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.neutral200, marginBottom: 4 },
  standingsCol: { flex: 0, width: 32, fontSize: 12, color: colors.neutral500, fontWeight: '600', textAlign: 'center' },
  matchRow: { backgroundColor: colors.neutral50, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm },
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  matchRound: { fontSize: 12, fontWeight: '700', color: colors.neutral700 },
  matchDate: { flex: 1, fontSize: 12, color: colors.neutral500 },
  matchStatus: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  matchStatusText: { fontSize: 10, fontWeight: '700', color: colors.neutral500, textTransform: 'uppercase' },
  matchTeams: { gap: spacing.xs },
  matchTeam: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  matchPlayerName: { flex: 1, fontSize: 13, color: colors.neutral800 },
  matchScore: { fontSize: 13, fontWeight: '700', color: colors.neutral900 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.neutral100 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.neutral900, marginTop: spacing.md },
})
