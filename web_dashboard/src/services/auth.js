// import { useAuth0 } from '@auth0/auth0-react'

// // Token promise to handle concurrent requests
// let tokenPromise = null

// export class AuthService {
//   static getStoredToken() {
//     // Prefer access_token, fallback to token for backward compatibility
//     return localStorage.getItem('access_token') || localStorage.getItem('token')
//   }

//   static getStoredUser() {
//     try {
//       const user = localStorage.getItem('user')
//       return user ? JSON.parse(user) : null
//     } catch {
//       return null
//     }
//   }

//   static clearStoredAuth() {
//     localStorage.removeItem('access_token')
//     localStorage.removeItem('token')
//     localStorage.removeItem('user')
//   }

//   static isTokenExpired(token) {
//     if (!token) return true
    
//     try {
//       // Auth0 access tokens might be JWE (encrypted), not JWT (signed)
//       // If it's encrypted, we can't decode it client-side, so assume it's valid
//       const parts = token.split('.')
      
//       // JWE tokens have 5 parts, JWT tokens have 3 parts
//       if (parts.length === 5) {
//         // This is likely an encrypted JWE token, we can't verify expiration client-side
//         console.log('Detected JWE token - cannot verify expiration client-side')
//         return false
//       } else if (parts.length === 3) {
//         // Standard JWT token
//         const payload = JSON.parse(atob(parts[1]))
//         const currentTime = Date.now() / 1000
//         const isExpired = payload.exp < currentTime
//         console.log('JWT token expiration check:', { exp: payload.exp, now: currentTime, isExpired })
//         return isExpired
//       } else {
//         console.error('Invalid token format')
//         return true
//       }
//     } catch (error) {
//       console.error('Error checking token expiration:', error)
//       return false // If we can't decode, assume it's valid and let the server decide
//     }
//   }

//   static async makeAuthenticatedRequest(url, options = {}) {
//     const token = this.getStoredToken()
    
//     if (!token) {
//       console.error('No token found in localStorage')
//       throw new Error('No valid token available')
//     }
    
//     if (this.isTokenExpired(token)) {
//       console.error('Token has expired')
//       throw new Error('No valid token available')
//     }

//     console.log('Making authenticated request to:', url)
//     console.log('Token preview:', token.substring(0, 50) + '...')

//     const config = {
//       ...options,
//       headers: {
//         'Authorization': `Bearer ${token}`,
//         'Content-Type': 'application/json',
//         ...options.headers
//       }
//     }

//     const response = await fetch(url, config)
    
//     console.log('Response status:', response.status)
    
//     if (response.status === 401) {
//       // Token expired or invalid, clear stored auth
//       console.error('Authentication failed - clearing stored auth')
//       this.clearStoredAuth()
//       throw new Error('Authentication failed')
//     }

//     return response
//   }
// }

// // Custom hook for Auth0 token management
// export const useAuthToken = () => {
//   const { getAccessTokenSilently, isAuthenticated, user, logout } = useAuth0()

//   const ensureValidToken = async () => {
//     // If we already have a promise pending, wait for it
//     if (tokenPromise) {
//       console.log('Waiting for existing token request...')
//       return await tokenPromise
//     }

//     // Check if we have a valid stored token first
//     const storedToken = AuthService.getStoredToken()
//     if (storedToken && !AuthService.isTokenExpired(storedToken)) {
//       console.log('Using valid stored token')
//       return storedToken
//     }

//     // If not authenticated, throw error
//     if (!isAuthenticated || !user) {
//       throw new Error('User not authenticated')
//     }

//     // Create a new token request promise
//     tokenPromise = getAccessTokenSilently({
//       authorizationParams: {
//         audience: import.meta.env.VITE_AUTH0_AUDIENCE,
//         scope: "read:vpp write:vpp admin:vpp"
//       },
//       cacheMode: 'off' // Force fresh token request
//     })

//     try {
//       console.log('Requesting new token from Auth0...')
//       const accessToken = await tokenPromise
      
//       console.log('Got new token, storing...', accessToken.substring(0, 50) + '...')
//       localStorage.setItem('access_token', accessToken)
//       localStorage.setItem('token', accessToken) // Backward compatibility
//       localStorage.setItem('user', JSON.stringify(user))
      
//       return accessToken
//     } catch (error) {
//       console.error('Error getting token:', error)
//       AuthService.clearStoredAuth()
//       throw error
//     } finally {
//       // Clear the promise so next request can create a new one
//       tokenPromise = null
//     }
//   }

//   const refreshToken = async () => {
//     // Clear any cached token and force refresh
//     AuthService.clearStoredAuth()
//     return await ensureValidToken()
//   }

//   const makeApiCall = async (url, options = {}) => {
//     try {
//       // Always ensure we have a valid token before making the request
//       const token = await ensureValidToken()
//       console.log('Making API call with token:', token.substring(0, 50) + '...')
      
//       // Make the request with the fresh token
//       const config = {
//         ...options,
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//           ...options.headers
//         }
//       }

//       const response = await fetch(url, config)
//       console.log('API response status:', response.status)
      
//       if (response.status === 401) {
//         console.log('Got 401, trying to refresh token...')
//         // Token might be expired, try to refresh
//         try {
//           const freshToken = await refreshToken()
//           const retryConfig = {
//             ...options,
//             headers: {
//               'Authorization': `Bearer ${freshToken}`,
//               'Content-Type': 'application/json',
//               ...options.headers
//             }
//           }
//           const retryResponse = await fetch(url, retryConfig)
          
//           if (retryResponse.status === 401) {
//             // Still 401 after refresh, logout
//             logout({ logoutParams: { returnTo: window.location.origin } })
//             throw new Error('Session expired, please login again')
//           }
          
//           return retryResponse
//         } catch (refreshError) {
//           console.error('Token refresh failed:', refreshError)
//           logout({ logoutParams: { returnTo: window.location.origin } })
//           throw new Error('Session expired, please login again')
//         }
//       }
      
//       return response
//     } catch (error) {
//       if (error.message === 'User not authenticated') {
//         logout({ logoutParams: { returnTo: window.location.origin } })
//         throw new Error('Please login again')
//       }
//       throw error
//     }
//   }

//   return {
//     ensureValidToken,
//     refreshToken,
//     makeApiCall,
//     getStoredToken: AuthService.getStoredToken,
//     getStoredUser: AuthService.getStoredUser,
//     clearStoredAuth: AuthService.clearStoredAuth,
//     isTokenExpired: AuthService.isTokenExpired
//   }
// }

// export default AuthService