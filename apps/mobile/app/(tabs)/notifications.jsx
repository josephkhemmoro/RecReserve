import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, Image,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { getNotificationRoute } from '../../lib/notifications'
import { getCleanTitle } from '../../lib/notificationHelpers'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import { colors, textStyles, spacing, borderRadius, shadows } from '../../theme'
import { Icon, Avatar } from '../../components/ui'

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

const TYPE_ICONS = {
  announcement: { name: 'megaphone-outline', color: colors.primary },
  streak_milestone: { name: 'flame', color: colors.streak },
  kudos: { name: 'heart-outline', color: colors.kudos },
  spot_request: { name: 'people-outline', color: colors.primary },
  spot_accepted: { name: 'checkmark-circle-outline', color: colors.success },
  spot_declined: { name: 'information-circle-outline', color: colors.neutral500 },
  no_show: { name: 'alert-circle-outline', color: colors.warning },
  booking_confirmation: { name: 'checkmark-circle-outline', color: colors.success },
  cancellation: { name: 'close-circle-outline', color: colors.error },
  booking_reminder: { name: 'time-outline', color: colors.primary },
}

export default function NotificationsScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { notifications, loading, setNotifications, addNotification, markAsRead, markAllAsRead } = useNotificationStore()
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

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const notif = payload.new
          if (notif.club_id) {
            try {
              const { data: club } = await supabase.from('clubs').select('name, logo_url').eq('id', notif.club_id).single()
              notif.club = club
            } catch {}
          }
          addNotification(notif)
        }
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const onRefresh = () => { setRefreshing(true); fetchNotifications().finally(() => setRefreshing(false)) }

  const handleTap = async (notification) => {
    if (!notification.read) {
      try {
        await supabase.from('notifications').update({ read: true }).eq('id', notification.id)
        markAsRead(notification.id)
      } catch {}
    }
    const route = getNotificationRoute(notification.type, notification)
    router.push(route)
  }

  const handleMarkAllRead = async () => {
    if (!user?.id) return
    try {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
      markAllAsRead()
    } catch {}
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const renderNotification = ({ item }) => {
    const iconConfig = TYPE_ICONS[item.type] || { name: 'notifications-outline', color: colors.neutral500 }
    const clubName = item.club?.name || null
    const clubLogo = item.club?.logo_url || null
    const cleanTitle = getCleanTitle(item.title, clubName)

    return (
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => handleTap(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardTopRow}>
          <View style={[styles.typeIcon, { backgroundColor: `${iconConfig.color}15` }]}>
            <Icon name={iconConfig.name} size="sm" color={iconConfig.color} />
          </View>
          <View style={styles.content}>
            <Text style={styles.title}>{cleanTitle}</Text>
            <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
          </View>
        </View>
        {item.image_url && (
          <Image source={{ uri: item.image_url }} style={styles.notifImage} resizeMode="cover" />
        )}
        <View style={styles.attributionRow}>
          {clubName ? (
            <View style={styles.clubAttribution}>
              <Avatar uri={clubLogo} name={clubName} size="sm" />
              <Text style={styles.clubName} numberOfLines={1}>{clubName}</Text>
            </View>
          ) : <View />}
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alerts</Text>
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
        contentContainerStyle={[styles.list, (loading || notifications.length === 0) && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Icon name="notifications-off-outline" size="lg" color={colors.neutral300} />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySubtitle}>You'll be notified about bookings, reminders, and updates</Text>
            </View>
          )
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 70 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.base },
  headerTitle: { ...textStyles.heading2, color: colors.neutral900 },
  markAllRead: { ...textStyles.label, color: colors.primary },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },

  card: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.base, marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardUnread: { backgroundColor: colors.primarySurface, borderLeftWidth: 3, borderLeftColor: colors.primary },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  typeIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 2, marginRight: spacing.sm,
  },
  content: { flex: 1 },
  title: { ...textStyles.bodyMedium, color: colors.neutral900, marginBottom: 2 },
  body: { ...textStyles.bodySmall, color: colors.neutral500, lineHeight: 20 },
  notifImage: { width: '100%', height: 160, borderRadius: borderRadius.md, marginTop: spacing.sm, backgroundColor: colors.neutral100 },
  attributionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.neutral100,
  },
  clubAttribution: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1, marginRight: spacing.sm },
  clubName: { ...textStyles.caption, color: colors.neutral400 },
  time: { ...textStyles.caption, color: colors.neutral400 },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing['3xl'], gap: spacing.sm },
  emptyTitle: { ...textStyles.bodyMedium, color: colors.neutral700 },
  emptySubtitle: { ...textStyles.bodySmall, color: colors.neutral400, textAlign: 'center', lineHeight: 20 },
})
