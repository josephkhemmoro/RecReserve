import { colors } from '../theme'

export function getDemandLevel(booked, total) {
  if (total === 0) return 'open'
  const ratio = booked / total
  if (ratio < 0.25) return 'open'
  if (ratio < 0.5) return 'filling'
  if (ratio < 0.75) return 'busy'
  return 'almost_full'
}

export const DEMAND_COLORS = {
  open: colors.demandOpen,
  filling: colors.demandFilling,
  busy: colors.demandBusy,
  almost_full: colors.demandFull,
}

export const DEMAND_BG_COLORS = {
  open: `${colors.demandOpen}14`,
  filling: `${colors.demandFilling}1A`,
  busy: `${colors.demandBusy}1A`,
  almost_full: `${colors.demandFull}1A`,
}

export const DEMAND_LABELS = {
  open: 'Wide open',
  filling: 'Filling up',
  busy: 'Getting busy',
  almost_full: 'Almost full',
}
