import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { colors, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Avatar, Badge, Button } from '../../components/ui'
import { useAnalyticsStore } from '../../store/analyticsStore'

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)

  const fetchGroup = useCallback(async () => {
    if (!groupId) return
    try {
      const { data: g, error } = await supabase
        .from('play_groups')
        .select('*, creator:users!play_groups_creator_id_fkey(id, full_name, avatar_url), court:courts(name)')
        .eq('id', groupId)
        .single()
      if (error) throw error
      setGroup(g)

      const { data: mem } = await supabase
        .from('play_group_members')
        .select('id, role, status, joined_at, user:users(id, full_name, avatar_url)')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('joined_at', { ascending: true })
      setMembers(mem || [])
    } catch (err) {
      console.error('Failed to load group:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [groupId])

  useEffect(() => { fetchGroup() }, [fetchGroup])

  const isCreator = group?.creator_id === user?.id
  const myMembership = members.find((m) => m.user?.id === user?.id)
  const isMember = !!myMembership || isCreator
  const isFull = group?.max_members && members.length >= group.max_members

  const handleJoin = async () => {
    if (!user?.id || !group) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('play_group_members')
        .insert({ group_id: group.id, user_id: user.id, role: 'member', status: 'active' })
      if (error) {
        if (error.code === '23505') Alert.alert('Already a Member', "You're already in this group.")
        else throw error
      } else {
        useAnalyticsStore.getState().trackGroupJoined(user.id, selectedClub?.id, group.id)
        await fetchGroup()
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to join group')
    } finally {
      setBusy(false)
    }
  }

  const handleLeave = () => {
    Alert.alert('Leave Group?', "You'll need to rejoin if you want to play with this group again.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          setBusy(true)
          try {
            const { error } = await supabase
              .from('play_group_members')
              .update({ status: 'left' })
              .eq('group_id', group.id)
              .eq('user_id', user.id)
            if (error) throw error
            await fetchGroup()
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to leave')
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

  if (!group) {
    return (
      <View style={styles.centered}>
        <Icon name="alert-circle-outline" size="lg" color={colors.neutral400} />
        <Text style={styles.emptyTitle}>Group not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const schedule = group.recurring_day != null
    ? `${DAY_LABELS[group.recurring_day]}s${group.recurring_time ? ` at ${formatTime(group.recurring_time)}` : ''}${group.recurring_duration_mins ? ` · ${group.recurring_duration_mins} min` : ''}`
    : null

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Icon name="arrow-back" size="md" color={colors.primary} /></TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{group.name}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchGroup() }} tintColor={colors.primary} />}
      >
        <View style={styles.heroCard}>
          <View style={styles.groupHeader}>
            <View style={styles.groupAvatar}>
              <Icon name="people" size="lg" color={colors.primary} />
            </View>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.groupMeta}>
              {members.length} member{members.length !== 1 ? 's' : ''}
              {group.max_members ? ` of ${group.max_members}` : ''}
              {group.sport ? ` · ${group.sport}` : ''}
            </Text>
          </View>

          <View style={styles.divider} />

          {schedule && <View style={styles.detailRow}><Icon name="repeat-outline" size="sm" color={colors.neutral500} /><Text style={styles.detailText}>{schedule}</Text></View>}
          {group.court?.name && <View style={styles.detailRow}><Icon name="location-outline" size="sm" color={colors.neutral500} /><Text style={styles.detailText}>Usually plays at {group.court.name}</Text></View>}
          {group.skill_level && <View style={styles.detailRow}><Icon name="trending-up-outline" size="sm" color={colors.neutral500} /><Text style={styles.detailText}>{group.skill_level === 'all' ? 'All skill levels' : `${group.skill_level} level`}</Text></View>}
          <View style={styles.detailRow}>
            <Icon name={group.is_public ? 'globe-outline' : 'lock-closed-outline'} size="sm" color={colors.neutral500} />
            <Text style={styles.detailText}>{group.is_public ? 'Public group' : 'Invite-only'}</Text>
          </View>
        </View>

        {group.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.descText}>{group.description}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members ({members.length + (isCreator || members.find((m) => m.user?.id === group.creator_id) ? 0 : 1)})</Text>

          {!members.find((m) => m.user?.id === group.creator_id) && (
            <View style={styles.memberRow}>
              <Avatar uri={group.creator?.avatar_url} name={group.creator?.full_name || '?'} size="sm" />
              <Text style={styles.memberName}>{group.creator?.full_name}{isCreator ? ' (you)' : ''}</Text>
              <Badge label="Founder" variant="primary" />
            </View>
          )}

          {members.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <Avatar uri={m.user?.avatar_url} name={m.user?.full_name || '?'} size="sm" />
              <Text style={styles.memberName}>{m.user?.full_name}{m.user?.id === user?.id ? ' (you)' : ''}</Text>
              {m.role === 'admin' && <Badge label="Admin" variant="primary" />}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {isCreator ? (
          <Button title="You manage this group" disabled variant="ghost" size="lg" />
        ) : isMember ? (
          <Button title={busy ? '...' : 'Leave Group'} onPress={handleLeave} variant="ghost" size="lg" disabled={busy} />
        ) : isFull ? (
          <Button title="Group Full" disabled variant="primary" size="lg" />
        ) : !group.is_public ? (
          <Button title="Invite-Only" disabled variant="primary" size="lg" />
        ) : (
          <Button title={busy ? 'Joining…' : 'Join Group'} onPress={handleJoin} variant="primary" size="lg" disabled={busy} />
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
  groupHeader: { alignItems: 'center', gap: spacing.sm },
  groupAvatar: { width: 64, height: 64, borderRadius: borderRadius.lg, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  groupName: { fontSize: 20, fontWeight: '700', color: colors.neutral900, textAlign: 'center' },
  groupMeta: { fontSize: 13, color: colors.neutral500, textAlign: 'center' },
  divider: { height: 1, backgroundColor: colors.neutral100, marginVertical: spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  detailText: { fontSize: 14, color: colors.neutral700, flex: 1 },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900, marginBottom: spacing.sm },
  descText: { fontSize: 14, color: colors.neutral700, lineHeight: 20 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.neutral100 },
  memberName: { flex: 1, fontSize: 14, color: colors.neutral800, fontWeight: '500' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.neutral100 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.neutral900, marginTop: spacing.md },
})
