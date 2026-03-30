import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

/**
 * Request notification permissions and return the Expo push token.
 * Stores the token in the users table.
 */
export async function registerForPushNotifications(userId) {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device')
    return null
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  // Request if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied')
    return null
  }

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
    })
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '5d4c7585-707a-45be-9f80-8fc1a18f98b9',
    })

    const pushToken = tokenData.data

    // Store in Supabase
    if (userId && pushToken) {
      await supabase
        .from('users')
        .update({ push_token: pushToken })
        .eq('id', userId)
    }

    return pushToken
  } catch (err) {
    console.error('Error getting push token:', err)
    return null
  }
}

/**
 * Returns the route to navigate to based on notification type.
 */
export function getNotificationRoute(type, data) {
  switch (type) {
    case 'booking_confirmation':
    case 'cancellation':
    case 'waitlist_promotion':
      return '/(tabs)/reservations'
    case 'booking_reminder':
      return '/(tabs)/reservations'
    case 'event_reminder':
      return '/(tabs)/clubs' // Events are club-specific
    case 'streak_milestone':
    case 'kudos':
      return '/(tabs)/profile'
    case 'spot_request':
    case 'spot_accepted':
    case 'spot_declined':
      return '/players'
    case 'no_show':
      return '/(tabs)/reservations'
    case 'announcement':
      return '/(tabs)/notifications'
    default:
      return '/(tabs)/notifications'
  }
}
