import { View, Text, StyleSheet } from 'react-native'

export function KudosBadge({ count }) {
  if (count === 0) return null

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>🤝 {count} kudos</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 138, 101, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF8A65',
  },
})
