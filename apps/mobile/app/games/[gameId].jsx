import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { colors, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Avatar, Badge, Button } from '../../components/ui'
import { useAnalyticsStore } from '../../store/analyticsStore'

const FORMAT_LABELS = { singles: 'Singles', doubles: 'Doubles', mixed_doubles: 'Mixed Doubles', social: 'Social', round_robin: 'Round Robin' }
const FORMAT_ICONS = { singles: 'person-outline', doubles: 'people-outline', mixed_doubles: 'people-outline', social: 'happy-outline', round_robin: 'sync-outline' }
const SKILL_COLORS = { beginner: colors.success, intermediate: colors.warning, advanced: colors.error, all: colors.info }

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDate(d) {
  if (!d) return ''
  const date = new Date(d + 'T00:00:00')
  const now = new Date()
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  if (date.toDateString() === now.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function GameDetailScreen() {
  const { gameId } = useLocalSearchParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const [game, setGame] = useState(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)

  const fetchGame = useCallback(async () => {
    if (!gameId) return
    try {
      const { data: g, error } = await supabase
        .from('open_games')
        .select('*, creator:users!open_games_creator_id_fkey(id, full_name, avatar_url), court:courts(name)')
        .eq('id', gameId)
        .single()
      if (error) throw error
      setGame(g)

      const { data: parts } = await supabase
        .from('game_participants')
        .select('id, status, joined_at, user:users(id, full_name, avatar_url)')
        .eq('game_id', gameId)
        .eq('status', 'joined')
        .order('joined_at', { ascending: true })
      setParticipants(parts || [])
    } catch (err) {
      console.error('Failed to load game:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [gameId])

  useEffect(() => { fetchGame() }, [fetchGame])

  const isCreator = game?.creator_id === user?.id
  const myParticipation = participants.find((p) => p.user?.id === user?.id)
  const hasJoined = !!myParticipation || isCreator
  const joinedCount = (participants?.length || 0) + 1 // +1 for creator
  const spotsLeft = (game?.max_players || 0) - joinedCount

  const handleJoin = async () => {
    if (!user?.id || !game) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('game_participants')
        .insert({ game_id: game.id, user_id: user.id, status: 'joined' })
      if (error) {
        if (error.code === '23505') Alert.alert('Already Joined', "You're already in this game.")
        else throw error
      } else {
        await supabase.from('notifications').insert({
          user_id: game.creator_id, club_id: selectedClub?.id,
          title: 'Player joined your game!',
          body: `${user.full_name || 'Someone'} joined your ${FORMAT_LABELS[game.format] || 'game'}`,
          type: 'game_join', read: false,
        }).catch(() => {})

        if (joinedCount + 1 >= game.max_players) {
          await supabase.from('open_games').update({ status: 'full' }).eq('id', game.id)
        }
        useAnalyticsStore.getState().trackGameJoined(user.id, selectedClub?.id, game.id)
        await fetchGame()
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to join')
    } finally {
      setBusy(false)
    }
  }

  const handleLeave = () => {
    Alert.alert('Leave Game?', 'You can rejoin later if there are open spots.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          setBusy(true)
          try {
            const { error } = await supabase
              .from('game_participants')
              .delete()
              .eq('game_id', game.id)
              .eq('user_id', user.id)
            if (error) throw error
            if (game.status === 'full') {
              await supabase.from('open_games').update({ status: 'open' }).eq('id', game.id)
            }
            await fetchGame()
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to leave')
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }

  const handleCancel = () => {
    Alert.alert('Cancel Game?', 'This will close the game for all players.', [
      { text: 'Keep Open', style: 'cancel' },
      {
        text: 'Cancel Game', style: 'destructive', onPress: async () => {
          setBusy(true)
          try {
            const { error } = await supabase
              .from('open_games')
              .update({ status: 'cancelled' })
              .eq('id', game.id)
            if (error) throw error
            router.back()
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to cancel')
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!game) {
    return (
      <View style={styles.centered}>
        <Icon name="alert-circle-outline" size="lg" color={colors.neutral400} />
        <Text style={styles.emptyTitle}>Game not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const skillColor = SKILL_COLORS[game.skill_level] || colors.info
  const isCancelled = game.status === 'cancelled'
  const isFull = game.status === 'full' || spotsLeft <= 0

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Icon name="arrow-back" size="md" color={colors.primary} /></TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{game.title || FORMAT_LABELS[game.format] || 'Open Game'}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchGame() }} tintColor={colors.primary} />}
      >
        <View style={styles.heroCard}>
          <View style={styles.creatorRow}>
            <Avatar uri={game.creator?.avatar_url} name={game.creator?.full_name || '?'} size="md" />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.creatorLabel}>Hosted by</Text>
              <Text style={styles.creatorName}>{game.creator?.full_name}{isCreator ? ' (you)' : ''}</Text>
            </View>
            {isCancelled ? <Badge label="Cancelled" variant="error" /> : isFull ? <Badge label="Full" variant="warning" /> : null}
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}><Icon name="calendar-outline" size="sm" color={colors.neutral500} /><Text style={styles.detailText}>{formatDate(game.date)}</Text></View>
          <View style={styles.detailRow}><Icon name="time-outline" size="sm" color={colors.neutral500} /><Text style={styles.detailText}>{formatTime(game.start_time)}{game.end_time ? ` – ${formatTime(game.end_time)}` : ''}</Text></View>
          {game.court?.name && <View style={styles.detailRow}><Icon name="location-outline" size="sm" color={colors.neutral500} /><Text style={styles.detailText}>{game.court.name}</Text></View>}
          <View style={styles.detailRow}><Icon name={FORMAT_ICONS[game.format] || 'people-outline'} size="sm" color={colors.neutral500} /><Text style={styles.detailText}>{FORMAT_LABELS[game.format] || game.format}{game.sport ? ` · ${game.sport}` : ''}</Text></View>
          <View style={styles.detailRow}><View style={[styles.skillDot, { backgroundColor: skillColor }]} /><Text style={[styles.detailText, { color: skillColor, fontWeight: '600' }]}>{game.skill_level === 'all' ? 'All levels welcome' : `${game.skill_level} level`}</Text></View>
        </View>

        {game.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this game</Text>
            <Text style={styles.descText}>{game.description}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Players</Text>
            <Text style={styles.spotsText}>{joinedCount}/{game.max_players}{spotsLeft > 0 ? ` · ${spotsLeft} spot${spotsLeft > 1 ? 's' : ''} left` : ''}</Text>
          </View>

          <View style={styles.playerRow}>
            <Avatar uri={game.creator?.avatar_url} name={game.creator?.full_name || '?'} size="sm" />
            <Text style={styles.playerName}>{game.creator?.full_name}{isCreator ? ' (you)' : ''}</Text>
            <Badge label="Host" variant="primary" />
          </View>

          {participants.map((p) => (
            <View key={p.id} style={styles.playerRow}>
              <Avatar uri={p.user?.avatar_url} name={p.user?.full_name || '?'} size="sm" />
              <Text style={styles.playerName}>{p.user?.full_name}{p.user?.id === user?.id ? ' (you)' : ''}</Text>
            </View>
          ))}

          {Array.from({ length: Math.max(0, spotsLeft) }).map((_, i) => (
            <View key={`empty-${i}`} style={[styles.playerRow, styles.emptyPlayerRow]}>
              <View style={styles.emptyAvatar}><Icon name="person-add-outline" size="sm" color={colors.neutral400} /></View>
              <Text style={[styles.playerName, { color: colors.neutral400 }]}>Open spot</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {!isCancelled && (
        <View style={styles.footer}>
          {isCreator ? (
            <Button title={busy ? '...' : 'Cancel Game'} onPress={handleCancel} variant="ghost" size="lg" disabled={busy} />
          ) : hasJoined ? (
            <Button title={busy ? '...' : 'Leave Game'} onPress={handleLeave} variant="ghost" size="lg" disabled={busy} />
          ) : isFull ? (
            <Button title="Game Full" disabled variant="primary" size="lg" />
          ) : (
            <Button title={busy ? 'Joining…' : 'Join Game'} onPress={handleJoin} variant="primary" size="lg" disabled={busy} />
          )}
        </View>
      )}
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
  creatorRow: { flexDirection: 'row', alignItems: 'center' },
  creatorLabel: { fontSize: 12, color: colors.neutral500 },
  creatorName: { fontSize: 16, fontWeight: '700', color: colors.neutral900 },
  divider: { height: 1, backgroundColor: colors.neutral100, marginVertical: spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  detailText: { fontSize: 14, color: colors.neutral700 },
  skillDot: { width: 10, height: 10, borderRadius: 5 },
  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900, marginBottom: spacing.sm },
  descText: { fontSize: 14, color: colors.neutral700, lineHeight: 20 },
  spotsText: { fontSize: 13, color: colors.neutral500, fontWeight: '600' },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.neutral100 },
  emptyPlayerRow: { borderStyle: 'dashed' },
  emptyAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.neutral50, alignItems: 'center', justifyContent: 'center' },
  playerName: { flex: 1, fontSize: 14, color: colors.neutral800, fontWeight: '500' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.neutral100 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.neutral900, marginTop: spacing.md },
})
