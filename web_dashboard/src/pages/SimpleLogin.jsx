import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, AlertCircle, Lock, ArrowRight } from 'lucide-react'

export default function SimpleLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/auth/login`
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (response.ok && data.token) {
        // Store token
        localStorage.setItem('access_token', data.token)
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        
        // Navigate to dashboard
        navigate('/')
      } else {
        setError(data.message || 'Login failed. Please check your credentials.')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Failed to connect to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left side - Branding */}
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
            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Default credentials:</strong><br />
                Email: admin@vpp.com<br />
                Password: admin123
              </p>
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

              {error && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">Login Error</p>
                    <p className="text-xs text-red-600 mt-1">{error}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="admin@vpp.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter password (optional in dev mode)"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full group relative flex items-center justify-center px-6 py-4 border border-transparent text-base font-medium rounded-xl text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <Lock className="w-5 h-5 mr-2" />
                  <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

