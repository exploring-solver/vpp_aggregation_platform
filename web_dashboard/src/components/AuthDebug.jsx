import { useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { useAuthToken } from '../services/auth'

export default function AuthDebug() {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0()
  const { getStoredToken, makeApiCall } = useAuthToken()
  const [debugInfo, setDebugInfo] = useState({})

  useEffect(() => {
    const updateDebugInfo = () => {
      const token = getStoredToken()
      setDebugInfo({
        isAuthenticated,
        hasUser: !!user,
        hasStoredToken: !!token,
        tokenPreview: token ? token.substring(0, 50) + '...' : 'None',
        userInfo: user ? {
          email: user.email,
          name: user.name,
          sub: user.sub
        } : null
      })
    }

    updateDebugInfo()
  }, [isAuthenticated, user, getStoredToken])

  const testApiCall = async () => {
    try {
      const response = await makeApiCall('http://154.201.127.96:3000/api/aggregate')
      const data = await response.json()
      console.log('API call successful:', data)
      alert('API call successful! Check console for details.')
    } catch (error) {
      console.error('API call failed:', error)
      alert('API call failed: ' + error.message)
    }
  }

  const refreshToken = async () => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: "read:vpp write:vpp admin:vpp"
        }
      })
      localStorage.setItem('access_token', token)
      localStorage.setItem('token', token)
      console.log('Token refreshed:', token.substring(0, 50) + '...')
      alert('Token refreshed successfully!')
    } catch (error) {
      console.error('Token refresh failed:', error)
      alert('Token refresh failed: ' + error.message)
    }
  }

  if (!isAuthenticated) {
    return <div className="p-4 bg-yellow-100 rounded">User not authenticated</div>
  }

  return (
    <div className="p-6 bg-gray-100 rounded-lg space-y-4">
      <h3 className="text-lg font-bold">Auth Debug Info</h3>
      <pre className="bg-white p-4 rounded text-sm overflow-auto">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
      <div className="space-x-2">
        <button 
          onClick={testApiCall}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Test API Call
        </button>
        <button 
          onClick={refreshToken}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Refresh Token
        </button>
      </div>
    </div>
  )
}