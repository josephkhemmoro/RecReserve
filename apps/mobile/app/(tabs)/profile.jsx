import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { useMembershipStore } from '../../store/membershipStore'
import { useStreakStore } from '../../store/streakStore'
import { useKudosStore } from '../../store/kudosStore'
import { useRewardsStore } from '../../store/rewardsStore'
import { StreakBadge, StreakMilestones, StreakFreezeButton } from '../../components/streaks'
import { KudosBadge, KudosReceivedList } from '../../components/kudos'
import { Avatar, Icon } from '../../components/ui'
import { colors, spacing, borderRadius, shadows } from '../../theme'

export default function ProfileScreen() {
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()
  const { selectedClub, clearClub } = useClubStore()
  const { tier, membership, loading: tierLoading, clearMembership, fetchMembershipTier } = useMembershipStore()
  const {
    streak,
    milestones,
    isLoading: streakLoading,
    fetchStreak,
    fetchMilestones,
    useFreeze,
  } = useStreakStore()
  const {
    receivedKudos,
    totalReceived,
    isLoading: kudosLoading,
    fetchReceivedKudos,
  } = useKudosStore()
  const {
    rewards,
    fetchRewards,
    availableRewards,
    clearRewards,
  } = useRewardsStore()

  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)

  useEffect(() => {
    fetchProfile()
    if (user?.id && selectedClub?.id) {
      fetchStreak(user.id, selectedClub.id)
      fetchMilestones(user.id, selectedClub.id)
      fetchReceivedKudos(user.id, selectedClub.id)
      fetchRewards(user.id, selectedClub.id)
    }
  }, [user?.id, selectedClub?.id])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([
      fetchProfile(),
      fetchMembershipTier(user?.id, selectedClub?.id),
      user?.id && selectedClub?.id ? fetchStreak(user.id, selectedClub.id) : Promise.resolve(),
      user?.id && selectedClub?.id ? fetchMilestones(user.id, selectedClub.id) : Promise.resolve(),
      user?.id && selectedClub?.id ? fetchReceivedKudos(user.id, selectedClub.id) : Promise.resolve(),
      user?.id && selectedClub?.id ? fetchRewards(user.id, selectedClub.id) : Promise.resolve(),
    ])
    setRefreshing(false)
  }, [user?.id, selectedClub?.id])

  const fetchProfile = async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('users')
        .select('full_name, email, phone, avatar_url')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setFullName(data.full_name || '')
      setEmail(data.email || user.email || '')
      setPhone(data.phone || '')
      setAvatarUrl(data.avatar_url || null)
    } catch (err) {
      console.error('Error fetching profile:', err)
      setFullName(user?.user_metadata?.full_name || '')
      setEmail(user?.email || '')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: fullName.trim(), phone: phone.trim() })
        .eq('id', user?.id)

      if (error) throw error
      setEditing(false)
    } catch (err) {
      Alert.alert('Error', 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarPick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your photos to set an avatar.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })

    if (result.canceled) return

    setUploading(true)
    try {
      const file = result.assets[0]
      const ext = file.uri.split('.').pop()?.toLowerCase() || 'jpg'
      const filePath = `${user?.id}.${ext}`

      // Read file as ArrayBuffer (blob doesn't work reliably in React Native)
      const response = await fetch(file.uri)
      const arrayBuffer = await response.arrayBuffer()

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          upsert: true,
          contentType: file.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user?.id)

      if (updateError) throw updateError
      setAvatarUrl(publicUrl)
    } catch (err) {
      console.error('Upload error:', err)
      Alert.alert('Error', err.message || 'Failed to upload avatar')
    } finally {
      setUploading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      clearAuth()
      clearClub()
      clearMembership()
      clearRewards()
    } catch {
      // handled by auth listener
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleAvatarPick} style={styles.avatarContainer}>
            <Avatar uri={avatarUrl} name={fullName || 'U'} size="lg" />
            {uploading && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={colors.white} />
              </View>
            )}
            <View style={styles.editAvatarBadge}>
              <Text style={styles.editAvatarText}>Edit</Text>
            </View>
          </TouchableOpacity>

          {selectedClub && (
            <View style={styles.clubBadge}>
              <Text style={styles.clubBadgeText}>{selectedClub.name}</Text>
            </View>
          )}

          {selectedClub && !streakLoading && (
            <View style={styles.streakBadgeRow}>
              <StreakBadge streak={streak?.current_streak ?? 0} size="medium" />
            </View>
          )}
        </View>

        {/* Membership Card */}
        {selectedClub && (
          <View style={styles.membershipSection}>
            <Text style={styles.sectionLabel}>Membership</Text>
            {tierLoading ? (
              <View style={styles.membershipCard}>
                <View style={[styles.skeletonBar, { width: '50%', height: 14 }]} />
                <View style={[styles.skeletonBar, { width: '70%', height: 12, marginTop: spacing.sm }]} />
              </View>
            ) : tier ? (
              <View style={[styles.membershipCard, { borderLeftColor: tier.color || colors.primary }]}>
                <View style={styles.membershipHeader}>
                  <View style={[styles.tierDot, { backgroundColor: tier.color || colors.primary }]} />
                  <Text style={styles.tierName}>{tier.name}</Text>
                </View>
                {tier.can_book_free ? (
                  <View style={styles.freeBadge}>
                    <Icon name="checkmark-circle" size="sm" color={colors.success} />
                    <Text style={styles.freeBadgeText}>Books free — no charge for court bookings</Text>
                  </View>
                ) : tier.discount_percent > 0 ? (
                  <View style={styles.discountBadge}>
                    <Icon name="pricetag" size="sm" color={colors.primary} />
                    <Text style={styles.discountBadgeText}>
                      {tier.discount_percent}% off court bookings
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.tierSubtext}>Standard pricing</Text>
                )}
                {(tier.benefits || []).length > 0 && (
                  <View style={styles.benefitsList}>
                    {tier.benefits.slice(0, 3).map((b, i) => (
                      <View key={i} style={styles.benefitRow}>
                        <Icon name="checkmark-circle" size="sm" color={colors.success} />
                        <Text style={styles.benefitText}>{b}</Text>
                      </View>
                    ))}
                    {tier.benefits.length > 3 && (
                      <Text style={styles.benefitMore}>+{tier.benefits.length - 3} more</Text>
                    )}
                  </View>
                )}
                <View style={styles.membershipActions}>
                  <TouchableOpacity
                    style={styles.membershipActionBtn}
                    onPress={() => router.push(`/membership/detail/${tier.id}`)}
                  >
                    <Icon name="information-circle-outline" size="sm" color={colors.primary} />
                    <Text style={styles.membershipActionText}>View Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.membershipActionBtn}
                    onPress={() => router.push(`/membership/upgrade/${tier.id}`)}
                  >
                    <Icon name="arrow-up-circle-outline" size="sm" color={colors.primary} />
                    <Text style={styles.membershipActionText}>Upgrade</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : membership ? (
              <View style={styles.membershipCard}>
                <Text style={styles.tierName}>{membership.tier}</Text>
                <Text style={styles.tierSubtext}>No pricing tier configured</Text>
              </View>
            ) : (
              <View style={styles.membershipCardMuted}>
                <Icon name="information-circle-outline" size="md" color={colors.neutral400} />
                <Text style={styles.noTierText}>No membership tier — contact your club</Text>
              </View>
            )}
          </View>
        )}

        {/* Play Streak */}
        {selectedClub && !streakLoading && (
          <View style={styles.streakSection}>
            <Text style={styles.streakSectionTitle}>Play Streak</Text>
            <StreakMilestones
              achievedMilestones={milestones.map((m) => m.milestone)}
              currentStreak={streak?.current_streak ?? 0}
            />
            <StreakFreezeButton
              freezesRemaining={streak?.freezes_remaining ?? 0}
              currentStreak={streak?.current_streak ?? 0}
              onFreeze={() => useFreeze(user?.id, selectedClub?.id)}
            />
          </View>
        )}

        {/* Rewards Row */}
        {selectedClub && (
          <TouchableOpacity
            style={styles.rewardsRow}
            onPress={() => router.push('/rewards')}
            activeOpacity={0.7}
          >
            <View style={styles.rewardsIconWrap}>
              <Icon name="gift" size="md" color={colors.primary} />
            </View>
            <View style={styles.rewardsRowContent}>
              <Text style={styles.rewardsRowTitle}>Rewards</Text>
              <Text style={styles.rewardsRowSubtitle}>
                Milestone rewards from your streak
              </Text>
            </View>
            {availableRewards().length > 0 ? (
              <View style={styles.rewardsBadge}>
                <Text style={styles.rewardsBadgeText}>
                  {availableRewards().length} available
                </Text>
              </View>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={colors.neutral400} />
          </TouchableOpacity>
        )}

        {/* Kudos */}
        {selectedClub && (
          <View style={styles.kudosSection}>
            <View style={styles.kudosSectionHeader}>
              <Text style={styles.kudosSectionTitle}>Kudos</Text>
              <KudosBadge count={totalReceived} />
            </View>
            <KudosReceivedList kudos={receivedKudos} isLoading={kudosLoading} />
          </View>
        )}

        {/* Profile Fields */}
        <View style={styles.fields}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            {editing ? (
              <TextInput
                style={styles.fieldInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
                placeholderTextColor={colors.neutral400}
              />
            ) : (
              <Text style={styles.fieldValue}>{fullName || '—'}</Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValueMuted}>{email}</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone</Text>
            {editing ? (
              <TextInput
                style={styles.fieldInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone number"
                placeholderTextColor={colors.neutral400}
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.fieldValue}>{phone || 'Not set'}</Text>
            )}
          </View>

          {editing ? (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelEditButton}
                onPress={() => { setEditing(false); fetchProfile() }}
              >
                <Text style={styles.cancelEditText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditing(true)}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.switchButton} onPress={() => router.push('/(tabs)/clubs')}>
            <Text style={styles.switchButtonText}>Switch Club</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 70 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
  header: { alignItems: 'center', paddingBottom: spacing.lg },
  avatarContainer: { position: 'relative', marginBottom: spacing.md },
  avatarOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 32, backgroundColor: colors.overlayLight, alignItems: 'center', justifyContent: 'center' },
  editAvatarBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.neutral900, borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  editAvatarText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  clubBadge: { backgroundColor: colors.primaryMuted, paddingHorizontal: spacing.base, paddingVertical: spacing.sm, borderRadius: borderRadius.xl },
  clubBadgeText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  // Membership card
  membershipSection: { paddingHorizontal: spacing.xl, paddingTop: spacing.base },
  membershipCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.neutral100,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  membershipCardMuted: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.neutral100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  membershipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tierDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral900,
    textTransform: 'capitalize',
  },
  tierSubtext: {
    fontSize: 13,
    color: colors.neutral400,
    marginTop: 2,
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  freeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySurface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  discountBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  noTierText: {
    fontSize: 14,
    color: colors.neutral400,
    flex: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral500,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  benefitsList: {
    marginTop: spacing.sm,
    gap: 6,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  benefitText: {
    fontSize: 13,
    color: colors.neutral700,
    flex: 1,
  },
  benefitMore: {
    fontSize: 12,
    color: colors.neutral400,
    fontWeight: '600',
    marginTop: 2,
  },
  membershipActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral100,
  },
  membershipActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primarySurface,
    borderRadius: borderRadius.md,
  },
  membershipActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  skeletonBar: {
    backgroundColor: colors.neutral100,
    borderRadius: borderRadius.sm,
  },

  streakBadgeRow: {
    marginTop: spacing.sm,
  },
  streakSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  streakSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral900,
    marginBottom: 14,
  },
  rewardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral100,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
  },
  rewardsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySurface,
  },
  rewardsRowContent: { flex: 1 },
  rewardsRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral900,
  },
  rewardsRowSubtitle: {
    fontSize: 12,
    color: colors.neutral500,
    marginTop: 2,
  },
  rewardsBadge: {
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  rewardsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  kudosSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  kudosSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  kudosSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral900,
  },
  fields: { paddingHorizontal: spacing.xl, paddingTop: spacing.base },
  fieldGroup: { marginBottom: spacing.lg },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.neutral400, textTransform: 'uppercase', marginBottom: spacing.sm },
  fieldValue: { fontSize: 16, color: colors.neutral900, fontWeight: '500' },
  fieldValueMuted: { fontSize: 16, color: colors.neutral500 },
  fieldInput: { fontSize: 16, color: colors.neutral900, borderWidth: 1, borderColor: colors.neutral200, borderRadius: borderRadius.md, padding: spacing.md, backgroundColor: colors.white },
  editActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  saveButton: { flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.lg, padding: 14, alignItems: 'center' },
  saveButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  cancelEditButton: { flex: 1, borderWidth: 1, borderColor: colors.neutral200, borderRadius: borderRadius.lg, padding: 14, alignItems: 'center' },
  cancelEditText: { color: colors.neutral500, fontSize: 15, fontWeight: '600' },
  editButton: { borderWidth: 1, borderColor: colors.neutral200, borderRadius: borderRadius.lg, padding: 14, alignItems: 'center', backgroundColor: colors.white, marginTop: spacing.xs },
  editButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  actions: { paddingHorizontal: spacing.xl, paddingTop: spacing['2xl'], paddingBottom: spacing['3xl'], gap: spacing.md },
  switchButton: { borderWidth: 1, borderColor: colors.neutral200, borderRadius: borderRadius.lg, padding: spacing.base, alignItems: 'center', backgroundColor: colors.white },
  switchButtonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  signOutButton: { borderWidth: 1, borderColor: colors.errorLight, borderRadius: borderRadius.lg, padding: spacing.base, alignItems: 'center', backgroundColor: colors.errorLight },
  signOutText: { color: colors.error, fontSize: 16, fontWeight: '600' },
})
