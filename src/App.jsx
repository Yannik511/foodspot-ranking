import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Landing from './pages/Landing'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import Dashboard from './pages/Dashboard'
import CreateList from './pages/CreateList'
import SelectCategory from './pages/SelectCategory'
import TierList from './pages/TierList'
import AddFoodspot from './pages/AddFoodspot'
import Account from './pages/Account'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/select-category"
            element={
              <ProtectedRoute>
                <SelectCategory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-list"
            element={
              <ProtectedRoute>
                <CreateList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tierlist/:id"
            element={
              <ProtectedRoute>
                <TierList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add-foodspot/:id"
            element={
              <ProtectedRoute>
                <AddFoodspot />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
