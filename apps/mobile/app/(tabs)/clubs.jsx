import { useState, useEffect } from 'react'
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
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'

export default function ClubsScreen() {
  const { user } = useAuthStore()
  const { memberships, selectedClub, setMemberships, setSelectedClub } = useClubStore()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [joining, setJoining] = useState(null)
  const [hasSearched, setHasSearched] = useState(false)

  // Refresh memberships on mount
  useEffect(() => {
    refreshMemberships()
  }, [])

  const refreshMemberships = async () => {
    try {
      const { data } = await supabase
        .from('memberships')
        .select('id, club_id, tier, is_active, club:clubs(id, name, location, logo_url)')
        .eq('user_id', user?.id)
        .eq('is_active', true)

      setMemberships(data || [])
    } catch (err) {
      console.error('Error refreshing memberships:', err)
    }
  }

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
      const { error } = await supabase.from('memberships').insert({
        user_id: user?.id,
        club_id: club.id,
        tier: 'standard',
        start_date: new Date().toISOString().split('T')[0],
        is_active: true,
      })

      if (error) throw error

      await refreshMemberships()

      // Auto-select if it's the user's first club
      if (!selectedClub) {
        setSelectedClub(club)
      }

      Alert.alert('Joined!', `You are now a member of ${club.name}`)
    } catch (err) {
      console.error('Error joining club:', err)
      Alert.alert('Error', 'Could not join club. Please try again.')
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
              await supabase
                .from('memberships')
                .update({ is_active: false })
                .eq('id', membership.id)

              // If leaving the selected club, clear selection
              if (selectedClub?.id === membership.club_id) {
                setSelectedClub(null)
              }

              refreshMemberships()
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
                <View style={styles.clubAvatar}>
                  <Text style={styles.clubAvatarText}>
                    {m.club?.name?.charAt(0) || 'C'}
                  </Text>
                </View>
                <View style={styles.clubInfo}>
                  <Text style={styles.clubName}>{m.club?.name || 'Club'}</Text>
                  {m.club?.location && (
                    <Text style={styles.clubLocation}>{m.club.location}</Text>
                  )}
                </View>
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
            placeholderTextColor="#9ca3af"
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
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          style={styles.resultsList}
          keyboardShouldPersistTaps="handled"
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
                <View style={styles.clubAvatar}>
                  <Text style={styles.clubAvatarText}>
                    {item.name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.clubInfo}>
                  <Text style={styles.clubName}>{item.name}</Text>
                  {item.location && (
                    <Text style={styles.clubLocation}>{item.location}</Text>
                  )}
                </View>
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
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.joinButtonText}>Join</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )
          }}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 70,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 10,
  },
  clubCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  clubCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  clubAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clubAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  clubLocation: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  selectBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  selectBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  leaveButton: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingVertical: 8,
    alignItems: 'center',
  },
  leaveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc2626',
  },
  memberBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  memberBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1e293b',
  },
  searchButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    minWidth: 80,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  resultsList: {
    marginTop: 12,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  joinButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptySearch: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 14,
    color: '#94a3b8',
  },
})
