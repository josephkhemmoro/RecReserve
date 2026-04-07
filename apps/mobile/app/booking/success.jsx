import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Share,
} from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { colors, spacing, borderRadius, fontSizes, fontWeights, layout } from '../../theme'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'

export default function BookingSuccessScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { selectedClub } = useClubStore()
  const scaleAnim = useRef(new Animated.Value(0)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const checkScale = useRef(new Animated.Value(0)).current
  const buttonsOpacity = useRef(new Animated.Value(0)).current

  const [recentPartners, setRecentPartners] = useState([])

  useEffect(() => {
    if (!user?.id || !selectedClub?.id) return
    const fetchPartners = async () => {
      const { data } = await supabase
        .from('play_connections')
        .select('partner_id, times_played, partner:users!play_connections_partner_id_fkey(id, full_name, avatar_url)')
        .eq('user_id', user.id)
        .eq('club_id', selectedClub.id)
        .eq('is_blocked', false)
        .order('last_played_at', { ascending: false })
        .limit(3)
      setRecentPartners(data || [])
    }
    fetchPartners()
  }, [user?.id, selectedClub?.id])

  useEffect(() => {
    // Sequence: circle scales up → check pops → text fades → buttons fade
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(checkScale, {
        toValue: 1,
        tension: 100,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(buttonsOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Animated checkmark circle */}
        <Animated.View
          style={[
            styles.checkCircle,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: checkScale }] }}>
            <Ionicons name="checkmark" size={48} color={colors.success} />
          </Animated.View>
        </Animated.View>

        {/* Text */}
        <Animated.View style={[styles.textBlock, { opacity: opacityAnim }]}>
          <Text style={styles.title}>Booking Confirmed!</Text>
          <Text style={styles.subtitle}>
            Your court has been reserved. You'll receive a confirmation notification shortly.
          </Text>
        </Animated.View>
      </View>

      {/* What's Next */}
      <Animated.View style={[styles.whatsNext, { opacity: buttonsOpacity }]}>
        <Text style={styles.whatsNextTitle}>What's Next</Text>
        <View style={styles.whatsNextRow}>
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => router.replace('/(tabs)/reservations')}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="calendar" size={22} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>My Bookings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => router.replace('/open-spots')}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="people" size={22} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Find Players</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => router.replace('/courts/select')}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="tennisball-outline" size={22} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Book Another</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Buttons */}
      <Animated.View style={[styles.footer, { opacity: buttonsOpacity }]}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace('/(tabs)/reservations')}
        >
          <Ionicons name="calendar" size={18} color={colors.white} />
          <Text style={styles.primaryButtonText}>View My Reservations</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Ionicons name="tennisball-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
    paddingTop: 80,
    paddingBottom: spacing['3xl'],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  textBlock: { alignItems: 'center' },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.neutral900,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: fontSizes.base,
    color: colors.neutral500,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },
  footer: {
    gap: layout.itemGap,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: borderRadius.lg,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
  },

  // What's Next
  whatsNext: {
    marginBottom: spacing.xl,
  },
  whatsNextTitle: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.neutral900,
    marginBottom: spacing.base,
  },
  whatsNextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  actionTile: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.primarySurface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
    textAlign: 'center',
  },
})
