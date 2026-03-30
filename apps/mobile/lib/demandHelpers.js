/**
 * Calculate demand level based on booked vs total courts.
 */
export function getDemandLevel(booked, total) {
  if (total === 0) return 'open'
  const ratio = booked / total
  if (ratio < 0.25) return 'open'
  if (ratio < 0.5) return 'filling'
  if (ratio < 0.75) return 'busy'
  return 'almost_full'
}

/**
 * Colors for each demand level.
 */
export const DEMAND_COLORS = {
  open: '#4CAF50',
  filling: '#8BC34A',
  busy: '#FF9800',
  almost_full: '#F44336',
}

/**
 * Background colors (subtle, for slot cell backgrounds).
 */
export const DEMAND_BG_COLORS = {
  open: 'rgba(76, 175, 80, 0.08)',
  filling: 'rgba(139, 195, 58, 0.10)',
  busy: 'rgba(255, 152, 0, 0.10)',
  almost_full: 'rgba(244, 67, 54, 0.10)',
}

/**
 * Labels for the demand level.
 */
export const DEMAND_LABELS = {
  open: 'Wide open',
  filling: 'Filling up',
  busy: 'Getting busy',
  almost_full: 'Almost full',
}
