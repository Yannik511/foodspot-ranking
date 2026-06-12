import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

const isNative = Capacitor.isNativePlatform()

const safeNative = (fn) => {
  try {
    fn()
  } catch {
    // silently ignore: plugin may be unavailable
  }
}

const webVibrate = (pattern) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern)
  }
}

export const hapticFeedback = {
  light: () => {
    if (isNative) {
      safeNative(() => Haptics.impact({ style: ImpactStyle.Light }))
    } else {
      webVibrate(10)
    }
  },

  medium: () => {
    if (isNative) {
      safeNative(() => Haptics.impact({ style: ImpactStyle.Medium }))
    } else {
      webVibrate(20)
    }
  },

  heavy: () => {
    if (isNative) {
      safeNative(() => Haptics.impact({ style: ImpactStyle.Heavy }))
    } else {
      webVibrate(50)
    }
  },

  success: () => {
    if (isNative) {
      safeNative(() => Haptics.notification({ type: NotificationType.Success }))
    } else {
      webVibrate([10, 50, 10])
    }
  },

  error: () => {
    if (isNative) {
      safeNative(() => Haptics.notification({ type: NotificationType.Error }))
    } else {
      webVibrate([20, 50, 20, 50, 20])
    }
  },

  custom: (pattern) => {
    if (isNative) {
      safeNative(() => Haptics.impact({ style: ImpactStyle.Light }))
    } else {
      webVibrate(pattern)
    }
  },
}
