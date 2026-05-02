import { useState } from 'react'
import { View, Text, Image, ScrollView, StyleSheet, Dimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeIn } from 'react-native-reanimated'
import { colors, textStyles, spacing, borderRadius } from '../../theme'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const HERO_HEIGHT = 220

export function HeroCarousel({ photos, clubName }) {
  const [index, setIndex] = useState(0)

  const handleScroll = (e) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
  }

  if (!photos || photos.length === 0) {
    return (
      <Animated.View entering={FadeIn.duration(400)} style={[styles.hero, styles.fallback]}>
        <LinearGradient
          colors={[colors.primaryDark, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={styles.fallbackText}>{clubName || 'Your Club'}</Text>
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(400)}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        decelerationRate="fast"
      >
        {photos.map((p, i) => (
          <View key={p.id || i} style={styles.hero}>
            <Image source={{ uri: p.photo_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            {/* Gradient scrim — ensures any overlaid text/dots are legible on any photo */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.5)']}
              start={{ x: 0, y: 0.3 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
        ))}
      </ScrollView>
      {photos.length > 1 && (
        <View style={styles.dots}>
          {photos.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  hero: { width: SCREEN_WIDTH, height: HERO_HEIGHT, overflow: 'hidden' },
  fallback: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing['2xl'] },
  fallbackText: { ...textStyles.heading1, color: colors.white, textAlign: 'center', zIndex: 1 },
  dots: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    backgroundColor: colors.white,
    width: 22,
    borderRadius: 4,
  },
})
