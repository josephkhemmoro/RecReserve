import { useState } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { getRelativeTime } from '../../lib/timeHelpers'
import { getCleanTitle } from '../../lib/notificationHelpers'
import { useClubStore } from '../../store/clubStore'

export function ClubAnnouncementsFeed({ announcements }) {
  const { selectedClub } = useClubStore()
  const clubName = selectedClub?.name || null
  const [expandedId, setExpandedId] = useState(null)

  if (!announcements || announcements.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerIcon}>📢</Text>
          <Text style={styles.title}>Announcements</Text>
        </View>
        <Text style={styles.emptyText}>No announcements yet.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>📢</Text>
        <Text style={styles.title}>Announcements</Text>
      </View>

      {announcements.slice(0, 10).map((ann) => {
        const isExpanded = expandedId === ann.id

        return (
          <View key={ann.id} style={styles.card}>
            {ann.image_url && (
              <Image
                source={{ uri: ann.image_url }}
                style={styles.annImage}
                resizeMode="cover"
              />
            )}
            <Text style={styles.annTitle}>{getCleanTitle(ann.title, clubName)}</Text>
            <Text
              style={styles.annBody}
              numberOfLines={isExpanded ? undefined : 3}
            >
              {ann.body}
            </Text>
            {ann.body.length > 120 && (
              <TouchableOpacity onPress={() => setExpandedId(isExpanded ? null : ann.id)}>
                <Text style={styles.readMore}>{isExpanded ? 'Show less' : 'Read more'}</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.time}>{getRelativeTime(ann.created_at)}</Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  headerIcon: { fontSize: 18 },
  title: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  emptyText: { fontSize: 14, color: '#94a3b8' },
  card: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 8,
  },
  annImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f1f5f9',
  },
  annTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  annBody: { fontSize: 14, color: '#475569', lineHeight: 20 },
  readMore: { fontSize: 13, fontWeight: '600', color: '#2563eb', marginTop: 4 },
  time: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
})
