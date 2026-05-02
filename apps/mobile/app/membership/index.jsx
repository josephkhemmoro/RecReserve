import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { useMembershipStore } from '../../store/membershipStore'
import { colors, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Badge, Button } from '../../components/ui'

function formatPrice(cents) {
  if (!cents || cents <= 0) return 'Free'
  const dollars = cents / 100
  if (dollars % 1 === 0) return `$${dollars}/mo`
  return `$${dollars.toFixed(2)}/mo`
}

function getFallbackBenefit(tier) {
  if (tier?.can_book_free) return 'Book courts for free'
  if (tier?.discount_percent > 0) return `${tier.discount_percent}% off court bookings`
  return 'Standard court pricing'
}

export default function MembershipTiersScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const currentTier = useMembershipStore((s) => s.tier)

  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { fetchTiers() }, [selectedClub?.id])

  const fetchTiers = async () => {
    if (!selectedClub?.id) return
    try {
      const { data, error } = await supabase
        .from('membership_tiers')
        .select('id, name, description, is_paid, monthly_price_cents, discount_percent, can_book_free, color, benefits, is_default, sort_order')
        .eq('club_id', selectedClub.id)
        .order('monthly_price_cents', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true, nullsFirst: true })
      if (error) throw error
      setTiers(data || [])
    } catch (err) {
      console.error('Error loading tiers:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleSelect = (tier) => {
    if (tier.id === currentTier?.id) {
      // Already on this tier — go to detail
      router.push(`/membership/detail/${tier.id}`)
    } else {
      // Go to upgrade/change flow
      router.push(`/membership/upgrade/${tier.id}`)
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size="md" color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Membership Plans</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchTiers() }}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.subtitle}>
          Choose a plan for {selectedClub?.name || 'your club'}. You can change anytime.
        </Text>

        {tiers.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="card-outline" size="lg" color={colors.neutral300} />
            <Text style={styles.emptyTitle}>No plans available</Text>
            <Text style={styles.emptySubtitle}>This club hasn't set up membership tiers yet.</Text>
          </View>
        ) : (
          <View style={styles.tierList}>
            {tiers.map((tier) => {
              const isCurrent = tier.id === currentTier?.id
              const accentColor = tier.color || colors.primary
              const priceLabel = tier.is_paid ? formatPrice(tier.monthly_price_cents) : 'Free'
              const benefits = Array.isArray(tier.benefits) && tier.benefits.length > 0
                ? tier.benefits
                : [getFallbackBenefit(tier)]

              return (
                <TouchableOpacity
                  key={tier.id}
                  style={[
                    styles.tierCard,
                    isCurrent && styles.tierCardCurrent,
                    isCurrent && { borderColor: accentColor },
                  ]}
                  onPress={() => handleSelect(tier)}
                  activeOpacity={0.7}
                >
                  {/* Header row: name + price */}
                  <View style={styles.tierHeader}>
                    <View style={styles.tierNameRow}>
                      <View style={[styles.tierDot, { backgroundColor: accentColor }]} />
                      <Text style={styles.tierName}>{tier.name}</Text>
                      {isCurrent && <Badge label="Current" variant="brand" size="sm" />}
                      {!isCurrent && tier.is_default && <Badge label="Default" variant="default" size="sm" />}
                    </View>
                    <Text style={[styles.tierPrice, tier.is_paid && { color: colors.neutral900 }]}>
                      {priceLabel}
                    </Text>
                  </View>

                  {/* Description */}
                  {tier.description ? (
                    <Text style={styles.tierDescription} numberOfLines={2}>{tier.description}</Text>
                  ) : null}

                  {/* Benefits */}
                  <View style={styles.benefitsList}>
                    {benefits.slice(0, 4).map((b, i) => (
                      <View key={i} style={styles.benefitRow}>
                        <Icon name="checkmark-circle" size="sm" color={colors.success} />
                        <Text style={styles.benefitText}>{b}</Text>
                      </View>
                    ))}
                    {benefits.length > 4 && (
                      <Text style={styles.benefitMore}>+{benefits.length - 4} more benefits</Text>
                    )}
                  </View>

                  {/* Action */}
                  <View style={styles.tierAction}>
                    {isCurrent ? (
                      <View style={styles.currentBadgeRow}>
                        <Icon name="checkmark-circle" size="sm" color={colors.success} />
                        <Text style={styles.currentText}>Your current plan</Text>
                      </View>
                    ) : (
                      <View style={[styles.selectBtn, { backgroundColor: accentColor + '15' }]}>
                        <Text style={[styles.selectBtnText, { color: accentColor }]}>
                          {tier.is_paid ? `Select — ${priceLabel}` : 'Switch to Free'}
                        </Text>
                        <Icon name="arrow-forward" size="sm" color={accentColor} />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 70 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral900,
    textAlign: 'center',
    marginHorizontal: spacing.md,
  },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  subtitle: {
    fontSize: 14,
    color: colors.neutral500,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.neutral900 },
  emptySubtitle: { fontSize: 13, color: colors.neutral500, textAlign: 'center' },
  tierList: { gap: spacing.md },
  tierCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.neutral100,
    ...shadows.sm,
  },
  tierCardCurrent: {
    borderWidth: 2,
    ...shadows.md,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  tierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
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
  },
  tierPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.success,
  },
  tierDescription: {
    fontSize: 13,
    color: colors.neutral600,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  benefitsList: {
    gap: 6,
    marginBottom: spacing.md,
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
  tierAction: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral100,
  },
  currentBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  currentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  selectBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
})
