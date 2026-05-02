import { useState } from 'react'
import { View, Text, Image, ScrollView, StyleSheet, Dimensions } from 'react-native'
import { colors, textStyles, spacing, borderRadius } from '../../theme'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const HERO_HEIGHT = 200

export function HeroCarousel({ photos, clubName }) {
  const [index, setIndex] = useState(0)

  const handleScroll = (e) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
  }

  if (!photos || photos.length === 0) {
    return (
      <View style={[styles.hero, styles.fallback]}>
        <Text style={styles.fallbackText}>{clubName || 'Your Club'}</Text>
      </View>
    )
  }

  return (
    <View>
      <ScrollView
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
      >
        {photos.map((p, i) => (
          <Image key={p.id || i} source={{ uri: p.photo_url }} style={styles.hero} resizeMode="cover" />
        ))}
      </ScrollView>
      {photos.length > 1 && (
        <View style={styles.dots}>
          {photos.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { width: SCREEN_WIDTH, height: HERO_HEIGHT },
  fallback: { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing['2xl'] },
  fallbackText: { ...textStyles.heading1, color: colors.white, textAlign: 'center' },
  dots: { position: 'absolute', bottom: spacing.md, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: colors.white, width: 20 },
})
