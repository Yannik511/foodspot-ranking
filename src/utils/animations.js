/**
 * Animation Utility Functions
 * Provides consistent animation helpers across the app
 */

/**
 * Spring animation easing (iOS-like)
 */
export const springEasing = {
  gentle: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  default: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  snappy: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
}

/**
 * Fade in animation
 */
export const fadeIn = {
  from: { opacity: 0 },
  to: { opacity: 1 },
  duration: '0.3s',
  easing: springEasing.default,
}

/**
 * Slide up animation
 */
export const slideUp = {
  from: { opacity: 0, transform: 'translateY(20px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
  duration: '0.4s',
  easing: springEasing.gentle,
}

/**
 * Slide down animation
 */
export const slideDown = {
  from: { opacity: 0, transform: 'translateY(-20px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
  duration: '0.3s',
  easing: springEasing.default,
}

/**
 * Scale animation
 */
export const scale = {
  from: { opacity: 0, transform: 'scale(0.9)' },
  to: { opacity: 1, transform: 'scale(1)' },
  duration: '0.3s',
  easing: springEasing.gentle,
}

/**
 * Stagger animation delay calculator
 */
export const staggerDelay = (index, baseDelay = 50) => {
  return `${index * baseDelay}ms`
}

/**
 * Generate CSS animation string
 */
export const generateAnimation = (anim, delay = 0) => {
  return {
    animation: `${anim.duration} ${delay}ms ${anim.easing} both`,
  }
}
