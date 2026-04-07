import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { colors, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Badge, Button } from '../../components/ui'

const TYPE_ICONS = { lesson_series: 'school-outline', clinic_series: 'people-outline', camp: 'sunny-outline', academy: 'ribbon-outline', drop_in_series: 'enter-outline' }
const TYPE_LABELS = { lesson_series: 'Lesson Series', clinic_series: 'Clinic Series', camp: 'Camp', academy: 'Academy', drop_in_series: 'Drop-In' }
const SKILL_COLORS = { beginner: colors.success, intermediate: colors.warning, advanced: colors.error, all: colors.info }

export default function ProgramsScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [myRegistrations, setMyRegistrations] = useState(new Set())

  const fetchData = useCallback(async () => {
    if (!selectedClub?.id) return
    try {
      const { data } = await supabase.from('programs')
        .select('*, instructor:users!programs_instructor_id_fkey(full_name), court:courts(name)')
        .eq('club_id', selectedClub.id).neq('status', 'draft')
        .order('start_date', { ascending: true })

      // Get registration counts
      const ids = (data || []).map((p) => p.id)
      let regCounts = {}
      if (ids.length > 0) {
        const { data: regs } = await supabase.from('program_registrations').select('program_id').in('program_id', ids).eq('status', 'registered')
        for (const r of regs || []) regCounts[r.program_id] = (regCounts[r.program_id] || 0) + 1
      }

      // Get my registrations
      if (user?.id && ids.length > 0) {
        const { data: myRegs } = await supabase.from('program_registrations').select('program_id').in('program_id', ids).eq('user_id', user.id).eq('status', 'registered')
        setMyRegistrations(new Set((myRegs || []).map((r) => r.program_id)))
      }

      setPrograms((data || []).map((p) => ({ ...p, registered_count: regCounts[p.id] || 0 })))
    } catch (err) { console.error('Error fetching programs:', err) }
    finally { setLoading(false); setRefreshing(false) }
  }, [selectedClub?.id, user?.id])

  useEffect(() => { fetchData() }, [fetchData])

  const renderProgram = ({ item }) => {
    const iconName = TYPE_ICONS[item.program_type] || 'calendar-outline'
    const typeLabel = TYPE_LABELS[item.program_type] || item.program_type
    const isRegistered = myRegistrations.has(item.id)
    const isFull = item.max_participants && item.registered_count >= item.max_participants
    const skillColor = SKILL_COLORS[item.skill_level] || colors.info
    const priceText = item.price > 0 ? `$${item.price}` : 'Free'
    const startDate = new Date(item.start_date + 'T00:00:00')
    const dateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/programs/${item.id}`)} activeOpacity={0.7}>
        <View style={styles.cardTop}>
          <View style={[styles.typeIcon, { backgroundColor: colors.primarySurface }]}>
            <Icon name={iconName} size="md" color={colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.programTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.programMeta}>{typeLabel} · {dateStr}{item.end_date ? ` - ${new Date(item.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          {item.instructor?.full_name && (
            <View style={styles.detailChip}>
              <Icon name="person-outline" size="xs" color={colors.neutral500} />
              <Text style={styles.detailText}>{item.instructor.full_name}</Text>
            </View>
          )}
          {item.skill_level && (
            <View style={[styles.detailChip, { backgroundColor: skillColor + '15' }]}>
              <Text style={[styles.detailText, { color: skillColor }]}>{item.skill_level}</Text>
            </View>
          )}
          <View style={styles.detailChip}>
            <Text style={styles.detailText}>{item.registered_count}{item.max_participants ? `/${item.max_participants}` : ''} spots</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.priceText}>{priceText}</Text>
          {isRegistered ? (
            <View style={styles.registeredBadge}>
              <Icon name="checkmark-circle" size="sm" color={colors.success} />
              <Text style={styles.registeredText}>Registered</Text>
            </View>
          ) : isFull ? (
            <Text style={styles.fullText}>Full</Text>
          ) : (
            <Text style={styles.viewText}>View Details →</Text>
          )}
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
        <Text style={styles.title}>Programs</Text>
      </View>

      <FlatList
        data={loading ? [] : programs}
        renderItem={renderProgram}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, (loading || programs.length === 0) && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData() }} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
          : <View style={styles.emptyState}><Icon name="school-outline" size="lg" color={colors.neutral300} /><Text style={styles.emptyTitle}>No programs available</Text><Text style={styles.emptySub}>Check back soon for lessons, clinics, and camps</Text></View>
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
  typeIcon: { width: 44, height: 44, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: spacing.md },
  programTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900 },
  programMeta: { fontSize: 13, color: colors.neutral500, marginTop: 2 },
  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  detailChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.neutral50, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm },
  detailText: { fontSize: 12, fontWeight: '600', color: colors.neutral600 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.neutral100 },
  priceText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  registeredBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  registeredText: { fontSize: 13, fontWeight: '600', color: colors.success },
  fullText: { fontSize: 13, fontWeight: '600', color: colors.neutral400 },
  viewText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing['3xl'], gap: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.neutral900 },
  emptySub: { fontSize: 14, color: colors.neutral400, textAlign: 'center' },
})
