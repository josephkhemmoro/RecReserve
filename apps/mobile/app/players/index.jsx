import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { colors, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Avatar } from '../../components/ui'

export default function PlayersScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

  const fetchPlayers = useCallback(async () => {
    if (!selectedClub?.id) return
    try {
      // Get all active members of this club
      const { data: memberships, error } = await supabase
        .from('memberships')
        .select('user_id, user:users!memberships_user_id_fkey(id, full_name, avatar_url, created_at)')
        .eq('club_id', selectedClub.id)
        .eq('is_active', true)

      if (error) throw error

      // Get streaks for enrichment
      const userIds = (memberships || []).map((m) => m.user_id)
      let streakMap = {}
      let kudosMap = {}

      if (userIds.length > 0) {
        const { data: streaks } = await supabase
          .from('player_streaks')
          .select('user_id, current_streak')
          .eq('club_id', selectedClub.id)
          .in('user_id', userIds)

        for (const s of streaks || []) {
          streakMap[s.user_id] = s.current_streak
        }

        const { data: kudos } = await supabase
          .from('kudos')
          .select('receiver_id')
          .eq('club_id', selectedClub.id)
          .in('receiver_id', userIds)

        for (const k of kudos || []) {
          kudosMap[k.receiver_id] = (kudosMap[k.receiver_id] || 0) + 1
        }
      }

      const enriched = (memberships || [])
        .filter((m) => m.user && m.user_id !== user?.id) // exclude self
        .map((m) => ({
          ...m.user,
          streak: streakMap[m.user_id] || 0,
          kudos: kudosMap[m.user_id] || 0,
        }))
        .sort((a, b) => b.streak - a.streak || b.kudos - a.kudos)

      setPlayers(enriched)
    } catch (err) {
      console.error('Error fetching players:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedClub?.id, user?.id])

  useEffect(() => { fetchPlayers() }, [fetchPlayers])

  const onRefresh = () => { setRefreshing(true); fetchPlayers() }

  const filtered = search
    ? players.filter((p) => p.full_name?.toLowerCase().includes(search.toLowerCase()))
    : players

  const renderPlayer = ({ item }) => (
    <TouchableOpacity
      style={styles.playerCard}
      onPress={() => router.push(`/player/${item.id}`)}
      activeOpacity={0.7}
    >
      <Avatar uri={item.avatar_url} name={item.full_name || '?'} size="md" />
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{item.full_name}</Text>
        <View style={styles.playerStats}>
          {item.streak > 0 && (
            <View style={styles.miniStat}>
              <Text style={styles.miniStatIcon}>{'\uD83D\uDD25'}</Text>
              <Text style={styles.miniStatText}>{item.streak}w streak</Text>
            </View>
          )}
          {item.kudos > 0 && (
            <View style={styles.miniStat}>
              <Text style={styles.miniStatIcon}>{'\uD83D\uDC4F'}</Text>
              <Text style={styles.miniStatText}>{item.kudos} kudos</Text>
            </View>
          )}
        </View>
      </View>
      <Icon name="chevron-forward" size="sm" color={colors.neutral300} />
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size="md" color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Players</Text>
      </View>

      <View style={styles.searchContainer}>
        <Icon name="search-outline" size="sm" color={colors.neutral400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search players..."
          placeholderTextColor={colors.neutral400}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="close-circle" size="sm" color={colors.neutral400} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={loading ? [] : filtered}
        renderItem={renderPlayer}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, (loading || filtered.length === 0) && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : (
            <View style={styles.emptyState}>
              <Icon name="people-outline" size="lg" color={colors.neutral300} />
              <Text style={styles.emptyTitle}>{search ? 'No players found' : 'No members yet'}</Text>
            </View>
          )
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
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginBottom: spacing.base,
    backgroundColor: colors.neutral50, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.neutral900 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  playerCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.base,
    marginBottom: spacing.sm, backgroundColor: colors.white, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.neutral100,
  },
  playerInfo: { flex: 1, marginLeft: spacing.md },
  playerName: { fontSize: 15, fontWeight: '700', color: colors.neutral900 },
  playerStats: { flexDirection: 'row', gap: spacing.md, marginTop: 4 },
  miniStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  miniStatIcon: { fontSize: 12 },
  miniStatText: { fontSize: 12, color: colors.neutral500 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.neutral500 },
})
