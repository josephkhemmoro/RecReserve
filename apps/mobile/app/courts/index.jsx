import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { supabase } from '../../lib/supabase'
import { useClubStore } from '../../store/clubStore'
import { useBookingStore } from '../../store/bookingStore'

export default function SportSelectionScreen() {
  const router = useRouter()
  const { selectedClub } = useClubStore()
  const { setSport } = useBookingStore()
  const [loading, setLoading] = useState(true)
  const [sportCounts, setSportCounts] = useState({ tennis: 0, pickleball: 0 })

  useEffect(() => {
    if (selectedClub?.id) fetchSports()
  }, [selectedClub?.id])

  const fetchSports = async () => {
    try {
      const { data, error } = await supabase
        .from('courts')
        .select('sport')
        .eq('club_id', selectedClub.id)
        .eq('is_active', true)

      if (error) throw error

      const counts = { tennis: 0, pickleball: 0 }
      for (const c of data || []) {
        if (c.sport === 'tennis' || c.sport === 'both') counts.tennis++
        if (c.sport === 'pickleball' || c.sport === 'both') counts.pickleball++
      }
      setSportCounts(counts)

      // Auto-skip if only one sport
      if (counts.tennis > 0 && counts.pickleball === 0) {
        setSport('tennis')
        router.replace('/courts/select?sport=tennis')
        return
      }
      if (counts.pickleball > 0 && counts.tennis === 0) {
        setSport('pickleball')
        router.replace('/courts/select?sport=pickleball')
        return
      }
    } catch (err) {
      console.error('Error fetching sports:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSportSelect = (sport) => {
    setSport(sport)
    router.push(`/courts/select?sport=${sport}`)
  }

  if (!selectedClub) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No club selected</Text>
        <Text style={styles.emptySubtitle}>Join a club first to book courts</Text>
        <TouchableOpacity style={styles.goBackButton} onPress={() => router.back()}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={22} color="#2563eb" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choose Your Sport</Text>
        <Text style={styles.subtitle}>{selectedClub.name}</Text>
      </View>

      <View style={styles.cards}>
        {sportCounts.tennis > 0 && (
          <TouchableOpacity
            style={styles.sportCard}
            onPress={() => handleSportSelect('tennis')}
            activeOpacity={0.7}
          >
            <View style={styles.sportIconCircle}>
              <Ionicons name="tennisball-outline" size={36} color="#16a34a" />
            </View>
            <Text style={styles.sportName}>Tennis</Text>
            <Text style={styles.sportCount}>
              {sportCounts.tennis} court{sportCounts.tennis !== 1 ? 's' : ''} available
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={styles.chevron} />
          </TouchableOpacity>
        )}

        {sportCounts.pickleball > 0 && (
          <TouchableOpacity
            style={styles.sportCard}
            onPress={() => handleSportSelect('pickleball')}
            activeOpacity={0.7}
          >
            <View style={[styles.sportIconCircle, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="baseball-outline" size={36} color="#d97706" />
            </View>
            <Text style={styles.sportName}>Pickleball</Text>
            <Text style={styles.sportCount}>
              {sportCounts.pickleball} court{sportCounts.pickleball !== 1 ? 's' : ''} available
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={styles.chevron} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 40 },
  header: { paddingHorizontal: 20, marginBottom: 32 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  backText: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', color: '#1e293b' },
  subtitle: { fontSize: 15, color: '#64748b', marginTop: 4 },
  cards: { paddingHorizontal: 20, gap: 14 },
  sportCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sportIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportName: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  sportCount: { fontSize: 13, color: '#64748b', marginTop: 2, flex: 1 },
  chevron: { marginLeft: 'auto' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
  goBackButton: { marginTop: 16, backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  goBackText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
})
