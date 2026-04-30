import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useStripe } from '@stripe/stripe-react-native'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useClubStore } from '../../../store/clubStore'
import { useMembershipStore } from '../../../store/membershipStore'
import { colors, spacing, borderRadius, fontSizes, fontWeights, layout, textStyles } from '../../../theme'

async function refreshMembershipsList(userId, setMemberships) {
  if (!userId) return []
  try {
    const { data, error } = await supabase
      .from('memberships')
      .select('id, club_id, tier, is_active, club:clubs(id, name, location, logo_url)')
      .eq('user_id', userId)
      .eq('is_active', true)
    if (error) throw error
    const next = data || []
    setMemberships(next)
    return next
  } catch (err) {
    console.error('Error refreshing memberships:', err)
    return []
  }
}

function formatPrice(cents) {
  if (!cents || cents <= 0) return 'Free'
  const dollars = cents / 100
  if (dollars % 1 === 0) return `$${dollars}`
  return `$${dollars.toFixed(2)}`
}

export default function TierUpgradeScreen() {
  const { tierId, clubId: paramClubId, joining } = useLocalSearchParams()
  const router = useRouter()
  const { initPaymentSheet, presentPaymentSheet } = useStripe()
  const { user } = useAuthStore()
  const { selectedClub, setMemberships, setSelectedClub } = useClubStore()
  const currentTier = useMembershipStore((s) => s.tier)
  const fetchMembershipTier = useMembershipStore((s) => s.fetchMembershipTier)

  const effectiveClubId = paramClubId || selectedClub?.id
  const isJoining = joining === '1'

  const [tier, setTier] = useState(null)
  const [loadingTier, setLoadingTier] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!tierId) return
    const load = async () => {
      setLoadingTier(true)
      setFetchError('')
      try {
        const { data, error: tErr } = await supabase
          .from('membership_tiers')
          .select('id, club_id, name, description, discount_percent, can_book_free, color, is_paid, monthly_price_cents, is_default, benefits')
          .eq('id', tierId)
          .single()

        if (tErr) throw tErr
        setTier(data)
      } catch (err) {
        console.error('Error loading tier:', err)
        setFetchError(err.message || 'Failed to load tier')
      } finally {
        setLoadingTier(false)
      }
    }
    load()
  }, [tierId])

  const handleSubscribe = async () => {
    if (submitting) return
    if (!user?.id) {
      setError('You must be signed in to subscribe.')
      return
    }
    if (!effectiveClubId) {
      setError('No club selected. Please choose a club first.')
      return
    }
    if (!tier?.id) {
      setError('Tier not loaded.')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      const { data: subData, error: fnError } = await supabase.functions.invoke(
        'create-tier-subscription',
        {
          body: {
            user_id: user.id,
            club_id: effectiveClubId,
            tier_id: tier.id,
          },
        }
      )

      const subResult = subData || fnError
      if (subResult?.error) throw new Error(subResult.error)
      if (!subData?.client_secret) {
        throw new Error('Subscription service error: ' + JSON.stringify(subResult))
      }

      const { client_secret: clientSecret } = subData

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'RecReserve',
      })
      if (initError) throw new Error(initError.message)

      const { error: paymentError } = await presentPaymentSheet()
      if (paymentError) {
        if (paymentError.code === 'Canceled') {
          setSubmitting(false)
          return
        }
        throw new Error(paymentError.message)
      }

      // Refresh the membership store so UI reflects new tier
      await fetchMembershipTier(user.id, effectiveClubId)

      // If this was a join flow, also refresh memberships list and set selected club / primary club
      if (isJoining) {
        const next = await refreshMembershipsList(user.id, setMemberships)
        const joined = next.find((m) => m.club_id === effectiveClubId)
        if (joined?.club) {
          setSelectedClub(joined.club)
        }
        // Best-effort update primary club on user profile (only if not already set)
        try {
          await supabase
            .from('users')
            .update({ club_id: effectiveClubId })
            .eq('id', user.id)
            .is('club_id', null)
        } catch (e) {
          console.warn('Could not sync primary club:', e)
        }
      }

      Alert.alert(
        isJoining ? 'Joined!' : 'Subscribed!',
        isJoining
          ? `You are now a member on the ${tier.name} tier.`
          : `You're now on the ${tier.name} tier.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to memberships view
              router.replace('/(tabs)')
            },
          },
        ]
      )
    } catch (err) {
      console.error('Subscribe error:', err)
      setError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingTier) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (fetchError || !tier) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.neutral400} />
        <Text style={styles.emptyTitle}>Tier unavailable</Text>
        <Text style={styles.errorSubtitle}>{fetchError || 'Could not load tier.'}</Text>
        <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const priceLabel = tier.is_paid ? `${formatPrice(tier.monthly_price_cents)}/month` : 'Free'

  // Admin-configured benefits take priority; fall back to the auto-computed line.
  const customBenefits = Array.isArray(tier.benefits)
    ? tier.benefits.filter(Boolean)
    : []
  const benefits = []
  if (customBenefits.length > 0) {
    benefits.push(...customBenefits)
  } else {
    if (tier.can_book_free) benefits.push('Free court bookings — no fees')
    else if (tier.discount_percent > 0) benefits.push(`${tier.discount_percent}% off all bookings`)
    else benefits.push('Standard pricing')
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Upgrade Membership</Text>
        </View>

        {/* Summary card */}
        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>FROM</Text>
              <Text style={styles.summaryValue}>
                {currentTier?.name || 'No tier'}
              </Text>
              <Text style={styles.summarySubvalue}>
                {currentTier?.is_paid
                  ? `${formatPrice(currentTier.monthly_price_cents)}/month`
                  : 'Free'}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={24} color={colors.primary} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>TO</Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>{tier.name}</Text>
              <Text style={[styles.summarySubvalue, { color: colors.primary, fontWeight: fontWeights.bold }]}>
                {priceLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Tier details */}
        <View style={styles.card}>
          <View style={styles.tierHeader}>
            <View style={[styles.tierDot, { backgroundColor: tier.color || colors.primary }]} />
            <Text style={styles.tierName}>{tier.name}</Text>
          </View>

          {tier.description ? (
            <Text style={styles.description}>{tier.description}</Text>
          ) : null}

          <View style={styles.divider} />
          <Text style={styles.benefitsTitle}>What you get</Text>
          {benefits.map((b, idx) => (
            <View key={idx} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </View>

        {/* Info / policy */}
        <View style={styles.policyCard}>
          <Text style={styles.policyTitle}>Subscription Details</Text>
          <View style={styles.policyDivider} />
          <View style={styles.policyRow}>
            <Ionicons name="card-outline" size={16} color={colors.neutral500} />
            <Text style={styles.policyText}>
              {`You'll be charged ${priceLabel} recurring. Next renewal is automatic.`}
            </Text>
          </View>
          <View style={styles.policyRow}>
            <Ionicons name="close-circle-outline" size={16} color={colors.neutral500} />
            <Text style={styles.policyText}>
              Cancel anytime from the Memberships tab. You keep access until the end of the current period.
            </Text>
          </View>
          <View style={styles.policyRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.neutral500} />
            <Text style={styles.policyText}>
              Payments are processed securely via Stripe.
            </Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <View style={styles.errorHeader}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={styles.errorTitle}>Subscription Failed</Text>
            </View>
            <Text style={styles.errorMessage}>{error}</Text>
            <Text style={styles.errorHint}>
              Please try again or contact support if the problem continues.
            </Text>
          </View>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Fixed bottom button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmButton, submitting && styles.buttonDisabled]}
          onPress={handleSubscribe}
          disabled={submitting || !tier?.is_paid}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.confirmButtonText}>
              {tier.is_paid
                ? `Subscribe & Pay ${formatPrice(tier.monthly_price_cents)}/month`
                : 'Free tier (no payment needed)'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 60 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing['3xl'],
    gap: spacing.sm,
  },
  header: { paddingHorizontal: layout.screenPaddingH, marginBottom: spacing.lg },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.base },
  backText: { fontSize: fontSizes.base, color: colors.primary, fontWeight: fontWeights.semibold },
  title: { fontSize: 22, fontWeight: fontWeights.bold, color: colors.neutral900 },

  card: {
    marginHorizontal: layout.screenPaddingH,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: layout.cardPaddingLg,
    borderWidth: 1,
    borderColor: colors.neutral100,
    marginBottom: layout.itemGap,
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryCol: { flex: 1 },
  summaryLabel: {
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: colors.neutral400,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.neutral900,
  },
  summarySubvalue: {
    fontSize: fontSizes.sm,
    color: colors.neutral500,
    marginTop: 2,
  },

  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  tierDot: { width: 14, height: 14, borderRadius: 7 },
  tierName: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.neutral900,
  },
  description: {
    ...textStyles.body,
    color: colors.neutral600,
    marginTop: spacing.sm,
  },
  divider: { height: 1, backgroundColor: colors.neutral100, marginVertical: spacing.base },
  benefitsTitle: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.neutral900,
    marginBottom: spacing.sm,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  benefitText: {
    flex: 1,
    ...textStyles.bodySmall,
    color: colors.neutral700,
    fontSize: fontSizes.base,
  },

  policyCard: {
    marginHorizontal: layout.screenPaddingH,
    backgroundColor: colors.primarySurface,
    borderRadius: borderRadius.xl,
    padding: layout.cardPaddingLg,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    marginBottom: layout.itemGap,
  },
  policyTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.neutral900 },
  policyDivider: { height: 1, backgroundColor: colors.neutral100, marginVertical: spacing.base },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  policyText: { flex: 1, fontSize: 13, color: colors.neutral600, lineHeight: 18 },

  errorContainer: {
    marginHorizontal: layout.screenPaddingH,
    marginTop: spacing.xs,
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
    padding: 14,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.error },
  errorMessage: { color: colors.error, fontSize: 14, flex: 1 },
  errorHint: { fontSize: 12, color: colors.neutral500, marginTop: spacing.sm, fontStyle: 'italic' },

  emptyTitle: { fontSize: 18, fontWeight: fontWeights.semibold, color: colors.neutral900 },
  errorSubtitle: { fontSize: 14, color: colors.neutral400, textAlign: 'center' },
  goBackBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  goBackText: { color: colors.white, fontSize: fontSizes.base, fontWeight: fontWeights.semibold },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral100,
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.base,
    paddingBottom: 34,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: 18,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  confirmButtonText: { color: colors.white, fontSize: fontSizes.md, fontWeight: fontWeights.bold },
})
