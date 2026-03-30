import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'

const ACTIONS = [
  { key: 'book', emoji: '🎾', label: 'Book', route: '/courts' },
  { key: 'players', emoji: '🤝', label: 'Players', route: '/players' },
  { key: 'events', emoji: '📅', label: 'Events', route: null }, // will navigate to club profile
]

export function ActionRow({ clubId }) {
  const router = useRouter()

  if (!clubId) return null

  return (
    <View style={styles.container}>
      {ACTIONS.map((action) => (
        <TouchableOpacity
          key={action.key}
          style={styles.button}
          onPress={() => {
            if (action.route) {
              router.push(action.route)
            } else {
              router.push(`/club/${clubId}`)
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.emoji}>{action.emoji}</Text>
          <Text style={styles.label}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  button: {
    flex: 1,
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  emoji: { fontSize: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
})
