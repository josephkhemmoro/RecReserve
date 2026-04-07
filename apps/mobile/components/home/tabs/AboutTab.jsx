import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, textStyles, spacing, borderRadius, shadows } from '../../../theme'
import { Icon, Avatar, Button, Card } from '../../ui'
import { OpenSpotCard } from '../../openSpots/OpenSpotCard'
import { useRebookSuggestion } from '../../../lib/useRebookSuggestion'
import { useBookingStore } from '../../../store/bookingStore'

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

export function AboutTab({ club, nextReservation, openSpots, announcements, userId, clubId, sentSpotIds, onRequestJoin }) {
  const router = useRouter()
  const rebookSuggestion = useRebookSuggestion(userId, clubId, nextReservation ? [nextReservation] : [])

  // When user taps the rebook card, pre-fill the booking store and navigate
  const handleRebook = () => {
    if (!rebookSuggestion) return
    // Set the selected date to the next occurrence
    if (rebookSuggestion.nextDate) {
      useBookingStore.getState().setSelectedDate(rebookSuggestion.nextDate)
    }
    // Navigate to court select (user picks court and confirms time)
    router.push('/courts/select')
  }

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

      {/* Rebook Suggestion */}
      {rebookSuggestion && (
        <Card
          variant="elevated"
          onPress={handleRebook}
          style={styles.rebookCard}
        >
          <View style={styles.rebookContent}>
            <View style={styles.rebookIcon}>
              <Icon name="refresh-outline" size="md" color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rebookLabel}>REBOOK</Text>
              <Text style={styles.rebookMessage}>{rebookSuggestion.message}</Text>
              <Text style={styles.rebookDetail}>{rebookSuggestion.preferredCourtName}</Text>
            </View>
            <Icon name="chevron-forward" size="sm" color={colors.neutral400} />
          </View>
        </Card>
      )}

      {/* Open Spots Link */}
      {openSpots && openSpots.length > 0 && (
        <TouchableOpacity style={styles.openSpotsLink} onPress={() => router.push('/players')}>
          <Icon name="people-outline" size="sm" color={colors.primary} />
          <Text style={styles.openSpotsLinkText}>{openSpots.length} open spot{openSpots.length !== 1 ? 's' : ''} available</Text>
          <Icon name="chevron-forward" size="sm" color={colors.neutral400} />
        </TouchableOpacity>
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

  // Rebook
  rebookCard: { flexDirection: 'row', overflow: 'hidden', padding: 0, marginBottom: spacing.md },
  rebookContent: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: spacing.base, gap: spacing.md },
  rebookIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.accent}15`, alignItems: 'center', justifyContent: 'center' },
  rebookLabel: { fontSize: 10, fontWeight: '700', color: colors.accent, letterSpacing: 1, marginBottom: 2 },
  rebookMessage: { ...textStyles.bodyMedium, color: colors.neutral900 },
  rebookDetail: { ...textStyles.caption, color: colors.neutral500, marginTop: 2 },

  // Open Spots Link
  openSpotsLink: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primarySurface || `${colors.primary}08`, borderRadius: borderRadius.lg,
    padding: spacing.base, marginBottom: spacing.lg,
  },
  openSpotsLinkText: { ...textStyles.bodySmall, color: colors.primary, fontWeight: '600', flex: 1 },

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
