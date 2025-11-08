import { useCallback, useState, useEffect } from 'react'
import { useAuth0 } from '@auth0/auth0-react'

// Simple hook for making authenticated API calls with Auth0
export const useAuthToken = () => {
  const { 
    getAccessTokenSilently, 
    isAuthenticated, 
    isLoading,
    logout,
    error: auth0Error
  } = useAuth0()
  
  const [isTokenReady, setIsTokenReady] = useState(false)
  const [tokenError, setTokenError] = useState(null)

  // Ensure we have a valid token ready before allowing API calls
  useEffect(() => {
    let isMounted = true

    const ensureToken = async () => {
      if (isLoading) {
        if (isMounted) {
          setIsTokenReady(false)
        }
        return
      }

      if (!isAuthenticated) {
        if (isMounted) {
          setIsTokenReady(false)
          setTokenError('Not authenticated')
        }
        return
      }

      if (auth0Error) {
        if (isMounted) {
          setIsTokenReady(false)
          setTokenError(auth0Error.message)
        }
        return
      }

      try {
        // Try to get a token to verify Auth0 is ready
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
            scope: "read:vpp write:vpp admin:vpp"
          },
          cacheMode: 'on' // Use cache for better performance
        })

        if (isMounted) {
          if (token) {
            // Store token for quick access
            localStorage.setItem('access_token', token)
            localStorage.setItem('token', token) // Backward compatibility
            setIsTokenReady(true)
            setTokenError(null)
          } else {
            setIsTokenReady(false)
            setTokenError('Failed to get token')
          }
        }
      } catch (error) {
        console.error('Error ensuring token:', error)
        if (isMounted) {
          setIsTokenReady(false)
          setTokenError(error.message)
        }
        
        // If it's a login_required error, redirect to login
        if (error.error === 'login_required' || error.error === 'consent_required') {
          logout({ logoutParams: { returnTo: window.location.origin } })
        }
      }
    }

    ensureToken()

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, isLoading, auth0Error, getAccessTokenSilently, logout])

  const makeApiCall = useCallback(async (url, options = {}) => {
    // Wait for Auth0 to be ready
    if (isLoading) {
      throw new Error('Authentication is still loading, please wait')
    }

    if (!isAuthenticated) {
      throw new Error('User not authenticated. Please login.')
    }

    if (tokenError && !isTokenReady) {
      throw new Error(`Authentication error: ${tokenError}`)
    }

    try {
      // Get fresh token from Auth0 (it will use cache if available)
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: "read:vpp write:vpp admin:vpp"
        },
        cacheMode: 'on' // Use cache, but will refresh if expired
      })

      if (!token) {
        throw new Error('Failed to get access token')
      }

      // Store token
      localStorage.setItem('access_token', token)
      localStorage.setItem('token', token)

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
        // Token might be expired, try to get a fresh one
        try {
          console.log('Got 401, attempting to refresh token...')
          const freshToken = await getAccessTokenSilently({
            authorizationParams: {
              audience: import.meta.env.VITE_AUTH0_AUDIENCE,
              scope: "read:vpp write:vpp admin:vpp"
            },
            cacheMode: 'off' // Force refresh
          })

          if (freshToken) {
            localStorage.setItem('access_token', freshToken)
            localStorage.setItem('token', freshToken)
            
            // Retry the request with fresh token
            const retryConfig = {
              ...options,
              headers: {
                'Authorization': `Bearer ${freshToken}`,
                'Content-Type': 'application/json',
                ...options.headers
              }
            }
            const retryResponse = await fetch(url, retryConfig)
            
            if (retryResponse.status === 401) {
              // Still 401 after refresh, session is invalid
              logout({ logoutParams: { returnTo: window.location.origin } })
              throw new Error('Session expired, please login again')
            }
            
            return retryResponse
          } else {
            throw new Error('Failed to refresh token')
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError)
          logout({ logoutParams: { returnTo: window.location.origin } })
          throw new Error('Session expired, please login again')
        }
      }
      
      return response
    } catch (error) {
      console.error('API call error:', error)
      
      // Handle specific Auth0 errors
      if (error.error === 'login_required' || error.error === 'consent_required') {
        logout({ logoutParams: { returnTo: window.location.origin } })
        throw new Error('Please login again')
      }
      
      throw error
    }
  }, [getAccessTokenSilently, isAuthenticated, isLoading, tokenError, isTokenReady, logout])

  return {
    makeApiCall,
    isAuthenticated,
    isLoading,
    isTokenReady,
    tokenError
  }
}

export default useAuthToken
