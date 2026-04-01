import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useFeedStore } from '../../store/feedStore'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { SectionHeader, EmptyState } from '../ui'
import { FeedItem } from './FeedItem'
import { OpenSpotFeedItem } from './OpenSpotFeedItem'
import { EventFeedItem } from './EventFeedItem'

export function ActivityFeed({ clubId, openSpots, upcomingEvents, showHeader }) {
  const { feedEvents, isLoading, hasMore, loadMore } = useFeedStore()

  const merged = []
  for (const event of feedEvents) {
    merged.push({ type: 'feed_event', data: event, sortTime: event.created_at })
  }
  if (openSpots) {
    for (const spot of openSpots.slice(0, 3)) {
      merged.push({ type: 'open_spot', data: spot, sortTime: spot.created_at })
    }
  }
  if (upcomingEvents) {
    for (const event of upcomingEvents.slice(0, 2)) {
      merged.push({ type: 'upcoming_event', data: event, sortTime: event.start_time })
    }
  }
  merged.sort((a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime())

  if (isLoading && feedEvents.length === 0) {
    return (
      <View style={styles.container}>
        {showHeader && <SectionHeader title="Club Activity" icon="pulse-outline" />}
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.skeleton}>
            <View style={styles.skeletonCircle} />
            <View style={styles.skeletonLines}>
              <View style={[styles.skeletonLine, { width: '70%' }]} />
              <View style={[styles.skeletonLine, { width: '40%' }]} />
            </View>
          </View>
        ))}
      </View>
    )
  }

  if (merged.length === 0) {
    return (
      <View style={styles.container}>
        {showHeader && <SectionHeader title="Club Activity" icon="pulse-outline" />}
        <EmptyState
          icon="tennisball-outline"
          title="No activity yet"
          subtitle="Your club's activity will show up here. Book a court to get things started!"
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {showHeader && <SectionHeader title="Club Activity" icon="pulse-outline" />}
      {merged.map((item, idx) => {
        if (item.type === 'open_spot') return <OpenSpotFeedItem key={`spot-${item.data.id}`} spot={item.data} />
        if (item.type === 'upcoming_event') return <EventFeedItem key={`event-${item.data.id}`} event={item.data} />
        return <FeedItem key={item.data.id || idx} event={item.data} />
      })}
      {hasMore && (
        <TouchableOpacity style={styles.moreButton} onPress={() => loadMore(clubId)}>
          <Text style={styles.moreText}>Load more</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  moreButton: { paddingVertical: spacing.md, alignItems: 'center' },
  moreText: { ...textStyles.label, color: colors.primary },
  skeleton: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  skeletonCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.neutral100 },
  skeletonLines: { flex: 1 },
  skeletonLine: { height: 10, backgroundColor: colors.neutral100, borderRadius: 5, marginBottom: 6 },
})
