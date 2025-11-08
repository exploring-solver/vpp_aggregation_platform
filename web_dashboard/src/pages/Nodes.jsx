import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, CheckCircle2, AlertCircle, Battery, Zap, Activity, Terminal, Settings, ExternalLink, Key } from 'lucide-react'
import { useAuthToken } from '../services/auth'

export default function Nodes() {
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sshStatuses, setSshStatuses] = useState({})
  const navigate = useNavigate()
  const { makeApiCall } = useAuthToken()

  useEffect(() => {
    fetchNodes()
    const interval = setInterval(fetchNodes, 15000)
    return () => clearInterval(interval)
  }, [makeApiCall])

  const fetchNodes = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/nodes`
      const response = await makeApiCall(apiUrl)
      
      if (response.ok) {
        const result = await response.json()
        const processedNodes = result.data.map(node => ({
          id: node.dc_id,
          name: node.node_name || `Node ${node.dc_id}`,
          status: node.online ? 'online' : 'offline',
          power: node.last_state?.power_kw || 0,
          soc: node.last_state?.soc || 0,
          frequency: node.last_state?.freq || 50.0,
          location: node.node_location || 'Unknown',
          lastSeen: node.last_state?.timestamp,
          hasSshConfig: !!node.ssh_config
        }))
        setNodes(processedNodes)
        setError(null)
        
        // Check SSH status for each node
        checkSSHStatuses(processedNodes)
      } else {
        setError('Failed to fetch nodes')
        setNodes([])
      }
    } catch (err) {
      console.error('Error fetching nodes:', err)
      setError('Error connecting to server')
      setNodes([])
    } finally {
      setLoading(false)
    }
  }

  const checkSSHStatuses = async (nodeList) => {
    const statuses = {}
    // Check SSH status for nodes with config (in parallel)
    const promises = nodeList.map(async (node) => {
      if (node.hasSshConfig) {
        try {
          const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/ssh/${node.id}/test`
          const response = await makeApiCall(apiUrl, { method: 'POST' })
          if (response.ok) {
            const data = await response.json()
            return { id: node.id, status: data.success && data.data?.success }
          } else {
            return { id: node.id, status: false }
          }
        } catch (error) {
          return { id: node.id, status: false }
        }
      } else {
        return { id: node.id, status: null } // No SSH config
      }
    })
    
    const results = await Promise.all(promises)
    results.forEach(({ id, status }) => {
      statuses[id] = status
    })
    setSshStatuses(statuses)
  }

  const handleViewNode = (nodeId) => {
    navigate(`/nodes/${nodeId}`)
  }

  const handleConfigureSSH = (nodeId, e) => {
    e.stopPropagation()
    navigate(`/nodes/${nodeId}`, { state: { openTab: 'config' } })
  }

  const handleOpenSSH = (nodeId, e) => {
    e.stopPropagation()
    navigate(`/nodes/${nodeId}`, { state: { openTab: 'ssh' } })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading Edge Nodes...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Edge Nodes</h1>
          <p className="mt-2 text-gray-600">Monitor and manage IoT edge nodes across data centers</p>
        </div>
        <div className="flex items-center space-x-2">
          {error ? (
            <div className="flex items-center space-x-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-700">{error}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 px-4 py-2 bg-grid-50 border border-grid-200 rounded-xl">
              <div className="w-2 h-2 bg-grid-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-grid-700">
                {nodes.filter(n => n.status === 'online').length} of {nodes.length} Nodes Online
              </span>
            </div>
          )}
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="card text-center py-12">
          <Server className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Edge Nodes Found</h3>
          <p className="text-gray-500">
            {error ? 'Unable to connect to the aggregator server.' : 'No edge nodes have registered yet.'}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Ensure edge nodes are running and configured correctly.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {nodes.map((node) => (
          <div key={node.id} className="card hover:shadow-xl transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-xl ${
                  node.status === 'online' 
                    ? 'bg-gradient-to-br from-grid-500 to-grid-600' 
                    : 'bg-gradient-to-br from-gray-400 to-gray-500'
                }`}>
                  <Server className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{node.name}</h3>
                  <p className="text-xs text-gray-500">{node.id}</p>
                </div>
              </div>
              {node.status === 'online' ? (
                <CheckCircle2 className="w-5 h-5 text-grid-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-gray-400" />
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-energy-600" />
                  <span className="text-sm text-gray-600">Power</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{node.power} kW</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Battery className="w-4 h-4 text-grid-600" />
                  <span className="text-sm text-gray-600">SOC</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{node.soc}%</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-primary-600" />
                  <span className="text-sm text-gray-600">Frequency</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{node.frequency} Hz</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {node.hasSshConfig && (
                    <div className="flex items-center space-x-1">
                      {sshStatuses[node.id] === true ? (
                        <div className="flex items-center space-x-1 text-green-600">
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="text-xs">SSH</span>
                        </div>
                      ) : sshStatuses[node.id] === false ? (
                        <div className="flex items-center space-x-1 text-red-600">
                          <AlertCircle className="w-3 h-3" />
                          <span className="text-xs">SSH</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 text-gray-400">
                          <Key className="w-3 h-3" />
                          <span className="text-xs">SSH</span>
                        </div>
                      )}
                    </div>
                  )}
                  <span className={`badge ${node.status === 'online' ? 'badge-success' : 'badge-error'}`}>
                    {node.status}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleViewNode(node.id)}
                  className="flex-1 btn btn-primary flex items-center justify-center space-x-2 text-sm py-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>View Details</span>
                </button>
                {node.hasSshConfig ? (
                  <button
                    onClick={(e) => handleOpenSSH(node.id, e)}
                    className="btn btn-secondary flex items-center justify-center space-x-2 text-sm py-2 px-3"
                    title="Open SSH Terminal"
                  >
                    <Terminal className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => handleConfigureSSH(node.id, e)}
                    className="btn btn-secondary flex items-center justify-center space-x-2 text-sm py-2 px-3"
                    title="Configure SSH"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Node Telemetry Stream</h2>
          <div className="text-center py-12 text-gray-400">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Real-time telemetry data will appear here</p>
            <p className="text-sm mt-1">Connected via MQTT / WebSocket</p>
          </div>
        </div>
      </>
    )}
  </div>
)
}
