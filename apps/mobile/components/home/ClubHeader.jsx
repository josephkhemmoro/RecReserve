import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Icon, Avatar } from '../ui'

export function ClubHeader({ club, unreadCount, onOpenClubPicker }) {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Avatar uri={club?.logo_url} name={club?.name || '?'} size="sm" />
        <Text style={styles.clubName} numberOfLines={1}>{club?.name || 'RecReserve'}</Text>
      </View>
      <View style={styles.right}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/notifications')} style={styles.iconBtn}>
          <Icon name="notifications-outline" size="md" color={colors.neutral800} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={onOpenClubPicker} style={styles.iconBtn}>
          <Icon name="chevron-down" size="sm" color={colors.neutral500} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 54, paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.neutral100,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, marginRight: spacing.md },
  clubName: { ...textStyles.heading4, color: colors.neutral900, flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  iconBtn: { position: 'relative', padding: spacing.xs },
  badge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: colors.accent, borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: colors.white },
})
