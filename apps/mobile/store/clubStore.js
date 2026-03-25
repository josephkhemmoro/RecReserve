import { create } from 'zustand'

export const useClubStore = create((set) => ({
  selectedClub: null,
  memberships: [],
  setSelectedClub: (club) => set({ selectedClub: club }),
  setMemberships: (memberships) => set({ memberships }),
  clearClub: () => set({ selectedClub: null, memberships: [] }),
}))
