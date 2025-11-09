import { Routes, Route, Navigate } from 'react-router-dom'
import { vendorAuth } from './services/auth'
import Login from './pages/Login'
import Register from './pages/Register'
import Marketplace from './pages/Marketplace'

function ProtectedRoute({ children }) {
  if (!vendorAuth.isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return children
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/marketplace"
        element={
          <ProtectedRoute>
            <Marketplace />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/marketplace" replace />} />
    </Routes>
  )
}

export default App
