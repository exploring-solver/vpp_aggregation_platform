import { useAuth0 } from '@auth0/auth0-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Zap, AlertCircle, Shield, Lock, ArrowRight } from 'lucide-react'

export default function Login() {
  const { 
    loginWithRedirect, 
    isAuthenticated, 
    error, 
    isLoading, 
    getAccessTokenSilently,
    user 
  } = useAuth0()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loginError, setLoginError] = useState(null)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isTokenLoading, setIsTokenLoading] = useState(false)

  useEffect(() => {
    const handleAuthentication = async () => {
      if (isAuthenticated && user) {
        setIsTokenLoading(true)
        try {
          // Get the Auth0 access token for API calls
          const accessToken = await getAccessTokenSilently({
            authorizationParams: {
              audience: import.meta.env.VITE_AUTH0_AUDIENCE,
              scope: "read:vpp write:vpp admin:vpp"
            }
          })
          
          // Store the access token and user info for API calls
          localStorage.setItem('access_token', accessToken)
          localStorage.setItem('user', JSON.stringify(user))
          
          // Also store in 'token' for backward compatibility
          localStorage.setItem('token', accessToken)
          
          console.log('Auth0 access token stored successfully')
          console.log('Token type:', typeof accessToken)
          console.log('Token length:', accessToken.length)
          
          navigate('/')
        } catch (err) {
          console.error('Error getting access token:', err)
          setLoginError('Failed to get access token. Please try logging in again.')
          // Clear any partial auth state
          localStorage.removeItem('access_token')
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        } finally {
          setIsTokenLoading(false)
        }
      }
    }

    handleAuthentication()
  }, [isAuthenticated, user, getAccessTokenSilently, navigate])

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
      setIsRedirecting(true)
      await loginWithRedirect({
        appState: {
          returnTo: '/',
        },
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: "read:vpp write:vpp admin:vpp",
          screen_hint: 'login',
        },
      })
    } catch (err) {
      console.error('Login error:', err)
      setLoginError(err.message || 'Failed to initiate login. Please try again.')
      setIsRedirecting(false)
    }
  }

  if (isLoading || isRedirecting || isTokenLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-600 border-t-transparent mx-auto"></div>
          <p className="mt-6 text-lg font-medium text-gray-700">
            {isRedirecting ? 'Redirecting to secure login...' : 
             isTokenLoading ? 'Securing your session...' : 'Loading...'}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {isTokenLoading ? 'Getting your access token...' : 
             'Please wait while we prepare your secure authentication'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left side - Branding and Info */}
          <div className="hidden md:block space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-primary-600 rounded-xl shadow-lg">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">VPP Platform</h1>
            </div>
            <h2 className="text-4xl font-bold text-gray-900 leading-tight">
              Intelligent Grid Flexibility Aggregation
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Manage and control your Virtual Power Plant operations with real-time monitoring, 
              dispatch control, and intelligent forecasting.
            </p>
            <div className="space-y-4 mt-8">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-gray-700">Enterprise-grade security</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Lock className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-gray-700">Secure authentication</span>
              </div>
            </div>
          </div>

          {/* Right side - Login Form */}
          <div className="w-full">
            <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
              {/* Mobile Logo */}
              <div className="md:hidden text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-primary-600 rounded-xl shadow-lg">
                    <Zap className="w-10 h-10 text-white" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  VPP Aggregation Platform
                </h2>
              </div>

              {/* Desktop Header */}
              <div className="hidden md:block mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Welcome Back
                </h2>
                <p className="text-gray-600">
                  Sign in to access your dashboard
                </p>
              </div>

              {loginError && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg flex items-start animate-in slide-in-from-top">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">Authentication Error</p>
                    <p className="text-xs text-red-600 mt-1">{loginError}</p>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <button
                  onClick={handleLogin}
                  disabled={isLoading || isRedirecting}
                  className="w-full group relative flex items-center justify-center px-6 py-4 border border-transparent text-base font-medium rounded-xl text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <Lock className="w-5 h-5 mr-2" />
                  <span>Sign In with Auth0</span>
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Secure Authentication</span>
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <p className="text-xs text-gray-500">
                    By signing in, you agree to our terms of service and privacy policy
                  </p>
                  <div className="flex items-center justify-center space-x-2 text-xs text-gray-400">
                    <Shield className="w-4 h-4" />
                    <span>Powered by Auth0</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Need help? <a href="#" className="text-primary-600 hover:text-primary-700 font-medium">Contact Support</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
