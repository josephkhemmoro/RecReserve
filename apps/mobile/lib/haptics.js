import * as Haptics from 'expo-haptics'

/**
 * Haptic feedback patterns — fire these on user actions for a premium feel.
 * All methods are fire-and-forget (no await needed). Silently no-op on
 * simulators and devices without a haptic engine.
 */
export const haptic = {
  /** Light tap — nav items, list selections, toggles */
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),

  /** Medium tap — button presses, time slot selection, form submit */
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),

  /** Heavy tap — destructive actions, important confirmations */
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),

  /** Success — booking confirmed, payment succeeded, streak milestone */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),

  /** Error — payment failed, booking conflict, validation error */
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),

  /** Warning — cancellation, leave group, destructive prompt */
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),

  /** Selection tick — chip selectors, tab changes, kudos tap */
  selection: () => Haptics.selectionAsync().catch(() => {}),
}
