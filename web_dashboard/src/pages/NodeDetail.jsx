import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { Server, Terminal, Settings, Activity, Battery, Zap, RefreshCw } from 'lucide-react'
import { useAuthToken } from '../services/auth'
import SSHTerminal from '../components/SSHTerminal'
import SSHSystemInfo from '../components/SSHSystemInfo'
import SSHConfig from '../components/SSHConfig'

export default function NodeDetail() {
  const { dcId } = useParams()
  const location = useLocation()
  const [node, setNode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [lastState, setLastState] = useState(null)
  const { makeApiCall } = useAuthToken()
  
  // Check if we should open a specific tab from navigation state
  useEffect(() => {
    if (location.state?.openTab) {
      setActiveTab(location.state.openTab)
    }
  }, [location.state])

  useEffect(() => {
    fetchNodeData()
    const interval = setInterval(fetchNodeData, 10000) // Update every 10 seconds
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dcId])

  const fetchNodeData = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/nodes/${dcId}`
      const response = await makeApiCall(apiUrl)
      if (response.ok) {
        const data = await response.json()
        setNode(data.data)
        setLastState(data.data.last_state)
      }
    } catch (error) {
      console.error('Error fetching node data:', error)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Server },
    { id: 'ssh', label: 'SSH Terminal', icon: Terminal },
    { id: 'system', label: 'System Info', icon: Activity },
    { id: 'config', label: 'SSH Config', icon: Settings }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!node) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <p className="text-gray-600">Node not found</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">{node.node_name || node.dc_id}</h1>
            <p className="mt-2 text-gray-600">Edge node: {node.dc_id}</p>
          </div>
          <button
            onClick={fetchNodeData}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <p className={`text-lg font-semibold ${node.online ? 'text-green-600' : 'text-red-600'}`}>
                {node.online ? 'Online' : 'Offline'}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${node.online ? 'bg-green-100' : 'bg-red-100'}`}>
              <Activity className={`w-6 h-6 ${node.online ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </div>
        </div>

        {lastState && (
          <>
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Power</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {lastState.power_kw?.toFixed(2) || 0} kW
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-blue-100">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">SOC</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {lastState.soc?.toFixed(1) || 0}%
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-100">
                  <Battery className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Frequency</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {lastState.freq?.toFixed(2) || 50.0} Hz
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-purple-100">
                  <Activity className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Node Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Node ID</p>
                <p className="font-medium text-gray-900">{node.dc_id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Capacity</p>
                <p className="font-medium text-gray-900">{node.capacity_kw || 0} kW</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Battery</p>
                <p className="font-medium text-gray-900">{node.battery_kwh || 0} kWh</p>
              </div>
              {lastState && (
                <>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Last Update</p>
                    <p className="font-medium text-gray-900">
                      {new Date(lastState.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Load Factor</p>
                    <p className="font-medium text-gray-900">
                      {lastState.load_factor?.toFixed(2) || 'N/A'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'ssh' && <SSHTerminal dcId={dcId} />}
        {activeTab === 'system' && <SSHSystemInfo dcId={dcId} />}
        {activeTab === 'config' && (
          <SSHConfig
            dcId={dcId}
            onConfigUpdated={() => {
              fetchNodeData()
              setActiveTab('ssh')
            }}
          />
        )}
      </div>
    </div>
  )
}
