import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { useRewardsStore } from '../../store/rewardsStore'
import { colors, textStyles, spacing, borderRadius, shadows, fontSizes, fontWeights } from '../../theme'
import { Icon } from '../../components/ui'

const TABS = [
  { key: 'available', label: 'Available' },
  { key: 'redeemed', label: 'Redeemed' },
  { key: 'expired', label: 'Expired' },
]

const TYPE_ICONS = {
  discount_percent: { name: 'pricetag', color: colors.primary, bg: colors.primarySurface },
  free_booking: { name: 'ribbon', color: colors.success, bg: colors.successLight },
  bonus_credit: { name: 'wallet', color: colors.accent, bg: colors.accentMuted },
}

function formatRewardValue(reward) {
  switch (reward.reward_type) {
    case 'discount_percent':
      return `${reward.reward_value}% off your next booking`
    case 'free_booking':
      return 'One free court booking'
    case 'bonus_credit': {
      const dollars = (Number(reward.reward_value) || 0) / 100
      const pretty = dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`
      return `${pretty} account credit`
    }
    default:
      return ''
  }
}

function formatMilestone(milestone) {
  if (!milestone) return ''
  return `Earned at your ${milestone}-week streak`
}

function formatRedeemedDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function expirationLabel(expiresAt) {
  if (!expiresAt) return { label: 'Never expires', urgent: false }
  const now = Date.now()
  const exp = new Date(expiresAt).getTime()
  const msLeft = exp - now
  if (msLeft <= 0) return { label: 'Expired', urgent: true }
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
  if (daysLeft === 1) return { label: 'Expires tomorrow', urgent: true }
  if (daysLeft <= 3) return { label: `Expires in ${daysLeft} days`, urgent: true }
  return { label: `Expires in ${daysLeft} days`, urgent: false }
}

function RewardCard({ reward, variant }) {
  const iconCfg = TYPE_ICONS[reward.reward_type] || { name: 'gift', color: colors.primary, bg: colors.primarySurface }
  const value = formatRewardValue(reward)
  const dimmed = variant === 'expired' || variant === 'redeemed'

  let footerLabel = null
  let footerUrgent = false
  if (variant === 'redeemed') {
    footerLabel = `Redeemed on ${formatRedeemedDate(reward.redeemed_at)}`
  } else if (variant === 'expired') {
    footerLabel = `Expired ${formatRedeemedDate(reward.expires_at)}`
  } else {
    const { label, urgent } = expirationLabel(reward.expires_at)
    if (label !== 'Never expires') {
      footerLabel = label
      footerUrgent = urgent
    }
  }

  return (
    <View style={[styles.card, dimmed && styles.cardDimmed]}>
      <View style={styles.cardTopRow}>
        <View style={[styles.typeIcon, { backgroundColor: iconCfg.bg }]}>
          <Icon name={iconCfg.name} size="md" color={iconCfg.color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{reward.title || 'Reward'}</Text>
          <Text style={styles.cardValue}>{value}</Text>
          {reward.description ? (
            <Text style={styles.cardDescription} numberOfLines={3}>
              {reward.description}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardMilestone}>{formatMilestone(reward.milestone)}</Text>
        {footerLabel ? (
          <Text
            style={[
              styles.cardExpiration,
              footerUrgent && styles.cardExpirationUrgent,
              variant === 'redeemed' && styles.cardExpirationRedeemed,
            ]}
          >
            {footerLabel}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

export default function RewardsScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const {
    rewards,
    loading,
    fetchRewards,
    availableRewards,
    redeemedRewards,
    expiredRewards,
  } = useRewardsStore()

  const [activeTab, setActiveTab] = useState('available')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (user?.id && selectedClub?.id) {
      fetchRewards(user.id, selectedClub.id)
    }
  }, [user?.id, selectedClub?.id])

  const onRefresh = useCallback(async () => {
    if (!user?.id || !selectedClub?.id) return
    setRefreshing(true)
    await fetchRewards(user.id, selectedClub.id)
    setRefreshing(false)
  }, [user?.id, selectedClub?.id])

  const buckets = useMemo(() => {
    return {
      available: availableRewards(),
      redeemed: redeemedRewards(),
      expired: expiredRewards(),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewards])

  const currentList = buckets[activeTab] || []

  const renderEmptyState = () => {
    if (activeTab === 'available') {
      return (
        <View style={styles.emptyState}>
          <Icon name="gift-outline" size="lg" color={colors.neutral300} />
          <Text style={styles.emptyTitle}>No rewards yet</Text>
          <Text style={styles.emptySubtitle}>
            Keep your streak going! Rewards unlock at 4, 8, 12, 26, and 52 week milestones.
          </Text>
        </View>
      )
    }
    if (activeTab === 'redeemed') {
      return (
        <View style={styles.emptyState}>
          <Icon name="checkmark-done-outline" size="lg" color={colors.neutral300} />
          <Text style={styles.emptyTitle}>No redeemed rewards</Text>
          <Text style={styles.emptySubtitle}>
            Once you use a reward at checkout, it will appear here.
          </Text>
        </View>
      )
    }
    return (
      <View style={styles.emptyState}>
        <Icon name="time-outline" size="lg" color={colors.neutral300} />
        <Text style={styles.emptyTitle}>No expired rewards</Text>
        <Text style={styles.emptySubtitle}>
          Rewards you don't use before their expiration will show up here.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Icon name="arrow-back" size="md" color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rewards</Text>
        <Text style={styles.headerSubtitle}>
          Milestone rewards earned from your play streak
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const count = (buckets[tab.key] || []).length
          const isActive = activeTab === tab.key
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
                {count > 0 ? ` (${count})` : ''}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          (loading || currentList.length === 0) && { flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {loading && rewards.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : currentList.length === 0 ? (
          renderEmptyState()
        ) : (
          currentList.map((reward) => (
            <RewardCard key={reward.id} reward={reward} variant={activeTab} />
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.base,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.base,
  },
  backText: {
    fontSize: fontSizes.base,
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  headerTitle: { ...textStyles.heading2, color: colors.neutral900 },
  headerSubtitle: {
    ...textStyles.bodySmall,
    color: colors.neutral500,
    marginTop: spacing.xs,
  },

  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral100,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...textStyles.label,
    color: colors.neutral600,
  },
  tabTextActive: {
    color: colors.white,
  },

  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral100,
    ...shadows.sm,
  },
  cardDimmed: {
    opacity: 0.7,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardContent: { flex: 1 },
  cardTitle: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.neutral900,
    marginBottom: 2,
  },
  cardValue: {
    ...textStyles.bodyMedium,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  cardDescription: {
    ...textStyles.bodySmall,
    color: colors.neutral500,
    lineHeight: 18,
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral100,
    gap: spacing.sm,
  },
  cardMilestone: {
    ...textStyles.caption,
    color: colors.neutral500,
    flex: 1,
  },
  cardExpiration: {
    ...textStyles.caption,
    color: colors.neutral500,
  },
  cardExpirationUrgent: {
    color: colors.error,
    fontWeight: fontWeights.bold,
  },
  cardExpirationRedeemed: {
    color: colors.success,
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['3xl'],
    gap: spacing.sm,
  },
  emptyTitle: {
    ...textStyles.bodyMedium,
    color: colors.neutral700,
  },
  emptySubtitle: {
    ...textStyles.bodySmall,
    color: colors.neutral400,
    textAlign: 'center',
    lineHeight: 20,
  },
})
