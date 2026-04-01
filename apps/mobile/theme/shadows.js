// RecReserve Design System — Shadows / Elevation
import { Platform } from 'react-native'

function makeShadow(offsetY, radius, opacity, elevation) {
  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: {
      elevation,
    },
  })
}

export const shadows = {
  none: makeShadow(0, 0, 0, 0),
  sm: makeShadow(1, 3, 0.06, 1),
  md: makeShadow(2, 8, 0.08, 3),
  lg: makeShadow(4, 16, 0.1, 6),
  xl: makeShadow(8, 24, 0.12, 10),
}
