/**
 * Gesture Handlers Utility
 * Provides touch gesture detection and handling
 */

/**
 * Long press handler
 * @param {Function} callback - Callback to execute on long press
 * @param {number} duration - Duration in ms (default: 600)
 * @returns {Object} - Handler object with start, end, and cancel methods
 */
export const useLongPress = (callback, duration = 600) => {
  let timer = null

  const start = () => {
    timer = setTimeout(() => {
      callback()
      timer = null
    }, duration)
  }

  const end = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return { start, end, cancel }
}

/**
 * Swipe detection
 * @param {Function} onSwipeLeft - Callback for left swipe
 * @param {Function} onSwipeRight - Callback for right swipe
 * @param {number} threshold - Minimum swipe distance in px (default: 50)
 * @returns {Object} - Handler object with touchStart, touchMove, and touchEnd methods
 */
export const useSwipe = (onSwipeLeft, onSwipeRight, threshold = 50) => {
  let startX = null
  let startY = null

  const touchStart = (e) => {
    const touch = e.touches?.[0] || e
    startX = touch.clientX
    startY = touch.clientY
  }

  const touchMove = (e) => {
    // Prevent default to avoid scrolling during swipe
    if (startX !== null && startY !== null) {
      e.preventDefault()
    }
  }

  const touchEnd = (e) => {
    if (startX === null || startY === null) return

    const touch = e.changedTouches?.[0] || e
    const endX = touch.clientX
    const endY = touch.clientY

    const deltaX = endX - startX
    const deltaY = endY - startY

    // Only detect horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight()
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft()
      }
    }

    startX = null
    startY = null
  }

  return { touchStart, touchMove, touchEnd }
}

/**
 * Pull to refresh detection
 * @param {Function} onRefresh - Callback to execute on pull to refresh
 * @param {number} threshold - Pull distance in px (default: 80)
 * @returns {Object} - Handler object and state
 */
export const usePullToRefresh = (onRefresh, threshold = 80) => {
  let startY = null
  let currentY = null
  let isPulling = false

  const touchStart = (e) => {
    const touch = e.touches?.[0]
    startY = touch.clientY
    isPulling = false
  }

  const touchMove = (e) => {
    if (startY === null) return

    const touch = e.touches?.[0]
    currentY = touch.clientY
    const deltaY = currentY - startY

    // Only trigger if scrolling from top
    if (window.scrollY === 0 && deltaY > 0) {
      isPulling = true
    }
  }

  const touchEnd = () => {
    if (isPulling && startY !== null && currentY !== null) {
      const deltaY = currentY - startY
      if (deltaY > threshold) {
        onRefresh()
      }
    }
    startY = null
    currentY = null
    isPulling = false
  }

  return { touchStart, touchMove, touchEnd }
}











