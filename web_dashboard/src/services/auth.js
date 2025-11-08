import { useCallback } from 'react'
import { useAuth0 } from '@auth0/auth0-react'

// Simple hook for making authenticated API calls with Auth0
export const useAuthToken = () => {
  const { getAccessTokenSilently, isAuthenticated, logout: auth0Logout } = useAuth0()

  const makeApiCall = useCallback(async (url, options = {}) => {
    // For GET requests, try without auth first (public read routes)
    const isReadRequest = !options.method || options.method === 'GET'
    
    try {
      let token = null
      
      // Try to get token if authenticated (for write operations or if available)
      if (isAuthenticated) {
        try {
          token = await getAccessTokenSilently({
            authorizationParams: {
              audience: import.meta.env.VITE_AUTH0_AUDIENCE,
              scope: "read:vpp write:vpp admin:vpp"
            }
          })
        } catch (tokenError) {
          // If token fetch fails but it's a read request, continue without token
          if (!isReadRequest) {
            throw tokenError
          }
        }
      }

      // Make the request
      const config = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      }

      // Add auth header only if we have a token
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(url, config)
      
      // For write operations, 401 means auth is required
      if (response.status === 401 && !isReadRequest) {
        if (isAuthenticated) {
          auth0Logout({ logoutParams: { returnTo: window.location.origin } })
        }
        throw new Error('Authentication required for this operation')
      }
      
      return response
    } catch (error) {
      console.error('API call error:', error)
      
      // Handle Auth0 errors
      if (error.error === 'login_required' || error.error === 'consent_required') {
        if (isAuthenticated) {
          auth0Logout({ logoutParams: { returnTo: window.location.origin } })
        }
        throw new Error('Please login again')
      }
      
      throw error
    }
  }, [getAccessTokenSilently, isAuthenticated, auth0Logout])

  const logout = useCallback(() => {
    auth0Logout({ logoutParams: { returnTo: window.location.origin } })
  }, [auth0Logout])

  return {
    makeApiCall,
    isAuthenticated,
    isLoading: false,
    isTokenReady: isAuthenticated,
    tokenError: null,
    logout
  }
}

export default useAuthToken
