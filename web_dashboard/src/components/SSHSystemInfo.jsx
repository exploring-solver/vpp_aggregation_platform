import { useState, useEffect } from 'react'
import { Server, RefreshCw, CheckCircle2, XCircle, Loader } from 'lucide-react'
import { useAuthToken } from '../services/auth'

export default function SSHSystemInfo({ dcId }) {
  const [systemInfo, setSystemInfo] = useState(null)
  const [edgeInfo, setEdgeInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const { makeApiCall } = useAuthToken()

  useEffect(() => {
    fetchSystemInfo()
    fetchEdgeInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dcId])

  const fetchSystemInfo = async () => {
    setLoading(true)
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/ssh/${dcId}/system-info`
      const response = await makeApiCall(apiUrl)
      if (response.ok) {
        const data = await response.json()
        setSystemInfo(data.data)
      } else {
        // Handle error response
        const errorData = await response.json().catch(() => ({}))
        console.error('Error fetching system info:', errorData.error || response.statusText)
        setSystemInfo(null)
      }
    } catch (error) {
      console.error('Error fetching system info:', error)
      setSystemInfo(null)
    } finally {
      setLoading(false)
    }
  }

  const fetchEdgeInfo = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/ssh/${dcId}/edge-info`
      const response = await makeApiCall(apiUrl)
      if (response.ok) {
        const data = await response.json()
        setEdgeInfo(data.data)
      } else {
        // Handle error response
        const errorData = await response.json().catch(() => ({}))
        console.error('Error fetching edge info:', errorData.error || response.statusText)
        setEdgeInfo(null)
      }
    } catch (error) {
      console.error('Error fetching edge info:', error)
      setEdgeInfo(null)
    }
  }

  const refresh = () => {
    fetchSystemInfo()
    fetchEdgeInfo()
  }

  const InfoCard = ({ title, data, icon: Icon }) => (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {Icon && (
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
              <Icon className="w-5 h-5 text-white" />
            </div>
          )}
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3">
        {data ? (
          Object.entries(data).map(([key, value]) => (
            <div key={key} className="border-b border-gray-200 pb-3 last:border-0">
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {key.replace(/_/g, ' ')}:
                </span>
                {value.success !== undefined && (
                  <div className="flex items-center space-x-1">
                    {value.success ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                )}
              </div>
              {value.output && (
                <pre className="mt-1 text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                  {value.output}
                </pre>
              )}
              {value.error && (
                <pre className="mt-1 text-xs text-red-600 font-mono bg-red-50 p-2 rounded overflow-x-auto">
                  {value.error}
                </pre>
              )}
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 py-8">
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <Loader className="w-5 h-5 animate-spin text-primary-600" />
                <span>Loading system information...</span>
              </div>
            ) : (
              <span>No system information available</span>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <InfoCard title="System Information" data={systemInfo} icon={Server} />
      <InfoCard title="Edge Node Information" data={edgeInfo} icon={Server} />
    </div>
  )
}

