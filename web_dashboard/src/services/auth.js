import { useCallback, useState, useEffect } from 'react'

// Simple hook for making authenticated API calls with JWT tokens
export const useAuthToken = () => {
  const [isTokenReady, setIsTokenReady] = useState(false)
  const [tokenError, setTokenError] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check if we have a valid token
  useEffect(() => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token')
    const user = localStorage.getItem('user')
    
    if (token && user) {
      try {
        // Basic token validation - check if it's a JWT
        const parts = token.split('.')
        if (parts.length === 3) {
          // Decode to check expiration (basic check)
          const payload = JSON.parse(atob(parts[1]))
          const currentTime = Date.now() / 1000
          
          if (payload.exp && payload.exp > currentTime) {
            setIsTokenReady(true)
            setIsAuthenticated(true)
            setTokenError(null)
          } else {
            // Token expired
            localStorage.removeItem('access_token')
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            setIsTokenReady(false)
            setIsAuthenticated(false)
            setTokenError('Token expired')
          }
        } else {
          // Not a JWT, assume it's valid
          setIsTokenReady(true)
          setIsAuthenticated(true)
          setTokenError(null)
        }
      } catch (error) {
        console.error('Error validating token:', error)
        setIsTokenReady(false)
        setIsAuthenticated(false)
        setTokenError('Invalid token')
      }
    } else {
      setIsTokenReady(false)
      setIsAuthenticated(false)
      setTokenError('No token found')
    }
  }, [])

  const makeApiCall = useCallback(async (url, options = {}) => {
    if (!isAuthenticated || !isTokenReady) {
      throw new Error('User not authenticated. Please login.')
    }

    const token = localStorage.getItem('access_token') || localStorage.getItem('token')
    
    if (!token) {
      throw new Error('No token found. Please login again.')
    }

    try {
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
        // Token expired or invalid
        localStorage.removeItem('access_token')
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setIsTokenReady(false)
        setIsAuthenticated(false)
        
        // Redirect to login
        window.location.href = '/login'
        throw new Error('Session expired, please login again')
      }
      
      return response
    } catch (error) {
      console.error('API call error:', error)
      throw error
    }
  }, [isAuthenticated, isTokenReady])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setIsTokenReady(false)
    setIsAuthenticated(false)
    window.location.href = '/login'
  }, [])

  return {
    makeApiCall,
    isAuthenticated,
    isLoading: false,
    isTokenReady,
    tokenError,
    logout
  }
}

export default useAuthToken
