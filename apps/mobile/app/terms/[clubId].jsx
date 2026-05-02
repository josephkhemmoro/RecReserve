import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { colors, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Button } from '../../components/ui'

export default function TermsAcceptScreen() {
  const { clubId, mode } = useLocalSearchParams() // mode: 'join' | 'reaccept' | undefined
  const router = useRouter()
  const { user } = useAuthStore()
  const { setMemberships } = useClubStore()

  const [club, setClub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!clubId) return
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('clubs')
          .select('id, name, location, logo_url, terms_url, terms_filename, terms_version, terms_updated_at')
          .eq('id', clubId)
          .single()
        if (error) throw error
        setClub(data)
      } catch (err) {
        console.error('Failed to load terms:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [clubId])

  const isReaccept = mode === 'reaccept'

  const handleViewPdf = async () => {
    if (!club?.terms_url) return
    try {
      const supported = await Linking.canOpenURL(club.terms_url)
      if (supported) await Linking.openURL(club.terms_url)
      else Alert.alert('Cannot open PDF', 'Unable to open the terms document.')
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to open PDF')
    }
  }

  const handleAccept = async () => {
    if (!agreed || !user?.id || !club) return
    setSubmitting(true)
    try {
      const userAgent = `RecReserve Mobile (${Platform.OS} ${Platform.Version})`
      const { error } = await supabase.rpc('accept_terms', {
        p_club_id: club.id,
        p_user_agent: userAgent,
      })
      if (error) throw error

      if (isReaccept) {
        // Re-acceptance after T&C update — no membership work needed
        router.back()
      } else {
        // Initial join: complete the membership creation now
        // For paid memberships, the join flow continues in the upgrade screen.
        // For free memberships, create the row here.
        const { data: tiers } = await supabase
          .from('membership_tiers')
          .select('id, is_default, is_paid')
          .eq('club_id', club.id)
        const defaultTier = (tiers || []).find((t) => t.is_default) || (tiers || []).find((t) => !t.is_paid) || null

        // If club requires paid membership, route to tier picker (the join flow handles this)
        // For free join, insert membership directly.
        const { data: clubFull } = await supabase
          .from('clubs')
          .select('requires_paid_membership')
          .eq('id', club.id)
          .single()

        if (clubFull?.requires_paid_membership) {
          // Route to clubs tab with intent to pick a paid tier
          router.replace({ pathname: '/(tabs)/clubs', params: { joinClubId: club.id } })
        } else {
          await supabase.from('memberships').insert({
            user_id: user.id,
            club_id: club.id,
            tier_id: defaultTier?.id || null,
            status: 'active',
            is_active: true,
          })

          // Refresh memberships list
          const { data: refreshed } = await supabase
            .from('memberships')
            .select('id, club_id, tier, is_active, club:clubs(id, name, location, logo_url)')
            .eq('user_id', user.id)
            .eq('is_active', true)
          setMemberships(refreshed || [])

          Alert.alert(`Welcome to ${club.name}!`, 'You can now book courts and join games.')
          router.replace('/(tabs)')
        }
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to record acceptance')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLeaveClub = () => {
    Alert.alert(
      'Leave this club?',
      `You'll need to rejoin and accept the new terms again to use ${club?.name || 'this club'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave Club',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true)
            try {
              const { error } = await supabase
                .from('memberships')
                .update({ is_active: false, status: 'cancelled' })
                .eq('user_id', user.id)
                .eq('club_id', club.id)
              if (error) throw error

              const { data: refreshed } = await supabase
                .from('memberships')
                .select('id, club_id, tier, is_active, club:clubs(id, name, location, logo_url)')
                .eq('user_id', user.id)
                .eq('is_active', true)
              setMemberships(refreshed || [])

              router.replace('/(tabs)')
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to leave club')
            } finally {
              setLeaving(false)
            }
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!club || !club.terms_url) {
    return (
      <View style={styles.centered}>
        <Icon name="alert-circle-outline" size="lg" color={colors.neutral400} />
        <Text style={styles.emptyTitle}>Terms not available</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {!isReaccept && (
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-back" size="md" color={colors.primary} />
          </TouchableOpacity>
        )}
        <Text style={styles.title} numberOfLines={1}>
          {isReaccept ? 'Updated Terms' : 'Terms & Conditions'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isReaccept && (
          <View style={styles.alertCard}>
            <Icon name="information-circle" size="sm" color={colors.warning} />
            <Text style={styles.alertText}>
              {club.name} updated their terms (now version {club.terms_version}). Review and accept to continue
              playing here.
            </Text>
          </View>
        )}

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Icon name="document-text" size="lg" color={colors.primary} />
          </View>
          <Text style={styles.clubName}>{club.name}</Text>
          {club.location ? <Text style={styles.location}>{club.location}</Text> : null}
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Version {club.terms_version}</Text>
            {club.terms_updated_at ? (
              <>
                <Text style={styles.versionDot}>·</Text>
                <Text style={styles.versionLabel}>
                  Updated {new Date(club.terms_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </>
            ) : null}
          </View>
        </View>

        <TouchableOpacity style={styles.viewBtn} onPress={handleViewPdf} activeOpacity={0.7}>
          <Icon name="document-outline" size="sm" color={colors.primary} />
          <Text style={styles.viewBtnText}>View Full Terms (PDF)</Text>
          <Icon name="open-outline" size="sm" color={colors.primary} />
        </TouchableOpacity>

        <Text style={styles.helpText}>
          By continuing, you confirm you&apos;ve read the club&apos;s terms and conditions and agree to follow them.
        </Text>

        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setAgreed(!agreed)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
            {agreed && <Icon name="checkmark" size="sm" color={colors.white} />}
          </View>
          <Text style={styles.checkLabel}>
            I&apos;ve read and agree to {club.name}&apos;s Terms & Conditions (v{club.terms_version}).
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={submitting ? 'Recording…' : isReaccept ? 'Accept Updated Terms' : 'Accept & Continue'}
          onPress={handleAccept}
          variant="primary"
          size="lg"
          disabled={!agreed || submitting}
        />
        {isReaccept && (
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveClub} disabled={leaving}>
            <Text style={styles.leaveText}>{leaving ? 'Leaving…' : `Leave ${club.name} instead`}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 70 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.base },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.neutral900, textAlign: 'center', marginHorizontal: spacing.md },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] + 100 },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral100,
    alignItems: 'center',
    gap: spacing.xs,
    ...shadows.sm,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  clubName: { fontSize: 20, fontWeight: '700', color: colors.neutral900 },
  location: { fontSize: 13, color: colors.neutral500 },
  versionRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: spacing.xs },
  versionLabel: { fontSize: 12, color: colors.neutral500, fontWeight: '600' },
  versionDot: { fontSize: 12, color: colors.neutral400 },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primarySurface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    marginBottom: spacing.lg,
  },
  viewBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  helpText: { fontSize: 13, color: colors.neutral600, lineHeight: 19, marginBottom: spacing.lg, textAlign: 'center' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral50,
    borderWidth: 1,
    borderColor: colors.neutral100,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { flex: 1, fontSize: 14, color: colors.neutral800, lineHeight: 20 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral100,
    gap: spacing.sm,
  },
  leaveBtn: { padding: spacing.sm, alignItems: 'center' },
  leaveText: { fontSize: 13, color: colors.neutral500, fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.neutral900, marginTop: spacing.md },
})
