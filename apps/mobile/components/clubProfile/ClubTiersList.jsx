import { View, Text, StyleSheet } from 'react-native'

export function ClubTiersList({ tiers }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Membership Options</Text>

      {!tiers || tiers.length === 0 ? (
        <Text style={styles.emptyText}>Standard membership — all members book at regular pricing</Text>
      ) : (
        <View style={styles.list}>
          {tiers.map((tier) => {
            let benefitText = 'Regular pricing'
            if (tier.can_book_free) benefitText = 'Books free — no court fees'
            else if (tier.discount_percent > 0) benefitText = `${tier.discount_percent}% off all court bookings`

            return (
              <View key={tier.id} style={styles.tierCard}>
                <View style={styles.tierHeader}>
                  <View style={[styles.dot, { backgroundColor: tier.color || '#94a3b8' }]} />
                  <Text style={styles.tierName}>{tier.name}</Text>
                </View>
                <Text style={styles.benefitText}>{benefitText}</Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, marginBottom: 20 },
  title: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#94a3b8' },
  list: { gap: 2 },
  tierCard: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 8,
  },
  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tierName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  benefitText: { fontSize: 13, color: '#64748b', marginLeft: 18 },
})
