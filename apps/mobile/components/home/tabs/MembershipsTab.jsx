import { View, Text, StyleSheet } from 'react-native'
import { colors, textStyles, spacing, borderRadius } from '../../../theme'
import { Icon, Badge } from '../../ui'

export function MembershipsTab({ userTier, tiers }) {
  return (
    <View style={styles.container}>
      {/* Current Membership */}
      <View style={styles.currentCard}>
        <Text style={styles.currentLabel}>YOUR MEMBERSHIP</Text>
        {userTier ? (
          <View style={styles.tierRow}>
            <View style={[styles.dot, { backgroundColor: userTier.color || colors.primary }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.tierName}>{userTier.name}</Text>
              <Text style={styles.tierBenefit}>
                {userTier.can_book_free ? 'Books free — no court fees' :
                  userTier.discount_percent > 0 ? `${userTier.discount_percent}% off all court bookings` :
                  'Standard pricing'}
              </Text>
            </View>
            <Badge label="Current" variant="brand" size="sm" />
          </View>
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
            let benefitText = 'Standard pricing'
            if (tier.can_book_free) benefitText = 'Books free — no court fees'
            else if (tier.discount_percent > 0) benefitText = `${tier.discount_percent}% off all court bookings`

            return (
              <View key={tier.id} style={[styles.tierCard, isCurrent && styles.tierCardCurrent]}>
                <Text style={styles.tierCardName}>{tier.name}</Text>
                <Text style={styles.tierCardBenefit}>{benefitText}</Text>
                <View style={styles.divider} />
                <Text style={styles.viewDetails}>View details</Text>
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

  currentCard: {
    backgroundColor: colors.primarySurface, borderRadius: borderRadius.lg,
    padding: spacing.base, marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.primaryMuted,
  },
  currentLabel: { fontSize: 10, fontWeight: '700', color: colors.neutral400, letterSpacing: 1, marginBottom: spacing.sm },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  tierName: { ...textStyles.bodyMedium, color: colors.neutral900 },
  tierBenefit: { ...textStyles.caption, color: colors.neutral500, marginTop: 2 },
  standardText: { ...textStyles.bodySmall, color: colors.neutral600 },

  sectionTitle: { ...textStyles.heading4, color: colors.neutral900, marginBottom: spacing.md },

  tierCard: {
    borderWidth: 1, borderColor: colors.neutral200, borderRadius: borderRadius.lg,
    padding: spacing.base, marginBottom: spacing.md,
  },
  tierCardCurrent: { borderColor: colors.primary, borderWidth: 1.5 },
  tierCardName: { ...textStyles.bodyMedium, color: colors.neutral900, marginBottom: spacing.xs },
  tierCardBenefit: { ...textStyles.bodySmall, color: colors.neutral500 },
  divider: { height: 1, backgroundColor: colors.neutral100, marginVertical: spacing.md },
  viewDetails: { ...textStyles.bodySmall, color: colors.neutral500, textAlign: 'center' },
})
