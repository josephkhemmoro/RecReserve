import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { Avatar } from '../../components/ui'
import { TierCard } from '../../components/membership/TierCard'
import { colors, spacing, borderRadius, shadows, fontSizes, fontWeights, textStyles } from '../../theme'

function formatDateOnly(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function ClubsScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { memberships, selectedClub, setMemberships, setSelectedClub } = useClubStore()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [joining, setJoining] = useState(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Tier picker modal state
  const [tierPicker, setTierPicker] = useState({
    visible: false,
    club: null,
    tiers: [],
    requiresPaid: false,
    loading: false,
  })

  const refreshMemberships = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('memberships')
        .select('id, club_id, tier, is_active, club:clubs(id, name, location, logo_url)')
        .eq('user_id', user?.id)
        .eq('is_active', true)

      if (error) throw error

      const nextMemberships = data || []
      setMemberships(nextMemberships)
      return nextMemberships
    } catch (err) {
      console.error('Error refreshing memberships:', err)
      return []
    }
  }, [user?.id, setMemberships])

  // Refresh memberships on mount
  useEffect(() => {
    refreshMemberships()
  }, [refreshMemberships])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshMemberships()
    setRefreshing(false)
  }, [refreshMemberships])

  const handleSearch = async () => {
    if (!search.trim()) return
    setSearching(true)
    setHasSearched(true)
    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, location, logo_url')
        .ilike('name', `%${search.trim()}%`)
        .eq('subscription_status', 'active')
        .limit(20)

      if (error) throw error
      setResults(data || [])
    } catch (err) {
      console.error('Error searching clubs:', err)
    } finally {
      setSearching(false)
    }
  }

  const isMember = (clubId) => {
    return memberships.some((m) => m.club_id === clubId)
  }

  const handleJoin = async (club) => {
    setJoining(club.id)
    try {
      // Fetch club tiers, paid-membership flag, AND terms info in one round-trip.
      const [tiersRes, clubRes] = await Promise.all([
        supabase
          .from('membership_tiers')
          .select('id, name, is_paid, monthly_price_cents, is_default, description, discount_percent, can_book_free, color, benefits')
          .eq('club_id', club.id)
          .order('sort_order', { ascending: true }),
        supabase.from('clubs').select('requires_paid_membership, terms_url, terms_version').eq('id', club.id).single(),
      ])

      if (tiersRes.error) throw tiersRes.error
      if (clubRes.error) throw clubRes.error

      const tiers = tiersRes.data || []
      const requiresPaid = !!clubRes.data?.requires_paid_membership
      const hasTerms = !!clubRes.data?.terms_url

      // If club has T&C, route to terms acceptance screen first.
      // The terms screen handles the rest of the join flow after acceptance.
      if (hasTerms) {
        setJoining(null)
        router.push({ pathname: `/terms/${club.id}`, params: { mode: 'join' } })
        return
      }

      if (requiresPaid) {
        // Show tier picker — player picks a paid tier → upgrade flow
        const paidTiers = tiers.filter((t) => t.is_paid)
        if (paidTiers.length === 0) {
          Alert.alert(
            'Unavailable',
            'This club is not accepting new members yet — contact the club admin.'
          )
          return
        }
        setTierPicker({
          visible: true,
          club,
          tiers: paidTiers,
          requiresPaid: true,
          loading: false,
        })
        return
      }

      // Free membership flow — find default tier and insert directly
      const defaultTier = tiers.find((t) => t.is_default)
      if (!defaultTier) {
        Alert.alert(
          'Unavailable',
          'This club is not accepting new members yet — contact the club admin.'
        )
        return
      }

      const joinDate = formatDateOnly()
      const { error } = await supabase.from('memberships').insert({
        user_id: user?.id,
        club_id: club.id,
        tier_id: defaultTier.id,
        tier: 'standard',
        start_date: joinDate,
        is_active: true,
        status: 'active',
      })

      if (error) throw error

      const { error: profileError } = await supabase
        .from('users')
        .update({ club_id: club.id })
        .eq('id', user?.id)
        .is('club_id', null)

      if (profileError) {
        console.warn('Error syncing primary club after join:', profileError)
      }

      const nextMemberships = await refreshMemberships()

      // Auto-select if it's the user's first club
      if (!selectedClub) {
        const joinedMembership = nextMemberships.find((m) => m.club_id === club.id)
        setSelectedClub(joinedMembership?.club || club)
      }

      Alert.alert('Joined!', `You are now a member of ${club.name} on the ${defaultTier.name} tier.`)
    } catch (err) {
      console.error('Error joining club:', err)
      Alert.alert('Error', err?.message || 'Could not join club. Please try again.')
    } finally {
      setJoining(null)
    }
  }

  const handlePickPaidTier = (tier) => {
    const club = tierPicker.club
    setTierPicker({ visible: false, club: null, tiers: [], requiresPaid: false, loading: false })
    // Hand off to upgrade flow — pass clubId so the flow knows the context
    router.push({
      pathname: `/membership/upgrade/${tier.id}`,
      params: { clubId: club.id, joining: '1' },
    })
  }

  const closeTierPicker = () => {
    setTierPicker({ visible: false, club: null, tiers: [], requiresPaid: false, loading: false })
  }

  const handleSelect = (membership) => {
    if (membership.club) {
      setSelectedClub(membership.club)
    }
  }

  const handleLeave = (membership) => {
    Alert.alert(
      'Leave Club',
      `Are you sure you want to leave ${membership.club?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('memberships')
                .update({ is_active: false })
                .eq('id', membership.id)

              if (error) throw error

              const nextMemberships = await refreshMemberships()

              // If leaving the selected club, clear selection
              if (selectedClub?.id === membership.club_id) {
                setSelectedClub(nextMemberships[0]?.club || null)
              }

              const { error: profileError } = await supabase
                .from('users')
                .update({ club_id: nextMemberships[0]?.club_id || null })
                .eq('id', user?.id)
                .eq('club_id', membership.club_id)

              if (profileError) {
                console.warn('Error syncing primary club after leave:', profileError)
              }
            } catch (err) {
              console.error('Error leaving club:', err)
            }
          },
        },
      ]
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Clubs</Text>
            </View>

            {/* My Clubs */}
            {memberships.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>My Clubs</Text>
                {memberships.map((m) => (
                  <View key={m.id} style={styles.clubCard}>
                    <TouchableOpacity
                      style={styles.clubCardMain}
                      onPress={() => handleSelect(m)}
                    >
                      <View style={styles.clubAvatarWrap}>
                        <Avatar uri={m.club?.logo_url} name={m.club?.name || 'C'} size="md" />
                      </View>
                      <TouchableOpacity
                        style={styles.clubInfo}
                        onPress={() => router.push(`/club/${m.club_id}`)}
                      >
                        <Text style={styles.clubName}>{m.club?.name || 'Club'}</Text>
                        {m.club?.location && (
                          <Text style={styles.clubLocation}>{m.club.location}</Text>
                        )}
                      </TouchableOpacity>
                      {selectedClub?.id === m.club_id ? (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>Active</Text>
                        </View>
                      ) : (
                        <View style={styles.selectBadge}>
                          <Text style={styles.selectBadgeText}>Select</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {selectedClub?.id !== m.club_id && (
                      <TouchableOpacity
                        style={styles.leaveButton}
                        onPress={() => handleLeave(m)}
                      >
                        <Text style={styles.leaveButtonText}>Leave</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* No clubs message */}
            {memberships.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No clubs yet</Text>
                <Text style={styles.emptySubtitle}>
                  Search for a club below to join and start booking courts
                </Text>
              </View>
            )}

            {/* Search */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Find a Club</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by club name..."
                  placeholderTextColor={colors.neutral400}
                  value={search}
                  onChangeText={setSearch}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={handleSearch}
                  disabled={searching || !search.trim()}
                >
                  {searching ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.searchButtonText}>Search</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          hasSearched && !searching ? (
            <View style={styles.emptySearch}>
              <Text style={styles.emptySearchText}>No clubs found</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const alreadyMember = isMember(item.id)
          return (
            <View style={styles.resultCard}>
              <View style={styles.clubAvatarWrap}>
                <Avatar uri={item.logo_url} name={item.name} size="md" />
              </View>
              <TouchableOpacity
                style={styles.clubInfo}
                onPress={() => router.push(`/club/${item.id}`)}
              >
                <Text style={styles.clubName}>{item.name}</Text>
                {item.location && (
                  <Text style={styles.clubLocation}>{item.location}</Text>
                )}
              </TouchableOpacity>
              {alreadyMember ? (
                <View style={styles.memberBadge}>
                  <Text style={styles.memberBadgeText}>Member</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.joinButton, joining === item.id && styles.joinButtonDisabled]}
                  onPress={() => handleJoin(item)}
                  disabled={joining === item.id}
                >
                  {joining === item.id ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.joinButtonText}>Join</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )
        }}
      />

      {/* Tier Picker Modal */}
      <Modal
        visible={tierPicker.visible}
        transparent
        animationType="slide"
        onRequestClose={closeTierPicker}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Choose a membership</Text>
                {tierPicker.club?.name ? (
                  <Text style={styles.modalSubtitle}>
                    {tierPicker.club.name} requires a paid membership
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={closeTierPicker} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.neutral500} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: spacing['2xl'] }}
              showsVerticalScrollIndicator={false}
            >
              {tierPicker.tiers.length === 0 ? (
                <Text style={styles.modalEmpty}>No paid tiers available.</Text>
              ) : (
                tierPicker.tiers.map((tier) => (
                  <TierCard
                    key={tier.id}
                    tier={tier}
                    onPress={() => handlePickPaidTier(tier)}
                  />
                ))
              )}
              <Text style={styles.modalFootnote}>
                {"You'll review price and confirm payment before being charged."}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingTop: 70,
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.neutral900,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral900,
    marginBottom: spacing.md,
  },
  clubCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral200,
    overflow: 'hidden',
    ...shadows.sm,
  },
  clubCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  clubAvatarWrap: {
    marginRight: spacing.md,
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral900,
  },
  clubLocation: {
    fontSize: 13,
    color: colors.neutral500,
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  selectBadge: {
    backgroundColor: colors.primarySurface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  selectBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  leaveButton: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral100,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  leaveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
  },
  memberBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  memberBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral100,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral900,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.neutral400,
    textAlign: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: borderRadius.lg,
    padding: 14,
    fontSize: 15,
    color: colors.neutral900,
  },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    minWidth: 80,
    alignItems: 'center',
  },
  searchButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  resultsList: {
    marginTop: spacing.md,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: 14,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral100,
    ...shadows.sm,
  },
  joinButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: 18,
    paddingVertical: spacing.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  emptySearch: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 14,
    color: colors.neutral400,
  },

  // Tier picker modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    paddingTop: spacing.base,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral100,
  },
  modalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.neutral900,
  },
  modalSubtitle: {
    ...textStyles.bodySmall,
    color: colors.neutral500,
    marginTop: 2,
  },
  modalBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  modalEmpty: {
    ...textStyles.body,
    color: colors.neutral500,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  modalFootnote: {
    ...textStyles.bodySmall,
    color: colors.neutral500,
    textAlign: 'center',
    marginTop: spacing.md,
  },
})
