import { useState } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { getRelativeTime } from '../../lib/timeHelpers'
import { getCleanTitle } from '../../lib/notificationHelpers'
import { useClubStore } from '../../store/clubStore'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { SectionHeader, Icon } from '../ui'

export function ClubAnnouncementsFeed({ announcements }) {
  const { selectedClub } = useClubStore()
  const clubName = selectedClub?.name || null
  const [expandedId, setExpandedId] = useState(null)

  if (!announcements || announcements.length === 0) {
    return (
      <View style={styles.container}>
        <SectionHeader title="Announcements" icon="megaphone-outline" />
        <Text style={styles.emptyText}>No announcements yet.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <SectionHeader title="Announcements" icon="megaphone-outline" />
      {announcements.slice(0, 10).map((ann) => {
        const isExpanded = expandedId === ann.id
        return (
          <View key={ann.id} style={styles.card}>
            {ann.image_url && <Image source={{ uri: ann.image_url }} style={styles.annImage} resizeMode="cover" />}
            <Text style={styles.annTitle}>{getCleanTitle(ann.title, clubName)}</Text>
            <Text style={styles.annBody} numberOfLines={isExpanded ? undefined : 3}>{ann.body}</Text>
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
  container: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  emptyText: { ...textStyles.bodySmall, color: colors.neutral400 },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.base, borderWidth: 1, borderColor: colors.neutral100, marginBottom: spacing.sm },
  annImage: { width: '100%', height: 160, borderRadius: borderRadius.md, marginBottom: spacing.sm, backgroundColor: colors.neutral100 },
  annTitle: { ...textStyles.bodyMedium, color: colors.neutral900, marginBottom: spacing.xs },
  annBody: { ...textStyles.bodySmall, color: colors.neutral600, lineHeight: 20 },
  readMore: { ...textStyles.label, color: colors.primary, marginTop: spacing.xs },
  time: { ...textStyles.caption, color: colors.neutral400, marginTop: spacing.sm },
})
