import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { getNotificationRoute } from '../../lib/notifications'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'

function timeAgo(dateStr) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NotificationsScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const {
    notifications,
    loading,
    setNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore()
  const [refreshing, setRefreshing] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setNotifications(data || [])
    } catch (err) {
      console.error('Error fetching notifications:', err)
      setNotifications([])
    }
  }, [user?.id])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          addNotification(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  const onRefresh = () => {
    setRefreshing(true)
    fetchNotifications().finally(() => setRefreshing(false))
  }

  const handleTap = async (notification) => {
    // Mark as read in DB
    if (!notification.read) {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notification.id)
        markAsRead(notification.id)
      } catch (err) {
        console.error('Error marking as read:', err)
      }
    }

    // Navigate
    const route = getNotificationRoute(notification.type, notification)
    router.push(route)
  }

  const handleMarkAllRead = async () => {
    if (!user?.id) return
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
      markAllAsRead()
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const renderNotification = ({ item }) => {
    const isAnnouncement = item.type === 'announcement'
    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          !item.read && styles.notificationUnread,
          isAnnouncement && styles.announcementCard,
          isAnnouncement && !item.read && styles.announcementUnread,
        ]}
        onPress={() => handleTap(item)}
      >
        {isAnnouncement ? (
          <View style={styles.announcementIcon}>
            <Ionicons name="megaphone-outline" size={16} color="#7c3aed" />
          </View>
        ) : (
          !item.read && <View style={styles.unreadDot} />
        )}
        <View style={styles.notificationContent}>
          {isAnnouncement && (
            <Text style={styles.announcementLabel}>ANNOUNCEMENT</Text>
          )}
          <Text style={styles.notificationTitle}>{item.title}</Text>
          <Text style={styles.notificationBody} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.notificationTime}>{timeAgo(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllRead}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={loading ? [] : notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          (loading || notifications.length === 0) && { flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySubtitle}>
                You'll be notified about bookings, reminders, and updates
              </Text>
            </View>
          )
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 70,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
  },
  markAllRead: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  notificationUnread: {
    backgroundColor: '#eff6ff',
    borderColor: '#dbeafe',
  },
  announcementCard: {
    backgroundColor: '#faf5ff',
    borderColor: '#ede9fe',
  },
  announcementUnread: {
    backgroundColor: '#f3e8ff',
    borderColor: '#ddd6fe',
  },
  announcementIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 10,
  },
  announcementLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7c3aed',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    marginTop: 6,
    marginRight: 10,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: '#94a3b8',
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
    lineHeight: 20,
  },
})
