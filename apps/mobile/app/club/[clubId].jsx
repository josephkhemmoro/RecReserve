import { useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useClubStore } from '../../store/clubStore'

export default function ClubProfileRedirect() {
  const { clubId } = useLocalSearchParams()
  const router = useRouter()
  const { memberships, setSelectedClub } = useClubStore()

  useEffect(() => {
    // Find this club in memberships and select it, then go home
    const membership = memberships.find((m) => m.club_id === clubId || m.club?.id === clubId)
    if (membership?.club) {
      setSelectedClub(membership.club)
    }
    router.replace('/(tabs)')
  }, [clubId])

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0D9488" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
})
