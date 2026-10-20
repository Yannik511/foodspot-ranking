import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import { APP_VERSION } from '../data/changelog'

// In-App-Feedback. Backend: migrations/071_feedback.sql (nur Insert, max. 5 / 10 min).

export const FEEDBACK_CATEGORIES = [
  { key: 'idea', icon: '💡', label: 'Idee' },
  { key: 'bug', icon: '🐞', label: 'Fehler' },
  { key: 'praise', icon: '❤️', label: 'Lob' },
  { key: 'other', icon: '💬', label: 'Sonstiges' },
]

export const FEEDBACK_MAX_LENGTH = 2000

export const isValidFeedback = (category, message) =>
  FEEDBACK_CATEGORIES.some((c) => c.key === category) &&
  typeof message === 'string' &&
  message.trim().length > 0 &&
  message.trim().length <= FEEDBACK_MAX_LENGTH

export async function sendFeedback(userId, category, message) {
  return supabase.from('feedback').insert({
    user_id: userId,
    category,
    message: message.trim(),
    app_version: APP_VERSION,
    platform: Capacitor.getPlatform(),
  })
}
