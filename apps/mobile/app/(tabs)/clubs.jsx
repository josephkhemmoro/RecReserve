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
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { Avatar } from '../../components/ui'
import { colors, spacing, borderRadius, shadows } from '../../theme'

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
      const joinDate = formatDateOnly()
      const { error } = await supabase.from('memberships').insert({
        user_id: user?.id,
        club_id: club.id,
        tier: 'standard',
        start_date: joinDate,
        is_active: true,
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

      Alert.alert('Joined!', `You are now a member of ${club.name}`)
    } catch (err) {
      console.error('Error joining club:', err)
      Alert.alert('Error', err?.message || 'Could not join club. Please try again.')
    } finally {
      setJoining(null)
    }
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
})
