import { useAuth0 } from '@auth0/auth0-react'
import { Navigate } from 'react-router-dom'
import { useAuthToken } from '../services/auth'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth0()
  const { isTokenReady, tokenError } = useAuthToken()

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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Wait for token to be ready before rendering children
  if (!isTokenReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Preparing your session...</p>
          <p className="mt-2 text-sm text-gray-500">Getting access token ready</p>
          {tokenError && (
            <p className="mt-2 text-sm text-red-600">Error: {tokenError}</p>
          )}
        </div>
      </div>
    )
  }

  return children
}
