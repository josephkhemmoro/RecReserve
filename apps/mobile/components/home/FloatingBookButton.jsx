import { View, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, textStyles, spacing, borderRadius, shadows } from '../../theme'
import { Icon } from '../ui'

export function FloatingBookButton() {
  const router = useRouter()

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity style={styles.button} onPress={() => router.push('/courts')} activeOpacity={0.8}>
        <Icon name="calendar-outline" size="sm" color={colors.white} />
        <Text style={styles.text}>Book now</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 34,
    backgroundColor: colors.white,
  },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
    paddingVertical: spacing.base,
    ...shadows.md,
  },
  text: { ...textStyles.button, color: colors.white },
})
