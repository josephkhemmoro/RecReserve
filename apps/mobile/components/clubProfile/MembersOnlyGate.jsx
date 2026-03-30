import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'

export function MembersOnlyGate({ isMember, clubName, onJoin, children }) {
  if (isMember) return children

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="lock-closed-outline" size={32} color="#94a3b8" />
        <Text style={styles.title}>Members Only</Text>
        <Text style={styles.subtitle}>
          Join {clubName} to see announcements, events, and club activity.
        </Text>
        {onJoin && (
          <TouchableOpacity style={styles.joinButton} onPress={onJoin}>
            <Text style={styles.joinText}>Join This Club</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, marginBottom: 20 },
  card: {
    backgroundColor: '#f8fafc', borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', gap: 8,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  joinButton: {
    backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8,
  },
  joinText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
})
