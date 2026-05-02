import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { colors, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Avatar, Badge, Button } from '../../components/ui'
import { useAnalyticsStore } from '../../store/analyticsStore'

const FORMAT_LABELS = { singles: 'Singles', doubles: 'Doubles', mixed_doubles: 'Mixed', social: 'Social', round_robin: 'Round Robin' }
const FORMAT_ICONS = { singles: 'person-outline', doubles: 'people-outline', mixed_doubles: 'people-outline', social: 'happy-outline', round_robin: 'sync-outline' }
const SKILL_COLORS = { beginner: colors.success, intermediate: colors.warning, advanced: colors.error, all: colors.info }

export default function GamesScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [myParticipation, setMyParticipation] = useState(new Set())
  const [joining, setJoining] = useState(null)

  const fetchGames = useCallback(async () => {
    if (!selectedClub?.id) return
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase.from('open_games')
        .select('*, creator:users!open_games_creator_id_fkey(id, full_name, avatar_url), court:courts(name)')
        .eq('club_id', selectedClub.id).in('status', ['open', 'full']).gte('date', today)
        .order('date').order('start_time')

      // Get participant counts and my participation
      const ids = (data || []).map((g) => g.id)
      let countMap = {}
      let mySet = new Set()
      if (ids.length > 0) {
        const { data: parts } = await supabase.from('game_participants').select('game_id, user_id, status').in('game_id', ids).eq('status', 'joined')
        for (const p of parts || []) {
          countMap[p.game_id] = (countMap[p.game_id] || 0) + 1
          if (p.user_id === user?.id) mySet.add(p.game_id)
        }
      }

      setGames((data || []).map((g) => ({ ...g, joined_count: (countMap[g.id] || 0) + 1 }))) // +1 for creator
      setMyParticipation(mySet)
    } catch (err) { console.error('Error:', err) }
    finally { setLoading(false); setRefreshing(false) }
  }, [selectedClub?.id, user?.id])

  useEffect(() => { fetchGames() }, [fetchGames])

  const handleJoin = async (gameId) => {
    if (!user?.id) return
    setJoining(gameId)
    try {
      const { error } = await supabase.from('game_participants').insert({ game_id: gameId, user_id: user.id, status: 'joined' })
      if (error) { if (error.code === '23505') Alert.alert('Already Joined'); else throw error }
      else {
        // Notify creator
        const game = games.find((g) => g.id === gameId)
        if (game) {
          await supabase.from('notifications').insert({
            user_id: game.creator_id, club_id: selectedClub?.id,
            title: 'Player joined your game!', body: `${user.full_name || 'Someone'} joined your ${FORMAT_LABELS[game.format] || 'game'}`,
            type: 'game_join', read: false,
          }).catch(() => {})

          // Check if game is now full
          const newCount = (game.joined_count || 1) + 1
          if (newCount >= game.max_players) {
            await supabase.from('open_games').update({ status: 'full' }).eq('id', gameId)
          }
        }
        fetchGames()
        useAnalyticsStore.getState().trackGameJoined(user.id, selectedClub?.id, gameId)
      }
    } catch (err) { Alert.alert('Error', err.message || 'Failed to join') }
    finally { setJoining(null) }
  }

  const formatTime = (t) => {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  const formatDate = (d) => {
    const date = new Date(d + 'T00:00:00')
    const now = new Date()
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
    if (date.toDateString() === now.toDateString()) return 'Today'
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const renderGame = ({ item, index }) => {
    const isCreator = item.creator_id === user?.id
    const hasJoined = myParticipation.has(item.id) || isCreator
    const spotsLeft = item.max_players - (item.joined_count || 1)
    const skillColor = SKILL_COLORS[item.skill_level] || colors.info

    return (
      <Animated.View entering={FadeInDown.duration(350).delay(Math.min(index * 60, 300)).springify()}>
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/games/${item.id}`)} activeOpacity={0.7}>
        <View style={styles.cardTop}>
          <Avatar uri={item.creator?.avatar_url} name={item.creator?.full_name || '?'} size="md" />
          <View style={styles.cardInfo}>
            <Text style={styles.creatorName}>{item.creator?.full_name}{isCreator ? ' (you)' : ''}</Text>
            <Text style={styles.gameTitle}>{item.title || `${FORMAT_LABELS[item.format] || 'Game'} — ${item.sport}`}</Text>
          </View>
          {item.status === 'full' && <Badge label="Full" variant="warning" />}
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.chip}><Icon name="calendar-outline" size="xs" color={colors.neutral500} /><Text style={styles.chipText}>{formatDate(item.date)}</Text></View>
          <View style={styles.chip}><Icon name="time-outline" size="xs" color={colors.neutral500} /><Text style={styles.chipText}>{formatTime(item.start_time)}</Text></View>
          <View style={[styles.chip, { backgroundColor: skillColor + '15' }]}><Text style={[styles.chipText, { color: skillColor }]}>{item.skill_level}</Text></View>
          <View style={styles.chip}><Icon name={FORMAT_ICONS[item.format] || 'people-outline'} size="xs" color={colors.neutral500} /><Text style={styles.chipText}>{FORMAT_LABELS[item.format]}</Text></View>
        </View>

        {item.court?.name && <Text style={styles.courtText}>{item.court.name}</Text>}
        {item.description && <Text style={styles.descText} numberOfLines={2}>{item.description}</Text>}

        <View style={styles.cardFooter}>
          <Text style={styles.spotsText}>{item.joined_count || 1}/{item.max_players} players{spotsLeft > 0 ? ` · ${spotsLeft} spot${spotsLeft > 1 ? 's' : ''} left` : ''}</Text>
          {hasJoined ? (
            <View style={styles.joinedBadge}><Icon name="checkmark-circle" size="sm" color={colors.success} /><Text style={styles.joinedText}>{isCreator ? 'Your Game' : 'Joined'}</Text></View>
          ) : spotsLeft > 0 ? (
            <Button title={joining === item.id ? '...' : 'Join'} onPress={() => handleJoin(item.id)} variant="primary" size="sm" disabled={joining === item.id} />
          ) : null}
        </View>
      </TouchableOpacity>
      </Animated.View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Icon name="arrow-back" size="md" color={colors.primary} /></TouchableOpacity>
        <Text style={styles.title}>Open Games</Text>
        <TouchableOpacity onPress={() => router.push('/games/create')} style={styles.createBtn}>
          <Icon name="add-circle-outline" size="md" color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlashList
        data={loading ? [] : games}
        renderItem={renderGame}
        keyExtractor={(item) => item.id}
        estimatedItemSize={160}
        contentContainerStyle={[styles.list, (loading || games.length === 0) && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchGames() }} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
          : <View style={styles.emptyState}>
              <Icon name="tennisball-outline" size="lg" color={colors.neutral300} />
              <Text style={styles.emptyTitle}>No open games</Text>
              <Text style={styles.emptySub}>Be the first to create a game and find players</Text>
              <Button title="Create a Game" onPress={() => router.push('/games/create')} variant="primary" size="md" icon="add-outline" />
            </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 70 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.base },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: colors.neutral900, marginLeft: spacing.md },
  createBtn: { padding: spacing.xs },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.base, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.neutral100, ...shadows.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  cardInfo: { flex: 1, marginLeft: spacing.md },
  creatorName: { fontSize: 13, color: colors.neutral500 },
  gameTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900, marginTop: 2 },
  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.neutral50, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.neutral600 },
  courtText: { fontSize: 13, color: colors.neutral500, marginBottom: spacing.xs },
  descText: { fontSize: 13, color: colors.neutral600, lineHeight: 18, marginBottom: spacing.sm },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.neutral100 },
  spotsText: { fontSize: 13, fontWeight: '600', color: colors.neutral500 },
  joinedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  joinedText: { fontSize: 13, fontWeight: '600', color: colors.success },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing['3xl'], gap: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.neutral900 },
  emptySub: { fontSize: 14, color: colors.neutral400, textAlign: 'center' },
})
