/**
 * Haptic Feedback Utility
 * Provides cross-platform haptic feedback using Vibration API
 */

export const hapticFeedback = {
  /**
   * Light haptic feedback - for subtle interactions
   */
  light: () => {
    if (navigator.vibrate) {
      navigator.vibrate(10)
    }
  },

  /**
   * Medium haptic feedback - for standard interactions
   */
  medium: () => {
    if (navigator.vibrate) {
      navigator.vibrate(20)
    }
  },

  /**
   * Heavy haptic feedback - for important interactions
   */
  heavy: () => {
    if (navigator.vibrate) {
      navigator.vibrate(50)
    }
  },

  /**
   * Success haptic feedback pattern
   */
  success: () => {
    if (navigator.vibrate) {
      navigator.vibrate([10, 50, 10])
    }
  },

  /**
   * Error haptic feedback pattern
   */
  error: () => {
    if (navigator.vibrate) {
      navigator.vibrate([20, 50, 20, 50, 20])
    }
  },

  /**
   * Custom haptic pattern
   * @param {number|number[]} pattern - Vibration pattern
   */
  custom: (pattern) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  },
}
