import { useAuth0 } from '@auth0/auth0-react'

export class AuthService {
  static getStoredToken() {
    // Prefer access_token, fallback to token for backward compatibility
    return localStorage.getItem('access_token') || localStorage.getItem('token')
  }

  static getStoredUser() {
    try {
      const user = localStorage.getItem('user')
      return user ? JSON.parse(user) : null
    } catch {
      return null
    }
  }

  static clearStoredAuth() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  static isTokenExpired(token) {
    if (!token) return true
    
    try {
      // Auth0 access tokens might be JWE (encrypted), not JWT (signed)
      // If it's encrypted, we can't decode it client-side, so assume it's valid
      const parts = token.split('.')
      
      // JWE tokens have 5 parts, JWT tokens have 3 parts
      if (parts.length === 5) {
        // This is likely an encrypted JWE token, we can't verify expiration client-side
        console.log('Detected JWE token - cannot verify expiration client-side')
        return false
      } else if (parts.length === 3) {
        // Standard JWT token
        const payload = JSON.parse(atob(parts[1]))
        const currentTime = Date.now() / 1000
        const isExpired = payload.exp < currentTime
        console.log('JWT token expiration check:', { exp: payload.exp, now: currentTime, isExpired })
        return isExpired
      } else {
        console.error('Invalid token format')
        return true
      }
    } catch (error) {
      console.error('Error checking token expiration:', error)
      return false // If we can't decode, assume it's valid and let the server decide
    }
  }

  static async makeAuthenticatedRequest(url, options = {}) {
    const token = this.getStoredToken()
    
    if (!token) {
      console.error('No token found in localStorage')
      throw new Error('No valid token available')
    }
    
    if (this.isTokenExpired(token)) {
      console.error('Token has expired')
      throw new Error('No valid token available')
    }

    console.log('Making authenticated request to:', url)
    console.log('Token preview:', token.substring(0, 50) + '...')

    const config = {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    }

    const response = await fetch(url, config)
    
    console.log('Response status:', response.status)
    
    if (response.status === 401) {
      // Token expired or invalid, clear stored auth
      console.error('Authentication failed - clearing stored auth')
      this.clearStoredAuth()
      throw new Error('Authentication failed')
    }

    return response
  }
}

// Custom hook for Auth0 token management
export const useAuthToken = () => {
  const { getAccessTokenSilently, isAuthenticated, user, logout } = useAuth0()

  const refreshToken = async () => {
    if (!isAuthenticated || !user) {
      throw new Error('User not authenticated')
    }

    try {
      const accessToken = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: "read:vpp write:vpp admin:vpp"
        }
      })
      
      localStorage.setItem('access_token', accessToken)
      localStorage.setItem('token', accessToken) // Backward compatibility
      localStorage.setItem('user', JSON.stringify(user))
      return accessToken
    } catch (error) {
      console.error('Error refreshing token:', error)
      AuthService.clearStoredAuth()
      throw error
    }
  }

  const makeApiCall = async (url, options = {}) => {
    try {
      return await AuthService.makeAuthenticatedRequest(url, options)
    } catch (error) {
      if (error.message === 'No valid token available' || error.message === 'Authentication failed') {
        // Try to refresh token
        try {
          await refreshToken()
          return await AuthService.makeAuthenticatedRequest(url, options)
        } catch (refreshError) {
          // Refresh failed, redirect to login
          logout({ logoutParams: { returnTo: window.location.origin } })
          throw new Error('Session expired, please login again')
        }
      }
      throw error
    }
  }

  return {
    refreshToken,
    makeApiCall,
    getStoredToken: AuthService.getStoredToken,
    getStoredUser: AuthService.getStoredUser,
    clearStoredAuth: AuthService.clearStoredAuth,
    isTokenExpired: AuthService.isTokenExpired
  }
}

export default AuthService