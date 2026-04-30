import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useClubStore } from '../../../store/clubStore'
import { useMembershipStore } from '../../../store/membershipStore'
import { colors, spacing, borderRadius, fontSizes, fontWeights, layout, textStyles } from '../../../theme'
import { Badge } from '../../../components/ui'

function formatPrice(cents) {
  if (!cents || cents <= 0) return 'Free'
  const dollars = cents / 100
  if (dollars % 1 === 0) return `$${dollars}`
  return `$${dollars.toFixed(2)}`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export default function TierDetailScreen() {
  const { tierId } = useLocalSearchParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const currentTier = useMembershipStore((s) => s.tier)
  const membership = useMembershipStore((s) => s.membership)
  const fetchMembershipTier = useMembershipStore((s) => s.fetchMembershipTier)

  const [tier, setTier] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!tierId) return
    const load = async () => {
      setLoading(true)
      setError('')
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
        setError(err.message || 'Failed to load tier')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tierId])

  const isCurrent = currentTier?.id === tier?.id
  const isPaid = !!tier?.is_paid
  const priceLabel = isPaid ? `${formatPrice(tier?.monthly_price_cents)} per month` : 'Free'

  const handleUpgrade = () => {
    if (!tier?.id) return
    router.push(`/membership/upgrade/${tier.id}`)
  }

  const handleCancel = () => {
    if (!membership?.id) {
      Alert.alert('Not available', 'No active paid subscription found.')
      return
    }
    Alert.alert(
      'Cancel Subscription?',
      `Your ${currentTier?.name || 'paid'} membership will stay active until the end of the current billing period, then drop to the default free tier.`,
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true)
            try {
              const { data, error: cancelErr } = await supabase.functions.invoke(
                'cancel-tier-subscription',
                { body: { membership_id: membership.id } }
              )
              const result = data || null
              if (cancelErr && !result) throw new Error(cancelErr.message || 'Failed to cancel')
              if (result?.error) throw new Error(result.error)

              if (user?.id && selectedClub?.id) {
                await fetchMembershipTier(user.id, selectedClub.id)
              }

              Alert.alert(
                'Subscription Canceled',
                result?.effective_until
                  ? `Active until ${formatDate(result.effective_until)}.`
                  : 'Your subscription has been scheduled to cancel.'
              )
            } catch (err) {
              console.error('Cancel error:', err)
              Alert.alert('Error', err.message || 'Could not cancel subscription.')
            } finally {
              setCancelling(false)
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

  if (error || !tier) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.neutral400} />
        <Text style={styles.emptyTitle}>Tier unavailable</Text>
        <Text style={styles.errorSubtitle}>{error || 'Could not load tier.'}</Text>
        <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Benefits — admin-configured list wins; fall back to auto-computed when empty
  const customBenefits = Array.isArray(tier.benefits)
    ? tier.benefits.filter(Boolean)
    : []
  const benefits = []
  if (customBenefits.length > 0) {
    for (const text of customBenefits) {
      benefits.push({ icon: 'checkmark-circle', text })
    }
  } else {
    if (tier.can_book_free) benefits.push({ icon: 'checkmark-circle', text: 'Free court bookings — no fees' })
    else if (tier.discount_percent > 0) benefits.push({ icon: 'pricetag', text: `${tier.discount_percent}% off all bookings` })
    else benefits.push({ icon: 'pricetag-outline', text: 'Standard pricing' })
  }

  // Guest allowance — only surface from user's membership when viewing their current tier.
  // (membership_tiers doesn't have a guest_allowance column in schema; defaults live on memberships)
  const guestAllowance =
    isCurrent && typeof membership?.guest_allowance === 'number'
      ? membership.guest_allowance
      : null
  if (typeof guestAllowance === 'number' && guestAllowance > 0) {
    benefits.push({
      icon: 'people-outline',
      text: `${guestAllowance} guest ${guestAllowance === 1 ? 'pass' : 'passes'} per month`,
    })
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Tier Details</Text>
        </View>

        {/* Hero card */}
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View style={[styles.tierDot, { backgroundColor: tier.color || colors.primary }]} />
            <Text style={styles.tierName}>{tier.name}</Text>
            {isCurrent ? <Badge label="Your current tier" variant="primary" size="sm" /> : null}
          </View>

          <Text style={styles.price}>{priceLabel}</Text>

          {tier.description ? (
            <Text style={styles.description}>{tier.description}</Text>
          ) : null}
        </View>

        {/* Benefits */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Benefits</Text>
          <View style={styles.divider} />
          {benefits.map((b, idx) => (
            <View key={idx} style={styles.benefitRow}>
              <Ionicons name={b.icon} size={18} color={colors.primary} />
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          ))}
        </View>

        {/* Subscription status if this is current paid tier */}
        {isCurrent && isPaid ? (
          <View style={styles.statusCard}>
            <Text style={styles.sectionTitle}>Subscription</Text>
            <View style={styles.divider} />
            {membership?.current_period_end ? (
              <View style={styles.statusRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.neutral500} />
                <Text style={styles.statusText}>
                  {membership.cancel_at_period_end
                    ? `Ends on ${formatDate(membership.current_period_end)}`
                    : `Renews on ${formatDate(membership.current_period_end)}`}
                </Text>
              </View>
            ) : null}
            {membership?.status ? (
              <View style={styles.statusRow}>
                <Ionicons name="information-circle-outline" size={16} color={colors.neutral500} />
                <Text style={styles.statusText}>
                  Status: {membership.status}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Fixed footer action */}
      <View style={styles.footer}>
        {isCurrent ? (
          isPaid && !membership?.cancel_at_period_end ? (
            <TouchableOpacity
              style={[styles.dangerButton, cancelling && styles.buttonDisabled]}
              onPress={handleCancel}
              disabled={cancelling}
              activeOpacity={0.8}
            >
              {cancelling ? (
                <ActivityIndicator color={colors.error} />
              ) : (
                <Text style={styles.dangerButtonText}>Cancel subscription</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={[styles.infoButton]}>
              <Text style={styles.infoButtonText}>
                {membership?.cancel_at_period_end
                  ? `Cancels on ${formatDate(membership?.current_period_end)}`
                  : 'You are on this tier'}
              </Text>
            </View>
          )
        ) : isPaid ? (
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleUpgrade}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmButtonText}>Upgrade to this tier</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.infoButton}>
            <Text style={styles.infoButtonText}>Free tier</Text>
          </View>
        )}
      </View>
    </View>
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
  statusCard: {
    marginHorizontal: layout.screenPaddingH,
    backgroundColor: colors.primarySurface,
    borderRadius: borderRadius.xl,
    padding: layout.cardPaddingLg,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    marginBottom: layout.itemGap,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  tierDot: { width: 14, height: 14, borderRadius: 7 },
  tierName: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.neutral900,
    flexShrink: 1,
  },
  price: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  description: {
    ...textStyles.body,
    color: colors.neutral600,
    marginTop: spacing.md,
  },

  sectionTitle: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.neutral900,
  },
  divider: { height: 1, backgroundColor: colors.neutral100, marginVertical: spacing.base },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  benefitText: {
    flex: 1,
    fontSize: fontSizes.base,
    color: colors.neutral700,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statusText: {
    ...textStyles.bodySmall,
    color: colors.neutral700,
  },

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
  confirmButtonText: { color: colors.white, fontSize: fontSizes.md, fontWeight: fontWeights.bold },
  dangerButton: {
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: borderRadius.lg,
    padding: 18,
    alignItems: 'center',
  },
  dangerButtonText: { color: colors.error, fontSize: fontSizes.md, fontWeight: fontWeights.bold },
  infoButton: {
    backgroundColor: colors.neutral100,
    borderRadius: borderRadius.lg,
    padding: 18,
    alignItems: 'center',
  },
  infoButtonText: { color: colors.neutral600, fontSize: fontSizes.base, fontWeight: fontWeights.semibold },
  buttonDisabled: { opacity: 0.6 },
})
