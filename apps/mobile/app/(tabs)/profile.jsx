import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'

export default function ProfileScreen() {
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()
  const { selectedClub, clearClub } = useClubStore()

  const fullName = user?.user_metadata?.full_name || 'Player'
  const email = user?.email || ''

  const handleSwitchClub = () => {
    router.push('/(tabs)/clubs')
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      clearAuth()
      clearClub()
    } catch {
      // Auth state listener will handle cleanup
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {fullName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{fullName}</Text>
        <Text style={styles.email}>{email}</Text>
        {selectedClub && (
          <View style={styles.clubBadge}>
            <Text style={styles.clubBadgeText}>{selectedClub.name}</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={styles.switchButton} onPress={handleSwitchClub}>
          <Text style={styles.switchButtonText}>Switch Club</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 80,
  },
  header: {
    alignItems: 'center',
    paddingBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#64748b',
  },
  clubBadge: {
    marginTop: 10,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  clubBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    justifyContent: 'flex-end',
    paddingBottom: 40,
    gap: 12,
  },
  switchButton: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  switchButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#fef2f2',
  },
  signOutText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
})
