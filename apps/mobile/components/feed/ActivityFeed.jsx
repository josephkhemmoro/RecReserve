import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useFeedStore } from '../../store/feedStore'
import { FeedItem } from './FeedItem'
import { OpenSpotFeedItem } from './OpenSpotFeedItem'
import { EventFeedItem } from './EventFeedItem'

export function ActivityFeed({ clubId, openSpots, upcomingEvents, showHeader }) {
  const { feedEvents, isLoading, hasMore, loadMore } = useFeedStore()

  // Build merged timeline
  const merged = []

  // Add feed events
  for (const event of feedEvents) {
    merged.push({ type: 'feed_event', data: event, sortTime: event.created_at })
  }

  // Add open spots (max 3)
  if (openSpots) {
    for (const spot of openSpots.slice(0, 3)) {
      merged.push({ type: 'open_spot', data: spot, sortTime: spot.created_at })
    }
  }

  // Add upcoming events (max 2)
  if (upcomingEvents) {
    for (const event of upcomingEvents.slice(0, 2)) {
      merged.push({ type: 'upcoming_event', data: event, sortTime: event.start_time })
    }
  }

  // Sort by time, newest first
  merged.sort((a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime())

  if (isLoading && feedEvents.length === 0) {
    return (
      <View style={styles.container}>
        {showHeader && <Text style={styles.sectionTitle}>Club Activity</Text>}
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
        {showHeader && <Text style={styles.sectionTitle}>Club Activity</Text>}
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Your club's activity will show up here!{'\n'}Book a court to get things started. 🎾
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {showHeader && <Text style={styles.sectionTitle}>Club Activity</Text>}
      {merged.map((item, idx) => {
        if (item.type === 'open_spot') {
          return <OpenSpotFeedItem key={`spot-${item.data.id}`} spot={item.data} />
        }
        if (item.type === 'upcoming_event') {
          return <EventFeedItem key={`event-${item.data.id}`} event={item.data} />
        }
        return <FeedItem key={item.data.id || idx} event={item.data} />
      })}
      {hasMore && (
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => loadMore(clubId)}
        >
          <Text style={styles.moreText}>Load more</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
  moreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  moreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  skeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  skeletonCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  skeletonLines: {
    flex: 1,
  },
  skeletonLine: {
    height: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 5,
    marginBottom: 6,
  },
})
