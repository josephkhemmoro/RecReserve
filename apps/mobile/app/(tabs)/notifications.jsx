import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { getNotificationRoute } from '../../lib/notifications'
import { getCleanTitle } from '../../lib/notificationHelpers'
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
        .select('*, club:clubs(name, logo_url)')
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
        async (payload) => {
          const notif = payload.new
          // Fetch club info for the new notification
          if (notif.club_id) {
            try {
              const { data: club } = await supabase
                .from('clubs')
                .select('name, logo_url')
                .eq('id', notif.club_id)
                .single()
              notif.club = club
            } catch {
              // Non-blocking — club will just be null
            }
          }
          addNotification(notif)
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

  const getTypeIcon = (type) => {
    switch (type) {
      case 'announcement': return { name: 'megaphone-outline', color: '#7c3aed', bg: '#ede9fe' }
      case 'streak_milestone': return { name: 'flame-outline', color: '#ea580c', bg: '#fed7aa' }
      case 'kudos': return { name: 'hand-right-outline', color: '#FF8A65', bg: '#ffccbc' }
      case 'spot_request':
      case 'spot_accepted':
      case 'spot_declined': return { name: 'people-outline', color: '#2563eb', bg: '#dbeafe' }
      case 'no_show': return { name: 'warning-outline', color: '#d97706', bg: '#fde68a' }
      case 'booking_confirmation': return { name: 'checkmark-circle-outline', color: '#16a34a', bg: '#bbf7d0' }
      case 'cancellation': return { name: 'close-circle-outline', color: '#dc2626', bg: '#fecaca' }
      case 'booking_reminder': return { name: 'time-outline', color: '#2563eb', bg: '#dbeafe' }
      default: return { name: 'notifications-outline', color: '#64748b', bg: '#f1f5f9' }
    }
  }

  const getClubInitial = (name) => {
    if (!name) return '?'
    return name.charAt(0).toUpperCase()
  }

  const renderNotification = ({ item }) => {
    const icon = getTypeIcon(item.type)
    const clubName = item.club?.name || null
    const clubLogo = item.club?.logo_url || null
    const cleanTitle = getCleanTitle(item.title, clubName)

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          !item.read && styles.notificationUnread,
        ]}
        onPress={() => handleTap(item)}
      >
        <View style={styles.cardTopRow}>
          <View style={[styles.typeIcon, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name} size={16} color={icon.color} />
          </View>
          <View style={styles.notificationContent}>
            <Text style={styles.notificationTitle}>{cleanTitle}</Text>
            <Text style={styles.notificationBody} numberOfLines={2}>
              {item.body}
            </Text>
          </View>
        </View>
        {item.image_url && (
          <Image
            source={{ uri: item.image_url }}
            style={styles.notificationImage}
            resizeMode="cover"
          />
        )}
        {/* Club attribution line */}
        <View style={styles.attributionRow}>
          {clubName ? (
            <View style={styles.clubAttribution}>
              {clubLogo ? (
                <Image source={{ uri: clubLogo }} style={styles.clubMiniLogo} />
              ) : (
                <View style={styles.clubMiniLogoFallback}>
                  <Text style={styles.clubMiniInitial}>{getClubInitial(clubName)}</Text>
                </View>
              )}
              <Text style={styles.clubMiniName} numberOfLines={1}>{clubName}</Text>
            </View>
          ) : (
            <View />
          )}
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
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  notificationUnread: {
    backgroundColor: '#eff6ff',
    borderColor: '#dbeafe',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 10,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 3,
  },
  notificationBody: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  notificationImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: '#f1f5f9',
  },
  attributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  clubAttribution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  clubMiniLogo: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  clubMiniLogoFallback: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubMiniInitial: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748b',
  },
  clubMiniName: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    flex: 1,
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
