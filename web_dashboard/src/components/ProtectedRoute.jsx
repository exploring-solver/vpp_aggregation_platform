import { useAuth0 } from '@auth0/auth0-react'
import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
// import { useAuthToken } from '../services/auth'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth0()
  // const { ensureValidToken } = useAuthToken()
  const [tokenReady, setTokenReady] = useState(false)
  const [tokenError, setTokenError] = useState(null)

  useEffect(() => {
    const prepareToken = async () => {
      if (isAuthenticated && user && !tokenReady && !tokenError) {
        try {
          console.log('ProtectedRoute: Ensuring valid token...')
          await ensureValidToken()
          console.log('ProtectedRoute: Token ready')
          setTokenReady(true)
        } catch (error) {
          console.error('ProtectedRoute: Token preparation failed:', error)
          setTokenError(error.message)
        }
      }
    }

    prepareToken()
  }, [isAuthenticated, user, ensureValidToken, tokenReady, tokenError])

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

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Token Error</h2>
          <p className="text-gray-600 mb-6">{tokenError}</p>
          <Navigate to="/login" replace />
        </div>
      </div>
    )
  }

  if (!tokenReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Preparing your session...</p>
          <p className="mt-2 text-sm text-gray-500">Getting access token ready</p>
        </div>
      </div>
    )
  }

  return children
}
