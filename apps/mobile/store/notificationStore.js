import { create } from 'zustand'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: true,

  setNotifications: (notifications) => {
    const unreadCount = notifications.filter((n) => !n.read).length
    set({ notifications, unreadCount, loading: false })
  },

  addNotification: (notification) => {
    const current = get().notifications
    const updated = [notification, ...current]
    const unreadCount = updated.filter((n) => !n.read).length
    set({ notifications: updated, unreadCount })
  },

  markAsRead: (id) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    )
    const unreadCount = updated.filter((n) => !n.read).length
    set({ notifications: updated, unreadCount })
  },

  markAllAsRead: () => {
    const updated = get().notifications.map((n) => ({ ...n, read: true }))
    set({ notifications: updated, unreadCount: 0 })
  },

  clearNotifications: () => set({ notifications: [], unreadCount: 0, loading: true }),
}))
