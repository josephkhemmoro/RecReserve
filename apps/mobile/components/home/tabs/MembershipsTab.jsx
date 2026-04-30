import { useState } from 'react'
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, textStyles, spacing, borderRadius, fontSizes, fontWeights } from '../../../theme'
import { Icon, Badge } from '../../ui'
import { TierCard } from '../../membership/TierCard'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useClubStore } from '../../../store/clubStore'
import { useMembershipStore } from '../../../store/membershipStore'

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatPriceLabel(tier) {
  if (!tier?.is_paid) return 'Free'
  const cents = tier.monthly_price_cents || 0
  const dollars = cents / 100
  if (dollars % 1 === 0) return `$${dollars}/month`
  return `$${dollars.toFixed(2)}/month`
}

export function MembershipsTab({ userTier, tiers }) {
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const membership = useMembershipStore((s) => s.membership)
  const fetchMembershipTier = useMembershipStore((s) => s.fetchMembershipTier)

  const [cancelling, setCancelling] = useState(false)
  const [pendingTierName, setPendingTierName] = useState(null)

  // Resolve pending tier name from tiers array if available
  const resolvedPendingTierName = pendingTierName ||
    (membership?.pending_tier_id && tiers
      ? tiers.find((t) => t.id === membership.pending_tier_id)?.name
      : null)

  const handleUpgrade = (tier) => {
    router.push(`/membership/upgrade/${tier.id}`)
  }

  const handleTierTap = (tier) => {
    router.push(`/membership/detail/${tier.id}`)
  }

  const handleCancelSubscription = () => {
    if (!membership?.id) {
      Alert.alert('Not available', 'No active paid subscription found.')
      return
    }
    Alert.alert(
      'Cancel Subscription?',
      `Your ${userTier?.name || 'paid'} membership will stay active until the end of the current billing period, then drop to the default free tier.`,
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true)
            try {
              const { data, error } = await supabase.functions.invoke('cancel-tier-subscription', {
                body: { membership_id: membership.id },
              })
              const result = data || null
              if (error && !result) throw new Error(error.message || 'Failed to cancel subscription')
              if (result?.error) throw new Error(result.error)

              const effectiveUntil = result?.effective_until
              const pendingName = result?.pending_tier?.name
              if (pendingName) setPendingTierName(pendingName)

              if (user?.id && selectedClub?.id) {
                await fetchMembershipTier(user.id, selectedClub.id)
              }

              Alert.alert(
                'Subscription Canceled',
                effectiveUntil
                  ? `Active until ${formatDate(effectiveUntil)}.`
                  : 'Your subscription has been scheduled to cancel.'
              )
            } catch (err) {
              console.error('Cancel subscription error:', err)
              Alert.alert('Error', err.message || 'Could not cancel subscription.')
            } finally {
              setCancelling(false)
            }
          },
        },
      ]
    )
  }

  const isPaidMembership = userTier?.is_paid
  const cancelAtPeriodEnd = !!membership?.cancel_at_period_end
  const currentPeriodEnd = membership?.current_period_end

  return (
    <View style={styles.container}>
      {/* Cancellation banner */}
      {isPaidMembership && cancelAtPeriodEnd && currentPeriodEnd ? (
        <View style={styles.cancelBanner}>
          <Icon name="alert-circle" size="sm" color={colors.warning} />
          <Text style={styles.cancelBannerText}>
            {`Your subscription cancels on ${formatDate(currentPeriodEnd)}. You'll drop to ${resolvedPendingTierName || 'the default free tier'}.`}
          </Text>
        </View>
      ) : null}

      {/* Current Membership */}
      <View style={styles.currentCard}>
        <Text style={styles.currentLabel}>YOUR MEMBERSHIP</Text>
        {userTier ? (
          <>
            <View style={styles.tierRow}>
              <View style={[styles.dot, { backgroundColor: userTier.color || colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.tierName}>{userTier.name}</Text>
                <Text style={styles.tierBenefit}>
                  {userTier.can_book_free
                    ? 'Books free — no court fees'
                    : userTier.discount_percent > 0
                      ? `${userTier.discount_percent}% off all court bookings`
                      : 'Standard pricing'}
                </Text>
                <Text style={styles.tierPrice}>{formatPriceLabel(userTier)}</Text>
              </View>
              <Badge label="Current" variant="primary" size="sm" />
            </View>

            {isPaidMembership && !cancelAtPeriodEnd ? (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelSubscription}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Text style={styles.cancelButtonText}>Cancel subscription</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <View style={styles.tierRow}>
            <Icon name="person-outline" size="sm" color={colors.neutral500} />
            <Text style={styles.standardText}>Standard Member — Regular pricing</Text>
          </View>
        )}
      </View>

      {/* All Tiers */}
      {tiers && tiers.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Membership Options</Text>
          {tiers.map((tier) => {
            const isCurrent = userTier?.id === tier.id
            const showUpgradeButton = !isCurrent && tier.is_paid
            return (
              <View key={tier.id} style={styles.tierWrap}>
                <TierCard
                  tier={tier}
                  isCurrent={isCurrent}
                  isDefault={!!tier.is_default}
                  onPress={() => handleTierTap(tier)}
                />
                {showUpgradeButton ? (
                  <TouchableOpacity
                    style={styles.upgradeButton}
                    onPress={() => handleUpgrade(tier)}
                    activeOpacity={0.7}
                  >
                    <Icon name="arrow-up-circle-outline" size="sm" color={colors.white} />
                    <Text style={styles.upgradeButtonText}>
                      {userTier ? 'Upgrade to this tier' : 'Subscribe'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )
          })}
        </>
      )}
      <View style={{ height: 100 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  cancelBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cancelBannerText: {
    flex: 1,
    ...textStyles.bodySmall,
    color: colors.neutral800,
  },

  currentCard: {
    backgroundColor: colors.primarySurface,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  currentLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral400,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  tierName: { ...textStyles.bodyMedium, color: colors.neutral900 },
  tierBenefit: { ...textStyles.caption, color: colors.neutral500, marginTop: 2 },
  tierPrice: {
    ...textStyles.bodySmall,
    color: colors.neutral700,
    fontWeight: fontWeights.semibold,
    marginTop: 2,
  },
  standardText: { ...textStyles.bodySmall, color: colors.neutral600 },

  cancelButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.error,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },

  sectionTitle: { ...textStyles.heading4, color: colors.neutral900, marginBottom: spacing.md },

  tierWrap: { marginBottom: spacing.sm },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  upgradeButtonText: {
    color: colors.white,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
  },
})
