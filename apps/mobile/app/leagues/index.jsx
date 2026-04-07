import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useClubStore } from '../../store/clubStore'
import { colors, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Badge } from '../../components/ui'

const FORMAT_ICONS = { ladder: 'trending-up-outline', round_robin: 'sync-outline', league: 'trophy-outline', knockout: 'flash-outline' }
const FORMAT_LABELS = { ladder: 'Ladder', round_robin: 'Round Robin', league: 'League', knockout: 'Knockout' }
const STATUS_COLORS = { draft: colors.neutral400, registration_open: colors.primary, in_progress: colors.success, completed: colors.neutral500, cancelled: colors.error }

export default function LeaguesScreen() {
  const router = useRouter()
  const { selectedClub } = useClubStore()
  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    if (!selectedClub?.id) return
    try {
      const { data } = await supabase.from('leagues').select('*')
        .eq('club_id', selectedClub.id).neq('status', 'draft').order('start_date', { ascending: true })

      const ids = (data || []).map((l) => l.id)
      let playerCounts = {}
      if (ids.length > 0) {
        const { data: players } = await supabase.from('league_players').select('league_id').in('league_id', ids).eq('status', 'active')
        for (const p of players || []) playerCounts[p.league_id] = (playerCounts[p.league_id] || 0) + 1
      }
      setLeagues((data || []).map((l) => ({ ...l, player_count: playerCounts[l.id] || 0 })))
    } catch (err) { console.error('Error:', err) }
    finally { setLoading(false); setRefreshing(false) }
  }, [selectedClub?.id])

  useEffect(() => { fetchData() }, [fetchData])

  const renderLeague = ({ item }) => {
    const iconName = FORMAT_ICONS[item.format] || 'trophy-outline'
    const formatLabel = FORMAT_LABELS[item.format] || item.format
    const statusColor = STATUS_COLORS[item.status] || colors.neutral500
    const priceText = item.entry_fee > 0 ? `$${item.entry_fee}` : 'Free'
    const startDate = new Date(item.start_date + 'T00:00:00')
    const isFull = item.max_players && item.player_count >= item.max_players

    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/leagues/${item.id}`)} activeOpacity={0.7}>
        <View style={styles.cardTop}>
          <View style={[styles.formatIcon, { backgroundColor: colors.primarySurface }]}>
            <Icon name={iconName} size="md" color={colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.leagueName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.leagueMeta}>{formatLabel} · {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailChip}>
            <Icon name="people-outline" size="xs" color={colors.neutral500} />
            <Text style={styles.detailText}>{item.player_count}{item.max_players ? `/${item.max_players}` : ''}</Text>
          </View>
          {item.skill_level && (
            <View style={styles.detailChip}><Text style={styles.detailText}>{item.skill_level}</Text></View>
          )}
          <View style={styles.detailChip}><Text style={styles.detailText}>{priceText}</Text></View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
          {item.status === 'registration_open' && !isFull ? (
            <Text style={styles.joinText}>Join →</Text>
          ) : isFull ? (
            <Text style={styles.fullText}>Full</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size="md" color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Leagues & Play</Text>
      </View>

      <FlatList
        data={loading ? [] : leagues}
        renderItem={renderLeague}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, (loading || leagues.length === 0) && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData() }} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
          : <View style={styles.emptyState}><Icon name="trophy-outline" size="lg" color={colors.neutral300} /><Text style={styles.emptyTitle}>No leagues available</Text><Text style={styles.emptySub}>Check back for ladders, round robins, and leagues</Text></View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 70 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.base },
  title: { fontSize: 22, fontWeight: '700', color: colors.neutral900 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.base, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.neutral100, ...shadows.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  formatIcon: { width: 44, height: 44, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: spacing.md },
  leagueName: { fontSize: 16, fontWeight: '700', color: colors.neutral900 },
  leagueMeta: { fontSize: 13, color: colors.neutral500, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  detailChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.neutral50, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm },
  detailText: { fontSize: 12, fontWeight: '600', color: colors.neutral600 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.neutral100 },
  statusText: { fontSize: 13, fontWeight: '600', color: colors.neutral500, textTransform: 'capitalize' },
  joinText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  fullText: { fontSize: 13, fontWeight: '600', color: colors.neutral400 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing['3xl'], gap: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.neutral900 },
  emptySub: { fontSize: 14, color: colors.neutral400, textAlign: 'center' },
})
