import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { toLocalISO } from './dateUtils'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatTime12(hour) {
  if (hour === 0) return '12:00 AM'
  if (hour < 12) return `${hour}:00 AM`
  if (hour === 12) return '12:00 PM'
  return `${hour - 12}:00 PM`
}

export function useRebookSuggestion(userId, clubId, upcomingReservations) {
  const [suggestion, setSuggestion] = useState(null)

  useEffect(() => {
    if (!userId || !clubId) {
      setSuggestion(null)
      return
    }

    const detect = async () => {
      try {
        const sixtyDaysAgo = new Date()
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

        const { data, error } = await supabase
          .from('reservations')
          .select('court_id, start_time, court:courts(name)')
          .eq('user_id', userId)
          .eq('club_id', clubId)
          .in('status', ['confirmed', 'completed'])
          .gte('start_time', toLocalISO(sixtyDaysAgo))
          .order('start_time', { ascending: false })
          .limit(20)

        if (error || !data || data.length < 3) {
          setSuggestion(null)
          return
        }

        // Group by day of week + rounded hour
        const dayHourCounts = {}
        const courtCounts = {}

        for (const r of data) {
          const d = new Date(r.start_time)
          const dow = d.getDay()
          const hour = d.getHours()
          const key = `${dow}-${hour}`

          dayHourCounts[key] = (dayHourCounts[key] || 0) + 1

          if (!courtCounts[key]) courtCounts[key] = {}
          const courtId = r.court_id
          const courtName = r.court?.name || 'Court'
          courtCounts[key][courtId] = {
            count: (courtCounts[key][courtId]?.count || 0) + 1,
            name: courtName,
          }
        }

        // Find most common pattern with at least 3 bookings
        let bestKey = null
        let bestCount = 0
        for (const [key, count] of Object.entries(dayHourCounts)) {
          if (count >= 3 && count > bestCount) {
            bestKey = key
            bestCount = count
          }
        }

        if (!bestKey) {
          setSuggestion(null)
          return
        }

        const [dowStr, hourStr] = bestKey.split('-')
        const dow = Number(dowStr)
        const hour = Number(hourStr)

        // Check if user already has an upcoming booking on that day this week
        const hasUpcoming = (upcomingReservations || []).some((r) => {
          const d = new Date(r.start_time)
          return d.getDay() === dow
        })

        if (hasUpcoming) {
          setSuggestion(null)
          return
        }

        // Find most booked court for this pattern
        const courtMap = courtCounts[bestKey]
        let bestCourtId = ''
        let bestCourtName = 'Court'
        let bestCourtCount = 0
        for (const [cid, info] of Object.entries(courtMap)) {
          if (info.count > bestCourtCount) {
            bestCourtId = cid
            bestCourtName = info.name
            bestCourtCount = info.count
          }
        }

        setSuggestion({
          dayOfWeek: dow,
          dayName: DAY_NAMES[dow],
          preferredTime: formatTime12(hour),
          preferredCourtId: bestCourtId,
          preferredCourtName: bestCourtName,
          message: `Your usual ${DAY_NAMES[dow]} ${formatTime12(hour)}?`,
        })
      } catch (err) {
        console.warn('Rebook suggestion error:', err)
        setSuggestion(null)
      }
    }

    detect()
  }, [userId, clubId, upcomingReservations?.length])

  return suggestion
}
