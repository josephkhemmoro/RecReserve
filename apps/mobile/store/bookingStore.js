import { create } from 'zustand'

export const useBookingStore = create((set) => ({
  selectedCourt: null,
  selectedDate: null,
  startTime: null,
  endTime: null,
  durationMinutes: 0,
  priceBreakdown: null,
  // Recurring
  repeatWeekly: false,
  repeatWeeks: 4,
  // Guests
  guests: [],

  setSelectedCourt: (court) => set({ selectedCourt: court }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setTimeRange: (startTime, endTime, durationMinutes) =>
    set({ startTime, endTime, durationMinutes }),
  setPriceBreakdown: (breakdown) => set({ priceBreakdown: breakdown }),
  setRepeatWeekly: (val) => set({ repeatWeekly: val }),
  setRepeatWeeks: (val) => set({ repeatWeeks: val }),
  setGuests: (guests) => set({ guests }),

  clearBooking: () =>
    set({
      selectedCourt: null,
      selectedDate: null,
      startTime: null,
      endTime: null,
      durationMinutes: 0,
      priceBreakdown: null,
      repeatWeekly: false,
      repeatWeeks: 4,
      guests: [],
    }),
}))
