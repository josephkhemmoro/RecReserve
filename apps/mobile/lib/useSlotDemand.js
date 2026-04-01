import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { getDemandLevel } from './demandHelpers'
import { localDayStart, localDayEnd } from './dateUtils'

const SLOT_INCREMENT = 30

/**
 * Hook that calculates demand level for each 30-min slot on a given date for a club.
 * Returns a map keyed by time string (e.g. "09:00") with demand info.
 */
export function useSlotDemand(clubId, date) {
  const [demandMap, setDemandMap] = useState({})
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!clubId || !date) {
      setDemandMap({})
      return
    }

    let cancelled = false

    const fetchDemand = async () => {
      setIsLoading(true)
      try {
        const dateObj = new Date(date + 'T00:00:00')
        const dayOfWeek = dateObj.getDay()

        // Fetch active courts, their availability, and reservations in parallel
        // Fetch courts and reservations in parallel, then availability with court IDs
        const [courtsRes, reservationsRes] = await Promise.all([
          supabase
            .from('courts')
            .select('id')
            .eq('club_id', clubId)
            .eq('is_active', true),
          supabase
            .from('reservations')
            .select('court_id, start_time, end_time')
            .eq('club_id', clubId)
            .eq('status', 'confirmed')
            .gte('start_time', localDayStart(new Date(date + 'T00:00:00')))
            .lte('start_time', localDayEnd(new Date(date + 'T00:00:00'))),
        ])

        const courtIds = (courtsRes.data || []).map((c) => c.id)
        if (courtIds.length === 0) {
          if (!cancelled) {
            setDemandMap({})
            setIsLoading(false)
          }
          return
        }

        const { data: availData } = await supabase
          .from('court_availability')
          .select('court_id, open_time, close_time')
          .eq('day_of_week', dayOfWeek)
          .in('court_id', courtIds)

        if (cancelled) return

        const availability = availData || []
        const reservations = reservationsRes.data || []

        // Build a map of: for each 30-min slot, how many courts are open and how many booked
        const map = {}

        // For each slot time, determine which courts are open
        // First gather all possible slot times from availability
        const courtOpenSlots = {} // courtId -> Set of slot minutes

        for (const avail of availability) {
          const [startH, startM] = avail.open_time.split(':').map(Number)
          const [endH, endM] = avail.close_time.split(':').map(Number)
          const startMins = startH * 60 + startM
          const endMins = endH * 60 + endM

          if (!courtOpenSlots[avail.court_id]) {
            courtOpenSlots[avail.court_id] = new Set()
          }

          for (let m = startMins; m < endMins; m += SLOT_INCREMENT) {
            courtOpenSlots[avail.court_id].add(m)
          }
        }

        // Gather all unique slot times
        const allSlotMinutes = new Set()
        for (const slots of Object.values(courtOpenSlots)) {
          for (const m of slots) {
            allSlotMinutes.add(m)
          }
        }

        // For each reservation, mark which slots are booked for that court
        const courtBookedSlots = {} // courtId -> Set of slot minutes
        for (const res of reservations) {
          const rStart = new Date(res.start_time)
          const rEnd = new Date(res.end_time)
          const rStartMins = rStart.getHours() * 60 + rStart.getMinutes()
          const rEndMins = rEnd.getHours() * 60 + rEnd.getMinutes()

          if (!courtBookedSlots[res.court_id]) {
            courtBookedSlots[res.court_id] = new Set()
          }

          for (let m = rStartMins; m < rEndMins; m += SLOT_INCREMENT) {
            courtBookedSlots[res.court_id].add(m)
          }
        }

        // Build demand map
        for (const minutes of allSlotMinutes) {
          const timeStr = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

          let totalOpen = 0
          let booked = 0

          for (const cId of courtIds) {
            if (courtOpenSlots[cId]?.has(minutes)) {
              totalOpen++
              if (courtBookedSlots[cId]?.has(minutes)) {
                booked++
              }
            }
          }

          map[timeStr] = {
            time: timeStr,
            totalCourts: totalOpen,
            bookedCourts: booked,
            demandLevel: getDemandLevel(booked, totalOpen),
          }
        }

        if (!cancelled) {
          setDemandMap(map)
          setIsLoading(false)
        }
      } catch (err) {
        console.error('Error fetching slot demand:', err)
        if (!cancelled) {
          setDemandMap({})
          setIsLoading(false)
        }
      }
    }

    fetchDemand()
    return () => { cancelled = true }
  }, [clubId, date])

  return { demandMap, isLoading }
}
