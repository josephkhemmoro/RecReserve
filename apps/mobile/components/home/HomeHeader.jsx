import { useState } from 'react'
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useRouter } from 'expo-router'

function getInitials(name) {
  if (!name) return '?'
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
}

function getGreeting(firstName, hour) {
  if (hour < 12) return `Good morning, ${firstName}`
  if (hour < 17) return `Good afternoon, ${firstName}`
  return `Good evening, ${firstName}`
}

export function HomeHeader({
  firstName,
  selectedClub,
  unreadCount,
  rebookSuggestion,
  onToggleClubPicker,
  onRebook,
}) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const hour = new Date().getHours()
  const showSuggestion = rebookSuggestion && !dismissed

  return (
    <View style={styles.container}>
      {/* Row 1: Greeting + actions */}
      <View style={styles.topRow}>
        <Text style={styles.greeting} numberOfLines={1}>
          {getGreeting(firstName, hour)}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/(tabs)/notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color="#1e293b" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.clubBtn} onPress={onToggleClubPicker}>
            {selectedClub?.logo_url ? (
              <Image source={{ uri: selectedClub.logo_url }} style={styles.clubMini} />
            ) : (
              <View style={styles.clubMiniFallback}>
                <Text style={styles.clubMiniText}>{getInitials(selectedClub?.name)}</Text>
              </View>
            )}
            <Ionicons name="chevron-down" size={14} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Row 2: Rebook suggestion */}
      {showSuggestion && (
        <View style={styles.suggestion}>
          <View style={styles.suggestionContent}>
            <Text style={styles.suggestionText}>{rebookSuggestion.message}</Text>
            <Text style={styles.suggestionSub}>
              {rebookSuggestion.preferredCourtName}
            </Text>
          </View>
          <TouchableOpacity style={styles.rebookBtn} onPress={onRebook}>
            <Text style={styles.rebookText}>Book Again →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dismissBtn} onPress={() => setDismissed(true)}>
            <Ionicons name="close" size={16} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontSize: 22, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { position: 'relative', padding: 4 },
  badge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#ffffff' },
  clubBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clubMini: { width: 28, height: 28, borderRadius: 8 },
  clubMiniFallback: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center',
  },
  clubMiniText: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  suggestion: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, marginTop: 12,
    borderWidth: 1, borderColor: '#dbeafe',
  },
  suggestionContent: { flex: 1 },
  suggestionText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  suggestionSub: { fontSize: 12, color: '#64748b', marginTop: 1 },
  rebookBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  rebookText: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
  dismissBtn: { padding: 4 },
})
