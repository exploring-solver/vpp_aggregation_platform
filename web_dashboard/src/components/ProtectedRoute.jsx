import { Navigate } from 'react-router-dom'
import { useAuthToken } from '../services/auth'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isTokenReady, isLoading, tokenError } = useAuthToken()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Loading VPP Platform...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !isTokenReady) {
    return <Navigate to="/login" replace />
  }

  return children
}
