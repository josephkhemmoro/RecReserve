import { useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { ActivityIndicator, View, StyleSheet } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useClubStore } from '../store/clubStore'

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const { session, loading, setSession, setUser, setLoading } = useAuthStore()
  const { selectedClub, setMemberships, setSelectedClub } = useClubStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // After login, check memberships (and fallback to users.club_id for admins/owners)
  useEffect(() => {
    if (!session?.user?.id) return

    const checkMemberships = async () => {
      try {
        // 1. Check existing memberships
        const { data: memberships, error } = await supabase
          .from('memberships')
          .select('id, club_id, tier, is_active, club:clubs(id, name, location, logo_url)')
          .eq('user_id', session.user.id)
          .eq('is_active', true)

        if (error) throw error

        // 2. If no memberships, check if user has a club_id in users table (admin/owner)
        //    and auto-create a membership for them
        if (!memberships || memberships.length === 0) {
          const { data: profile } = await supabase
            .from('users')
            .select('club_id')
            .eq('id', session.user.id)
            .single()

          if (profile?.club_id) {
            // Auto-create membership for club owner/admin
            await supabase.from('memberships').insert({
              user_id: session.user.id,
              club_id: profile.club_id,
              tier: 'premium',
              start_date: new Date().toISOString().split('T')[0],
              is_active: true,
            })

            // Re-fetch memberships after insert
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

        // Auto-select if only one club
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
      // Logged in → always go to tabs (club is optional)
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

  return <Slot />
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
})
