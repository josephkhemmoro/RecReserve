import { useEffect, useRef, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { ActivityIndicator, View, StyleSheet } from 'react-native'
import * as Notifications from 'expo-notifications'
import { supabase } from '../lib/supabase'
import { registerForPushNotifications, getNotificationRoute } from '../lib/notifications'
import { useAuthStore } from '../store/authStore'
import { useClubStore } from '../store/clubStore'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'
import { NetworkToast } from '../components/ui/NetworkToast'

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <RootLayoutInner />
    </ErrorBoundary>
  )
}

function RootLayoutInner() {
  const router = useRouter()
  const segments = useSegments()
  const { session, loading, setSession, setUser, setLoading } = useAuthStore()
  const { setMemberships, setSelectedClub } = useClubStore()
  const notificationResponseListener = useRef()
  const [networkError, setNetworkError] = useState(false)

  // Auth initialization
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch((err) => {
      if (err?.message?.includes('network') || err?.message?.includes('fetch')) {
        setNetworkError(true)
        setTimeout(() => setNetworkError(false), 4500)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Register push notifications after login
  useEffect(() => {
    if (!session?.user?.id) return

    registerForPushNotifications(session.user.id)
  }, [session?.user?.id])

  // Handle notification tap — navigate to relevant screen
  useEffect(() => {
    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data || {}
        const type = data.type || 'general'
        const route = getNotificationRoute(type, data)
        router.push(route)
      })

    return () => {
      if (notificationResponseListener.current) {
        Notifications.removeNotificationSubscription(notificationResponseListener.current)
      }
    }
  }, [router])

  // Check memberships after login
  useEffect(() => {
    if (!session?.user?.id) return

    const checkMemberships = async () => {
      try {
        const { data: memberships, error } = await supabase
          .from('memberships')
          .select('id, club_id, tier, is_active, club:clubs(id, name, location, logo_url)')
          .eq('user_id', session.user.id)
          .eq('is_active', true)

        if (error) throw error

        if (!memberships || memberships.length === 0) {
          const { data: profile } = await supabase
            .from('users')
            .select('club_id')
            .eq('id', session.user.id)
            .single()

          if (profile?.club_id) {
            await supabase.from('memberships').insert({
              user_id: session.user.id,
              club_id: profile.club_id,
              tier: 'premium',
              start_date: new Date().toISOString().split('T')[0],
              is_active: true,
            })

            const { data: refreshed } = await supabase
              .from('memberships')
              .select('id, club_id, tier, is_active, club:clubs(id, name, location, logo_url)')
              .eq('user_id', session.user.id)
              .eq('is_active', true)

            setMemberships(refreshed || [])
            if (refreshed && refreshed.length === 1 && refreshed[0].club) {
              setSelectedClub(refreshed[0].club)
            }
            return
          }
        }

        setMemberships(memberships || [])

        if (memberships && memberships.length === 1 && memberships[0].club) {
          setSelectedClub(memberships[0].club)
        }
      } catch (err) {
        console.error('Error checking memberships:', err)
      }
    }

    checkMemberships()
  }, [session?.user?.id])

  // Routing logic
  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login')
    } else {
      if (inAuthGroup) router.replace('/(tabs)')
    }
  }, [session, loading, segments])

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <NetworkToast visible={networkError} />
      <Slot />
    </View>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
})
