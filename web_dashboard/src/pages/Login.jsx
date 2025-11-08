import { useAuth0 } from '@auth0/auth0-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'

export default function Login() {
  const { loginWithRedirect, isAuthenticated } = useAuth0()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])

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
          <button
            onClick={() => loginWithRedirect()}
            className="w-full btn btn-primary py-3 text-lg"
          >
            Sign In
          </button>
          <p className="text-center text-xs text-gray-500">
            Secure authentication powered by Auth0
          </p>
        </div>
      </div>
    </div>
  )
}
