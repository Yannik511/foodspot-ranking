import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { primeLocation } from '../utils/geo'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const userId = user?.id

  // Standort einmal pro Sitzung vorwaermen, sobald jemand eingeloggt ist.
  // Beim allerersten Start kommt hier die iOS-Berechtigungsabfrage — danach
  // liegt der Standort im gemeinsamen Speicher und Entdecken, Ortspicker und
  // Weltkarte starten sofort damit, statt jeweils neu zu warten.
  useEffect(() => {
    if (userId) primeLocation()
  }, [userId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Lädt...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute

























