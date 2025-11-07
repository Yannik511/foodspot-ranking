import { useEffect } from 'react'
import { Redirect } from 'expo-router'
import { useAuth } from '../src/contexts/AuthContext'
import Landing from '../src/pages/Landing'

export default function Index() {
  const { user, loading } = useAuth()

  if (loading) {
    return null // Oder ein Loading-Screen
  }

  if (user) {
    return <Redirect href="/(tabs)/dashboard" />
  }

  return <Landing />
}

