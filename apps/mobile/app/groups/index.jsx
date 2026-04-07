import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { colors, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Avatar, Badge, Button } from '../../components/ui'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function GroupsScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [myGroups, setMyGroups] = useState(new Set())
  const [joining, setJoining] = useState(null)

  const fetchGroups = useCallback(async () => {
    if (!selectedClub?.id) return
    try {
      const { data } = await supabase.from('play_groups')
        .select('*, creator:users!play_groups_creator_id_fkey(id, full_name, avatar_url)')
        .eq('club_id', selectedClub.id).eq('is_active', true).eq('is_public', true)
        .order('created_at', { ascending: false })

      const ids = (data || []).map((g) => g.id)
      let memberCounts = {}
      let mySet = new Set()
      if (ids.length > 0) {
        const { data: members } = await supabase.from('play_group_members').select('group_id, user_id').in('group_id', ids).eq('status', 'active')
        for (const m of members || []) {
          memberCounts[m.group_id] = (memberCounts[m.group_id] || 0) + 1
          if (m.user_id === user?.id) mySet.add(m.group_id)
        }
      }
      setGroups((data || []).map((g) => ({ ...g, member_count: memberCounts[g.id] || 0 })))
      setMyGroups(mySet)
    } catch (err) { console.error('Error:', err) }
    finally { setLoading(false); setRefreshing(false) }
  }, [selectedClub?.id, user?.id])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  const handleJoin = async (groupId) => {
    if (!user?.id) return
    setJoining(groupId)
    try {
      const { error } = await supabase.from('play_group_members').insert({ group_id: groupId, user_id: user.id, role: 'member', status: 'active' })
      if (error) { if (error.code === '23505') Alert.alert('Already a Member'); else throw error }
      else fetchGroups()
    } catch (err) { Alert.alert('Error', err.message || 'Failed to join') }
    finally { setJoining(null) }
  }

  const renderGroup = ({ item }) => {
    const isMember = myGroups.has(item.id) || item.creator_id === user?.id
    const schedule = item.recurring_day != null ? `${DAY_LABELS[item.recurring_day]}s${item.recurring_time ? ` at ${item.recurring_time}` : ''}` : null

    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/groups/${item.id}`)} activeOpacity={0.7}>
        <View style={styles.cardTop}>
          <View style={styles.groupAvatar}>
            <Icon name="people" size="md" color={colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.groupName}>{item.name}</Text>
            <Text style={styles.groupMeta}>{item.member_count} member{item.member_count !== 1 ? 's' : ''}{item.sport ? ` · ${item.sport}` : ''}</Text>
          </View>
        </View>

        {item.description && <Text style={styles.descText} numberOfLines={2}>{item.description}</Text>}

        <View style={styles.detailsRow}>
          {schedule && <View style={styles.chip}><Icon name="repeat-outline" size="xs" color={colors.neutral500} /><Text style={styles.chipText}>{schedule}</Text></View>}
          {item.skill_level && <View style={styles.chip}><Text style={styles.chipText}>{item.skill_level}</Text></View>}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.createdBy}>by {item.creator?.full_name}</Text>
          {isMember ? (
            <View style={styles.memberBadge}><Icon name="checkmark-circle" size="sm" color={colors.success} /><Text style={styles.memberText}>Member</Text></View>
          ) : (
            <Button title={joining === item.id ? '...' : 'Join Group'} onPress={() => handleJoin(item.id)} variant="primary" size="sm" disabled={joining === item.id} />
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Icon name="arrow-back" size="md" color={colors.primary} /></TouchableOpacity>
        <Text style={styles.title}>Play Groups</Text>
        <TouchableOpacity onPress={() => router.push('/groups/create')} style={styles.createBtn}>
          <Icon name="add-circle-outline" size="md" color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={loading ? [] : groups}
        renderItem={renderGroup}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, (loading || groups.length === 0) && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchGroups() }} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
          : <View style={styles.emptyState}>
              <Icon name="people-outline" size="lg" color={colors.neutral300} />
              <Text style={styles.emptyTitle}>No play groups yet</Text>
              <Text style={styles.emptySub}>Create a group to organize regular games with your favorite players</Text>
              <Button title="Create a Group" onPress={() => router.push('/groups/create')} variant="primary" size="md" icon="add-outline" />
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
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  groupAvatar: { width: 44, height: 44, borderRadius: borderRadius.md, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: spacing.md },
  groupName: { fontSize: 16, fontWeight: '700', color: colors.neutral900 },
  groupMeta: { fontSize: 13, color: colors.neutral500, marginTop: 2 },
  descText: { fontSize: 13, color: colors.neutral600, lineHeight: 18, marginBottom: spacing.sm },
  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.neutral50, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.neutral600 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.neutral100 },
  createdBy: { fontSize: 12, color: colors.neutral400 },
  memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberText: { fontSize: 13, fontWeight: '600', color: colors.success },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing['3xl'], gap: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.neutral900 },
  emptySub: { fontSize: 14, color: colors.neutral400, textAlign: 'center' },
})
