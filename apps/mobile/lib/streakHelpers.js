/**
 * Returns the Monday of the week containing the given date (UTC).
 */
export function getMondayOfWeek(date) {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1) - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Checks if a given date falls within the current week (Monday-Sunday UTC).
 */
export function isCurrentWeek(date) {
  const now = new Date()
  const currentMonday = getMondayOfWeek(now)
  const nextMonday = new Date(currentMonday)
  nextMonday.setUTCDate(currentMonday.getUTCDate() + 7)
  return date >= currentMonday && date < nextMonday
}

/**
 * Returns a human-readable streak message.
 */
export function getStreakMessage(currentStreak, hasUpcomingThisWeek) {
  if (currentStreak === 0 && !hasUpcomingThisWeek) {
    return 'Book a court to start your streak! 🎾'
  }
  if (currentStreak === 0 && hasUpcomingThisWeek) {
    return 'Play your booking to start a streak! 🔥'
  }
  if (hasUpcomingThisWeek) {
    return 'Your streak is safe this week! ✅'
  }
  return 'Keep it going! Book this week to continue. 🔥'
}
