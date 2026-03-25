import { create } from 'zustand'

export const useBookingStore = create((set) => ({
  selectedCourt: null,
  selectedDate: null,
  selectedSlot: null,
  duration: 60,
  price: 0,
  setSelectedCourt: (court) => set({ selectedCourt: court }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedSlot: (slot) => set({ selectedSlot: slot }),
  setDuration: (duration) => set({ duration }),
  setPrice: (price) => set({ price }),
  clearBooking: () => set({
    selectedCourt: null,
    selectedDate: null,
    selectedSlot: null,
    duration: 60,
    price: 0,
  }),
}))
