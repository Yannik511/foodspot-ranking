import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProfileProvider } from './contexts/ProfileContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Landing from './pages/Landing'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import Dashboard from './pages/Dashboard'
import CreateList from './pages/CreateList'
import SelectCategory from './pages/SelectCategory'
import TierList from './pages/TierList'
import AddFoodspot from './pages/AddFoodspot'
import SharedTierList from './pages/shared/SharedTierList'
import AddSharedFoodspot from './pages/shared/AddSharedFoodspot'
import Account from './pages/Account'
import Settings from './pages/Settings'
import About from './pages/About'
import Social from './pages/Social'
import FriendProfile from './pages/FriendProfile'
import Compare from './pages/Compare'
import Discover from './pages/Discover'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProfileProvider>
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
            path="/shared/tierlist/:id"
            element={
              <ProtectedRoute>
                <SharedTierList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shared/add-foodspot/:id"
            element={
              <ProtectedRoute>
                <AddSharedFoodspot />
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
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/about"
            element={
              <ProtectedRoute>
                <About />
              </ProtectedRoute>
            }
          />
          <Route
            path="/social"
            element={
              <ProtectedRoute>
                <Social />
              </ProtectedRoute>
            }
          />
          <Route
            path="/friend/:id"
            element={
              <ProtectedRoute>
                <FriendProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/discover"
            element={
              <ProtectedRoute>
                <Discover />
              </ProtectedRoute>
            }
          />
          <Route
            path="/compare/:id"
            element={
              <ProtectedRoute>
                <Compare />
              </ProtectedRoute>
            }
          />
        </Routes>
          </BrowserRouter>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
