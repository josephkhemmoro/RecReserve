import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

export function LookingForPlayersButton({ activeSpotCount, onPress }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🤝</Text>
        <Text style={styles.text}>Looking for Players</Text>
      </View>
      {activeSpotCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{activeSpotCount} open</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emoji: {
    fontSize: 20,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  badge: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
})
