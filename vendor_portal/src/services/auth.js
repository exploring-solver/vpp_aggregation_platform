// Vendor authentication service (JWT-based)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

let authToken = null

export const vendorAuth = {
  // Login vendor
  async login(email, password) {
    try {
      const response = await fetch(`${API_URL}/api/vendor-auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (data.success && data.token) {
        authToken = data.token
        localStorage.setItem('vendor_token', data.token)
        localStorage.setItem('vendor_user', JSON.stringify(data.vendor))
        return { success: true, vendor: data.vendor, token: data.token }
      } else {
        throw new Error(data.error || 'Login failed')
      }
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  },

  // Register vendor
  async register(email, password, companyName, contactName, phone) {
    try {
      const response = await fetch(`${API_URL}/api/vendor-auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, companyName, contactName, phone })
      })

      const data = await response.json()

      if (data.success && data.token) {
        authToken = data.token
        localStorage.setItem('vendor_token', data.token)
        localStorage.setItem('vendor_user', JSON.stringify(data.vendor))
        return { success: true, vendor: data.vendor, token: data.token }
      } else {
        throw new Error(data.error || 'Registration failed')
      }
    } catch (error) {
      console.error('Registration error:', error)
      throw error
    }
  },

  // Logout
  logout() {
    authToken = null
    localStorage.removeItem('vendor_token')
    localStorage.removeItem('vendor_user')
  },

  // Get current vendor
  getCurrentVendor() {
    const vendorStr = localStorage.getItem('vendor_user')
    if (vendorStr) {
      return JSON.parse(vendorStr)
    }
    return null
  },

  // Get token
  getToken() {
    if (!authToken) {
      authToken = localStorage.getItem('vendor_token')
    }
    return authToken
  },

  // Check if authenticated
  isAuthenticated() {
    return !!this.getToken()
  },

  // Make authenticated API call
  async makeApiCall(url, options = {}) {
    const token = this.getToken()
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    return response
  }
}

// Initialize token from localStorage
authToken = localStorage.getItem('vendor_token')

