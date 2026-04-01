import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, textStyles, spacing, borderRadius, shadows } from '../../../theme'
import { Icon, Avatar, Button, Card } from '../../ui'
import { OpenSpotCard } from '../../openSpots/OpenSpotCard'

function formatSmartDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  if (date.toDateString() === now.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function getCountdown(startTime) {
  const diff = new Date(startTime).getTime() - Date.now()
  if (diff < 0 || diff > 86400000) return null
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours > 0) return `Starts in ${hours}h ${mins > 0 ? `${mins}m` : ''}`
  if (mins > 0) return `Starts in ${mins}m`
  return 'Starting now'
}

export function AboutTab({ club, nextReservation, openSpots, announcements, userId, sentSpotIds, onRequestJoin }) {
  const router = useRouter()

  return (
    <View style={styles.container}>
      {/* Next Session */}
      {nextReservation ? (
        <Card variant="elevated" onPress={() => router.push('/(tabs)/reservations')} style={styles.sessionCard}>
          <View style={styles.sessionAccent} />
          <View style={styles.sessionContent}>
            <Text style={styles.sessionLabel}>NEXT SESSION</Text>
            <Text style={styles.sessionCourt}>{nextReservation.court?.name || 'Court'}</Text>
            <Text style={styles.sessionTime}>
              {formatSmartDate(nextReservation.start_time)} · {formatTime(nextReservation.start_time)} – {formatTime(nextReservation.end_time)}
            </Text>
            {getCountdown(nextReservation.start_time) && (
              <View style={styles.countdownRow}>
                <Icon name="time-outline" size="sm" color={colors.primary} />
                <Text style={styles.countdownText}>{getCountdown(nextReservation.start_time)}</Text>
              </View>
            )}
          </View>
        </Card>
      ) : (
        <View style={styles.noSession}>
          <Text style={styles.noSessionText}>No upcoming sessions</Text>
          <Button title="Book a Court" onPress={() => router.push('/courts')} variant="primary" size="sm" icon="tennisball-outline" />
        </View>
      )}

      {/* Find Us */}
      {(club.location || club.phone || club.website) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Find Us</Text>
          {club.location && (
            <View style={styles.infoRow}>
              <Icon name="location-outline" size="sm" color={colors.neutral500} />
              <Text style={styles.infoText}>{club.location}</Text>
            </View>
          )}
          {club.phone && (
            <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(`tel:${club.phone}`)}>
              <Icon name="call-outline" size="sm" color={colors.neutral500} />
              <Text style={styles.infoLink}>{club.phone}</Text>
            </TouchableOpacity>
          )}
          {club.website && (
            <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(club.website)}>
              <Icon name="globe-outline" size="sm" color={colors.neutral500} />
              <Text style={styles.infoLink} numberOfLines={1}>{club.website.replace(/^https?:\/\//, '')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Description */}
      {club.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{club.description}</Text>
        </View>
      )}

      {/* Looking for Players Preview */}
      {openSpots && openSpots.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Looking for Players</Text>
            <TouchableOpacity onPress={() => router.push('/players')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {openSpots.slice(0, 2).map((spot) => (
            <OpenSpotCard
              key={spot.id}
              spot={spot}
              currentUserId={userId}
              alreadyRequested={sentSpotIds?.has(spot.id) || false}
              onRequestJoin={onRequestJoin}
            />
          ))}
        </View>
      )}

      {/* Announcements */}
      {announcements && announcements.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Announcements</Text>
          {announcements.slice(0, 3).map((ann) => (
            <View key={ann.id} style={styles.announcementCard}>
              <Text style={styles.annTitle}>{ann.title}</Text>
              <Text style={styles.annBody} numberOfLines={2}>{ann.body}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 120 },

  // Session
  sessionCard: { flexDirection: 'row', overflow: 'hidden', padding: 0, marginBottom: spacing.lg },
  sessionAccent: { width: 4, backgroundColor: colors.primary },
  sessionContent: { flex: 1, padding: spacing.base },
  sessionLabel: { fontSize: 10, fontWeight: '700', color: colors.neutral400, letterSpacing: 1, marginBottom: spacing.sm },
  sessionCourt: { ...textStyles.heading4, color: colors.neutral900, marginBottom: spacing.xs },
  sessionTime: { ...textStyles.bodySmall, color: colors.neutral600 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  countdownText: { ...textStyles.label, color: colors.primary },
  noSession: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md, marginBottom: spacing.lg },
  noSessionText: { ...textStyles.bodyMedium, color: colors.neutral500 },

  // Sections
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { ...textStyles.heading4, color: colors.neutral900, marginBottom: spacing.md },
  seeAll: { ...textStyles.label, color: colors.primary },

  // Info
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  infoText: { ...textStyles.body, color: colors.neutral700 },
  infoLink: { ...textStyles.body, color: colors.primary, textDecorationLine: 'underline' },
  description: { ...textStyles.body, color: colors.neutral600, lineHeight: 22 },

  // Announcements
  announcementCard: { borderWidth: 1, borderColor: colors.neutral150, borderRadius: borderRadius.lg, padding: spacing.base, marginBottom: spacing.sm },
  annTitle: { ...textStyles.bodyMedium, color: colors.neutral900, marginBottom: spacing.xs },
  annBody: { ...textStyles.bodySmall, color: colors.neutral500 },
})
