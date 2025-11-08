import { useAuth0 } from '@auth0/auth0-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Zap, AlertCircle } from 'lucide-react'

export default function Login() {
  const { loginWithRedirect, isAuthenticated, error, isLoading } = useAuth0()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loginError, setLoginError] = useState(null)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    // Check for error in URL params (from Auth0 callback)
    const errorParam = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    
    if (errorParam) {
      setLoginError(errorDescription || errorParam)
    } else if (error) {
      setLoginError(error.message || 'Authentication error occurred')
    } else {
      setLoginError(null)
    }
  }, [searchParams, error])

  const handleLogin = async () => {
    try {
      setLoginError(null)
      await loginWithRedirect({
        appState: {
          returnTo: '/',
        },
      })
    } catch (err) {
      console.error('Login error:', err)
      setLoginError(err.message || 'Failed to initiate login. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-2xl">
        <div className="text-center">
          <div className="flex justify-center">
            <Zap className="w-16 h-16 text-primary-600" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            VPP Aggregation Platform
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Virtual Power Plant Management & Control
          </p>
        </div>
        <div className="mt-8 space-y-6">
          {loginError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Authentication Error</p>
                <p className="text-xs text-red-600 mt-1">{loginError}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogin}
            className="w-full btn btn-primary py-3 text-lg"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
          <p className="text-center text-xs text-gray-500">
            Secure authentication powered by Auth0
          </p>
        </div>
      </div>
    </div>
  )
}
