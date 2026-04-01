import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Icon, Avatar, Button } from '../ui'

export function ClubProfileHeader({ club, courtCount, memberCount, isMember, onJoin }) {
  return (
    <View style={styles.container}>
      <Avatar uri={club.logo_url} name={club.name || '?'} size="lg" />

      <Text style={styles.clubName}>{club.name}</Text>

      {club.location && (
        <View style={styles.locationRow}>
          <Icon name="location-outline" size="sm" color={colors.neutral500} />
          <Text style={styles.locationText}>{club.location}</Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.stat}><Icon name="grid-outline" size="sm" color={colors.neutral500} /><Text style={styles.statText}>{courtCount} Courts</Text></View>
        <Text style={styles.statDivider}>·</Text>
        <View style={styles.stat}><Icon name="people-outline" size="sm" color={colors.neutral500} /><Text style={styles.statText}>{memberCount} Members</Text></View>
      </View>

      {isMember ? (
        <View style={styles.memberBadge}><Icon name="checkmark-circle" size="sm" color={colors.success} /><Text style={styles.memberText}>Member</Text></View>
      ) : onJoin ? (
        <Button title="Join This Club" onPress={onJoin} variant="primary" size="md" icon="add-circle-outline" />
      ) : null}

      {(club.phone || club.website) && (
        <View style={styles.contactRow}>
          {club.phone && (
            <TouchableOpacity style={styles.contactItem} onPress={() => Linking.openURL(`tel:${club.phone}`)}>
              <Icon name="call-outline" size="sm" color={colors.primary} /><Text style={styles.contactLink}>{club.phone}</Text>
            </TouchableOpacity>
          )}
          {club.website && (
            <TouchableOpacity style={styles.contactItem} onPress={() => Linking.openURL(club.website)}>
              <Icon name="globe-outline" size="sm" color={colors.primary} /><Text style={styles.contactLink} numberOfLines={1}>{club.website.replace(/^https?:\/\//, '')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {club.description && <Text style={styles.description}>{club.description}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  clubName: { ...textStyles.heading2, color: colors.neutral900, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.xs },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  locationText: { ...textStyles.bodySmall, color: colors.neutral500 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.base },
  stat: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statText: { ...textStyles.label, color: colors.neutral600 },
  statDivider: { color: colors.neutral300 },
  memberBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.successLight, borderRadius: borderRadius.full, paddingHorizontal: spacing.base, paddingVertical: spacing.sm, marginBottom: spacing.base },
  memberText: { ...textStyles.label, color: colors.success },
  contactRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.md },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  contactLink: { ...textStyles.bodySmall, color: colors.primary, fontWeight: '500' },
  description: { ...textStyles.bodySmall, color: colors.neutral500, lineHeight: 20, textAlign: 'center' },
})
