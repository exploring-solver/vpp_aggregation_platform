import { useAuth0 } from '@auth0/auth0-react'

export default function ProtectedRoute({ children }) {
  const { isLoading } = useAuth0()

  // Allow access without authentication - auth is optional for viewing
  // Write operations will require auth at the API level
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Loading VPP Platform...</p>
        </div>
      </div>
    )
  }

  // Allow access - authentication is optional for viewing dashboard
  return children
}
