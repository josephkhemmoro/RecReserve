import { View, Text, Image, StyleSheet } from 'react-native'
import { colors, fontWeights } from '../../theme'

const SIZES = { sm: 32, md: 40, lg: 64 }
const FONT_SIZES = { sm: 12, md: 15, lg: 24 }

// Deterministic color from name
const AVATAR_COLORS = [
  '#0D9488', '#D97706', '#E11D48', '#7C3AED',
  '#2563EB', '#16A34A', '#EA580C', '#0EA5E9',
]

function getAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
}

export function Avatar({ uri, name, size = 'md' }) {
  const dim = SIZES[size] || SIZES.md
  const fontSize = FONT_SIZES[size] || FONT_SIZES.md
  const radius = dim / 2

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, { width: dim, height: dim, borderRadius: radius }]}
      />
    )
  }

  const bgColor = getAvatarColor(name)
  return (
    <View style={[styles.fallback, { width: dim, height: dim, borderRadius: radius, backgroundColor: bgColor }]}>
      <Text style={[styles.initials, { fontSize }]}>{getInitials(name)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.neutral100 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.white, fontWeight: fontWeights.bold },
})
