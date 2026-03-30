/**
 * Strips club name prefix from a notification/announcement title.
 * Handles legacy data where club name was baked into the title.
 */
export function getCleanTitle(title, clubName) {
  if (!clubName) return title
  const prefixes = [
    `${clubName} - `,
    `${clubName}: `,
    `${clubName} — `,
    `${clubName} · `,
  ]
  for (const prefix of prefixes) {
    if (title.startsWith(prefix)) {
      return title.slice(prefix.length)
    }
  }
  return title
}
