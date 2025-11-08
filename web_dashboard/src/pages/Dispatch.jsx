import { useEffect, useState } from 'react'
import { Send, Zap, Battery, Activity, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { useAuthToken } from '../services/auth'

export default function Dispatch() {
  const [nodes, setNodes] = useState([])
  const [dispatchLogs, setDispatchLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [formData, setFormData] = useState({
    targets: 'all',
    action: 'charge',
    power_kw: '',
    duration_minutes: 15
  })
  const { makeApiCall } = useAuthToken()

  useEffect(() => {
    fetchNodes()
    fetchDispatchLogs()
    const interval = setInterval(() => {
      fetchDispatchLogs()
    }, 10000)
    return () => clearInterval(interval)
  }, [makeApiCall])

  const fetchNodes = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/nodes`
      const response = await makeApiCall(apiUrl)
      if (response.ok) {
        const result = await response.json()
        setNodes(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching nodes:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDispatchLogs = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/dispatch/logs?limit=20`
      const response = await makeApiCall(apiUrl)
      if (response.ok) {
        const result = await response.json()
        setDispatchLogs(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching dispatch logs:', error)
    }
  }

  const handleSendDispatch = async () => {
    if (!formData.power_kw) {
      alert('Please enter power value')
      return
    }

    setSending(true)
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/dispatch`
      const response = await makeApiCall(apiUrl, {
        method: 'POST',
        body: JSON.stringify({
          targets: formData.targets === 'all' ? 'all' : [formData.targets],
          action: formData.action,
          params: {
            power_kw: parseFloat(formData.power_kw),
            duration_minutes: parseInt(formData.duration_minutes) || 15
          }
        })
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Dispatch command sent successfully! ${result.dispatched} nodes targeted.`)
        setFormData({ ...formData, power_kw: '' })
        fetchDispatchLogs()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to send dispatch command'}`)
      }
    } catch (error) {
      console.error('Error sending dispatch:', error)
      alert('Failed to send dispatch command')
    } finally {
      setSending(false)
    }
  }

  const activeCommands = dispatchLogs.filter(log => 
    log.status === 'active' || log.status === 'sent'
  ).slice(0, 5)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dispatch Control</h1>
          <p className="mt-2 text-gray-600">Manage and control grid flexibility dispatch commands</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card-energy">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-energy-500 to-energy-600 rounded-lg">
              <Send className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Send Dispatch Command</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Node
              </label>
              <select 
                className="input"
                value={formData.targets}
                onChange={(e) => setFormData({ ...formData, targets: e.target.value })}
              >
                <option value="all">All Nodes</option>
                {nodes.map(node => (
                  <option key={node.dc_id} value={node.dc_id}>
                    {node.node_name || node.dc_id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Command Type
              </label>
              <select 
                className="input"
                value={formData.action}
                onChange={(e) => setFormData({ ...formData, action: e.target.value })}
              >
                <option value="charge">Charge</option>
                <option value="discharge">Discharge</option>
                <option value="hold">Hold</option>
                <option value="defer_load">Load Deferral</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Power (kW)
              </label>
              <input 
                type="number" 
                className="input" 
                placeholder="Enter power value"
                value={formData.power_kw}
                onChange={(e) => setFormData({ ...formData, power_kw: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (minutes)
              </label>
              <input 
                type="number" 
                className="input" 
                placeholder="15"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
              />
            </div>
            <button 
              className="btn btn-primary w-full"
              onClick={handleSendDispatch}
              disabled={sending}
            >
              <Send className="w-4 h-4 mr-2" />
              {sending ? 'Sending...' : 'Send Dispatch Command'}
            </button>
          </div>
        </div>

        <div className="card-grid">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-grid-500 to-grid-600 rounded-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Active Commands</h2>
          </div>
          <div className="space-y-3">
            {activeCommands.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active commands</p>
              </div>
            ) : (
              activeCommands.map((log, idx) => {
                const timeAgo = log.timestamp 
                  ? Math.round((Date.now() - new Date(log.timestamp).getTime()) / 60000)
                  : 0
                return (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {log.dc_id} - {log.action}
                      </span>
                      <span className={`badge ${
                        log.status === 'active' ? 'badge-success' : 'badge-info'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      {log.params?.power_kw || 0} kW • Started {timeAgo}m ago
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Dispatch History</h2>
        {dispatchLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Send className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No dispatch history</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Node</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Power (kW)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dispatchLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{log.dc_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 capitalize">{log.action}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{log.params?.power_kw || 0}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${
                        log.status === 'active' ? 'badge-success' :
                        log.status === 'sent' ? 'badge-info' :
                        'badge-error'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
