import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { addPushListeners, registerForPush } from '../services/push'

// Verbindet Push mit Login und Router: sobald jemand angemeldet ist, wird das
// Geraet registriert; ein Tap auf eine Benachrichtigung oeffnet den Screen.
export default function PushBridge() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    const removeListeners = addPushListeners({ onOpen: (route) => navigate(route) })
    registerForPush()
    return removeListeners
  }, [userId, navigate])

  return null
}
