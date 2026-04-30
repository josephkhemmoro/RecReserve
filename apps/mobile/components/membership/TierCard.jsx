import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, textStyles, spacing, borderRadius, fontSizes, fontWeights } from '../../theme'
import { Badge } from '../ui'

function formatPrice(cents) {
  if (!cents || cents <= 0) return 'Free'
  const dollars = cents / 100
  // Show whole dollars if divisible, else 2 decimals
  if (dollars % 1 === 0) return `$${dollars}/month`
  return `$${dollars.toFixed(2)}/month`
}

// Fallback one-liner when the admin hasn't added any custom benefits.
function getFallbackBenefit(tier) {
  if (tier?.can_book_free) return 'Books free — no court fees'
  if (tier?.discount_percent > 0) return `${tier.discount_percent}% off all court bookings`
  return 'Standard pricing'
}

export function TierCard({ tier, isCurrent = false, isDefault = false, onPress, style }) {
  if (!tier) return null

  const priceLabel = tier.is_paid ? formatPrice(tier.monthly_price_cents) : 'Free'
  const benefits = Array.isArray(tier.benefits) ? tier.benefits.filter(Boolean) : []
  const hasBenefits = benefits.length > 0
  const accentColor = tier.color || colors.primary

  const content = (
    <View style={[styles.card, isCurrent && styles.cardCurrent, style]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.dot, { backgroundColor: accentColor }]} />
          <Text style={styles.name}>{tier.name}</Text>
        </View>
        {isCurrent ? (
          <Badge label="Current" variant="primary" size="sm" />
        ) : isDefault ? (
          <Badge label="Default" variant="default" size="sm" />
        ) : tier.is_paid ? (
          <Badge label="Paid" variant="info" size="sm" />
        ) : null}
      </View>

      <Text style={styles.price}>{priceLabel}</Text>

      {tier.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {tier.description}
        </Text>
      ) : null}

      {hasBenefits ? (
        <View style={styles.benefitsList}>
          {benefits.slice(0, 3).map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              <Text style={styles.benefitCheck}>✓</Text>
              <Text style={styles.benefitItem} numberOfLines={1}>
                {b}
              </Text>
            </View>
          ))}
          {benefits.length > 3 ? (
            <Text style={styles.benefitMore}>+{benefits.length - 3} more</Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.benefit}>{getFallbackBenefit(tier)}</Text>
      )}

      <View style={styles.divider} />
      <Text style={styles.viewDetails}>View details</Text>
    </View>
  )

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    )
  }
  return content
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
    backgroundColor: colors.white,
  },
  cardCurrent: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: colors.primarySurface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: {
    ...textStyles.bodyMedium,
    color: colors.neutral900,
    fontWeight: fontWeights.semibold,
    fontSize: fontSizes.md,
  },
  price: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.neutral900,
    marginTop: spacing.xs,
  },
  description: {
    ...textStyles.bodySmall,
    color: colors.neutral600,
    marginTop: spacing.xs,
  },
  benefit: {
    ...textStyles.bodySmall,
    color: colors.neutral500,
    marginTop: spacing.xs,
  },
  benefitsList: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  benefitCheck: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    lineHeight: 18,
  },
  benefitItem: {
    ...textStyles.bodySmall,
    color: colors.neutral700,
    flex: 1,
  },
  benefitMore: {
    ...textStyles.bodySmall,
    color: colors.neutral400,
    fontStyle: 'italic',
    marginTop: 2,
  },
  divider: { height: 1, backgroundColor: colors.neutral100, marginVertical: spacing.md },
  viewDetails: {
    ...textStyles.bodySmall,
    color: colors.primary,
    textAlign: 'center',
    fontWeight: fontWeights.semibold,
  },
})
