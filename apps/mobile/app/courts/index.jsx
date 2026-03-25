import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useClubStore } from '../../store/clubStore'

const FILTERS = ['All', 'Tennis', 'Pickleball']

export default function CourtBrowserScreen() {
  const router = useRouter()
  const { selectedClub } = useClubStore()
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    if (selectedClub?.id) fetchCourts()
  }, [selectedClub?.id])

  const fetchCourts = async () => {
    try {
      const { data, error } = await supabase
        .from('courts')
        .select('*')
        .eq('club_id', selectedClub.id)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      setCourts(data || [])
    } catch (err) {
      console.error('Error fetching courts:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredCourts = courts.filter((court) => {
    if (filter === 'All') return true
    return court.sport === filter.toLowerCase()
  })

  const renderCourt = ({ item }) => (
    <TouchableOpacity
      style={styles.courtCard}
      onPress={() => router.push(`/courts/${item.id}/book`)}
    >
      <View style={styles.courtHeader}>
        <Text style={styles.courtName}>{item.name}</Text>
        <View style={[
          styles.sportTag,
          item.sport === 'tennis' ? styles.tennisTag : styles.pickleballTag,
        ]}>
          <Text style={[
            styles.sportTagText,
            item.sport === 'tennis' ? styles.tennisTagText : styles.pickleballTagText,
          ]}>
            {item.sport.charAt(0).toUpperCase() + item.sport.slice(1)}
          </Text>
        </View>
      </View>
      <Text style={styles.detailText}>
        {item.is_active ? 'Available' : 'Unavailable'}
      </Text>
    </TouchableOpacity>
  )

  if (!selectedClub) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 6 }}>No club selected</Text>
        <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', paddingHorizontal: 40 }}>Join a club first to browse and book courts</Text>
        <TouchableOpacity style={{ marginTop: 16, backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }} onPress={() => router.back()}>
          <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>Go Back</Text>
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
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Courts</Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filteredCourts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No courts found</Text>
          <Text style={styles.emptySubtitle}>
            {filter !== 'All'
              ? `No ${filter.toLowerCase()} courts available`
              : 'No courts available at your club'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredCourts}
          renderItem={renderCourt}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 60,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  backButton: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  courtCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  courtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  courtName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  sportTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tennisTag: {
    backgroundColor: '#dcfce7',
  },
  pickleballTag: {
    backgroundColor: '#fef3c7',
  },
  sportTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tennisTagText: {
    color: '#166534',
  },
  pickleballTagText: {
    color: '#92400e',
  },
  detailText: {
    fontSize: 13,
    color: '#64748b',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
})
