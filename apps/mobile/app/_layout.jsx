import { useEffect, useRef, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { View, Text, StyleSheet, Linking } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Toaster } from 'sonner-native'
import * as Notifications from 'expo-notifications'
import { StripeProvider } from '@stripe/stripe-react-native'
import { supabase } from '../lib/supabase'
import { registerForPushNotifications, getNotificationRoute } from '../lib/notifications'
import { useAuthStore } from '../store/authStore'
import { useClubStore } from '../store/clubStore'
import { useMembershipStore } from '../store/membershipStore'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'
import { NetworkToast } from '../components/ui/NetworkToast'
import { colors } from '../theme'

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <StripeProvider
          publishableKey={STRIPE_PUBLISHABLE_KEY}
          merchantIdentifier="merchant.com.recreserve"
        >
          <RootLayoutInner />
          <Toaster position="top-center" richColors />
        </StripeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}

function RootLayoutInner() {
  const router = useRouter()
  const segments = useSegments()
  const { session, loading, setSession, setUser, setLoading } = useAuthStore()
  const { setMemberships, setSelectedClub } = useClubStore()
  const { fetchMembershipTier } = useMembershipStore()
  const notificationResponseListener = useRef()
  const [networkError, setNetworkError] = useState(false)

  // Deep link handler — covers password recovery, magic links, etc.
  // Email link → recreserve://reset-password?... → parse + establish session →
  // route to /reset-password screen.
  useEffect(() => {
    const handleAuthDeepLink = async (rawUrl) => {
      if (!rawUrl) return false
      try {
        // Replace custom scheme with https for URL parsing
        const httpsUrl = rawUrl.replace(/^recreserve:\/\//, 'https://recreserve.app/')
        const url = new URL(httpsUrl)
        const isResetPath = url.pathname.includes('reset-password') || rawUrl.includes('reset-password')

        // PKCE flow: ?code=...
        const code = url.searchParams.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) console.warn('[DeepLink] exchangeCodeForSession failed:', error.message)
          if (isResetPath) router.replace('/(auth)/reset-password')
          return true
        }

        // OTP/magiclink flow: ?token_hash=...&type=recovery
        const tokenHash = url.searchParams.get('token_hash')
        const type = url.searchParams.get('type')
        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
          if (error) console.warn('[DeepLink] verifyOtp failed:', error.message)
          if (type === 'recovery') router.replace('/(auth)/reset-password')
          return true
        }

        // Implicit flow: #access_token=...&refresh_token=...&type=recovery
        if (url.hash) {
          const params = Object.fromEntries(new URLSearchParams(url.hash.replace(/^#/, '')))
          if (params.access_token && params.refresh_token) {
            await supabase.auth.setSession({
              access_token: params.access_token,
              refresh_token: params.refresh_token,
            })
            if (params.type === 'recovery') router.replace('/(auth)/reset-password')
            return true
          }
        }
      } catch (err) {
        console.warn('[DeepLink] parse error:', err.message)
      }
      return false
    }

    // Handle initial URL (app opened cold from a link)
    Linking.getInitialURL().then((url) => {
      if (url) handleAuthDeepLink(url)
    })

    // Handle URLs while app is running
    const sub = Linking.addEventListener('url', ({ url }) => handleAuthDeepLink(url))

    // Also catch the PASSWORD_RECOVERY auth event as a backup
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/(auth)/reset-password')
      }
    })

    return () => {
      sub.remove()
      authSub?.subscription?.unsubscribe?.()
    }
  }, [router])

  // Auth initialization
  useEffect(() => {
    console.log('[App] Starting auth initialization')
    console.log('[App] Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL)
    console.log('[App] Has Supabase key:', !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[App] Got session:', !!session)
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch((err) => {
      console.error('[App] Auth init error:', err)
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
        notificationResponseListener.current.remove()
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
              start_date: new Date().toLocaleDateString('en-CA'),
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
              fetchMembershipTier(session.user.id, refreshed[0].club.id)
            }
            return
          }
        }

        setMemberships(memberships || [])

        if (memberships && memberships.length === 1 && memberships[0].club) {
          setSelectedClub(memberships[0].club)
          fetchMembershipTier(session.user.id, memberships[0].club.id)
        }
      } catch (err) {
        console.error('Error checking memberships:', err)
      }
    }

    checkMemberships()
  }, [session?.user?.id])

  // Check for outdated terms acceptances after login + on resume.
  // If the user is a member of a club whose terms_version > their accepted version,
  // route to the re-accept screen.
  useEffect(() => {
    if (!session?.user?.id) return
    let cancelled = false

    const checkOutdatedTerms = async () => {
      try {
        const { data, error } = await supabase.rpc('list_outdated_terms_clubs', {
          p_user_id: session.user.id,
        })
        if (cancelled || error || !data || data.length === 0) return
        // Route to the first one — if they have multiple, they'll see the next after accepting this one
        const first = data[0]
        router.push({ pathname: `/terms/${first.club_id}`, params: { mode: 'reaccept' } })
      } catch (err) {
        console.warn('Outdated terms check failed (non-blocking):', err.message)
      }
    }

    // Initial check
    checkOutdatedTerms()

    // Re-check on app resume
    const { AppState } = require('react-native')
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkOutdatedTerms()
    })
    return () => {
      cancelled = true
      sub.remove()
    }
  }, [session?.user?.id, router])

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
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(250)}
        style={styles.splash}
      >
        <View style={styles.splashLogo}>
          <Text style={styles.splashIcon}>R</Text>
        </View>
        <Text style={styles.splashTitle}>RecReserve</Text>
        <View style={styles.splashSpinner} />
      </Animated.View>
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
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    gap: 16,
  },
  splashLogo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashIcon: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
  },
  splashTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  splashSpinner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.3)',
    borderTopColor: '#ffffff',
    marginTop: 16,
  },
})
