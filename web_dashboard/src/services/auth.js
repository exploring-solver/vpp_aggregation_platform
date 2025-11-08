import { useCallback } from 'react'
import { useAuth0 } from '@auth0/auth0-react'

// Simple hook for making authenticated API calls with Auth0
export const useAuthToken = () => {
  const { getAccessTokenSilently, isAuthenticated, logout } = useAuth0()

  const makeApiCall = useCallback(async (url, options = {}) => {
    if (!isAuthenticated) {
      throw new Error('User not authenticated')
    }

    try {
      // Get fresh token from Auth0
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: "read:vpp write:vpp admin:vpp"
        }
      })

      // Make the request with the token
      const config = {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      }

      const response = await fetch(url, config)
      
      if (response.status === 401) {
        // Token expired or invalid, logout
        logout({ logoutParams: { returnTo: window.location.origin } })
        throw new Error('Session expired, please login again')
      }
      
      return response
    } catch (error) {
      console.error('API call error:', error)
      throw error
    }
  }, [getAccessTokenSilently, isAuthenticated, logout])

  return {
    makeApiCall,
    isAuthenticated
  }
}

export default useAuthToken
