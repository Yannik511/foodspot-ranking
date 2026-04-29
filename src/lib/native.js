import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { Keyboard } from '@capacitor/keyboard'

export const isNative = Capacitor.isNativePlatform()
export const isIOS = Capacitor.getPlatform() === 'ios'

export async function initNative() {
  if (!isNative) return

  await StatusBar.setStyle({ style: Style.Dark })

  if (isIOS) {
    Keyboard.setAccessoryBarVisible({ isVisible: false })
    Keyboard.setScroll({ isDisabled: false })
  }

  await SplashScreen.hide({ fadeOutDuration: 300 })
}
