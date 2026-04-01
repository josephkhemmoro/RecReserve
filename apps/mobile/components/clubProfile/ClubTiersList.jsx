import { View, Text, StyleSheet } from 'react-native'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { SectionHeader, Icon } from '../ui'

export function ClubTiersList({ tiers }) {
  return (
    <View style={styles.container}>
      <SectionHeader title="Membership Options" icon="pricetag-outline" />

      {!tiers || tiers.length === 0 ? (
        <Text style={styles.emptyText}>Standard membership — all members book at regular pricing</Text>
      ) : (
        <View style={styles.list}>
          {tiers.map((tier) => {
            let benefitText = 'Regular pricing'
            let benefitIcon = 'card-outline'
            if (tier.can_book_free) { benefitText = 'Books free — no court fees'; benefitIcon = 'checkmark-circle' }
            else if (tier.discount_percent > 0) { benefitText = `${tier.discount_percent}% off all court bookings`; benefitIcon = 'pricetag' }
            return (
              <View key={tier.id} style={styles.tierCard}>
                <View style={styles.tierHeader}>
                  <View style={[styles.dot, { backgroundColor: tier.color || colors.neutral400 }]} />
                  <Text style={styles.tierName}>{tier.name}</Text>
                </View>
                <View style={styles.benefitRow}>
                  <Icon name={benefitIcon} size="sm" color={colors.neutral500} />
                  <Text style={styles.benefitText}>{benefitText}</Text>
                </View>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  emptyText: { ...textStyles.bodySmall, color: colors.neutral400 },
  list: { gap: spacing.sm },
  tierCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.base, borderWidth: 1, borderColor: colors.neutral100 },
  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tierName: { ...textStyles.bodyMedium, color: colors.neutral900 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: spacing.lg },
  benefitText: { ...textStyles.bodySmall, color: colors.neutral500 },
})
