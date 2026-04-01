// RecReserve Design System — Typography
// System fonts (SF Pro / Roboto) with a clear hierarchy scale.

export const fontSizes = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 30,
  '3xl': 36,
}

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
}

// Preset text styles
export const textStyles = {
  heading1: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.heavy },
  heading2: { fontSize: 22, fontWeight: fontWeights.bold },
  heading3: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold },
  heading4: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold },
  body: { fontSize: fontSizes.base, fontWeight: fontWeights.regular, lineHeight: 22 },
  bodyMedium: { fontSize: fontSizes.base, fontWeight: fontWeights.medium },
  bodySmall: { fontSize: fontSizes.sm, fontWeight: fontWeights.regular, lineHeight: 18 },
  caption: { fontSize: fontSizes.xs, fontWeight: fontWeights.medium },
  label: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold },
  labelUpper: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, letterSpacing: 0.8, textTransform: 'uppercase' },
  stat: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.heavy },
  statLarge: { fontSize: fontSizes['3xl'], fontWeight: fontWeights.heavy },
  button: { fontSize: fontSizes.base, fontWeight: fontWeights.bold },
  buttonSmall: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold },
}
