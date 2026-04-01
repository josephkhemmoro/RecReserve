import { View, Text, StyleSheet } from 'react-native'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Icon, Button } from '../ui'

export function MembersOnlyGate({ isMember, clubName, onJoin, children }) {
  if (isMember) return children

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Icon name="lock-closed-outline" size="lg" color={colors.neutral300} />
        <Text style={styles.title}>Members Only</Text>
        <Text style={styles.subtitle}>Join {clubName} to see announcements, events, and club activity.</Text>
        {onJoin && <Button title="Join This Club" onPress={onJoin} variant="primary" size="md" icon="add-circle-outline" />}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  card: { backgroundColor: colors.neutral50, borderRadius: borderRadius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.neutral200, alignItems: 'center', gap: spacing.sm },
  title: { ...textStyles.heading4, color: colors.neutral800 },
  subtitle: { ...textStyles.bodySmall, color: colors.neutral500, textAlign: 'center', lineHeight: 20 },
})
