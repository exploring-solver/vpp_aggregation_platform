import { useAuth0 } from '@auth0/auth0-react'

export class AuthService {
  static getStoredToken() {
    return localStorage.getItem('token')
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
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  static isTokenExpired(token) {
    if (!token) return true
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const currentTime = Date.now() / 1000
      return payload.exp < currentTime
    } catch {
      return true
    }
  }

  static async makeAuthenticatedRequest(url, options = {}) {
    const token = this.getStoredToken()
    
    if (!token || this.isTokenExpired(token)) {
      throw new Error('No valid token available')
    }

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
      // Token expired or invalid, clear stored auth
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
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: "read:vpp write:vpp admin:vpp"
        }
      })
      
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      return token
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