import { useState, useEffect } from 'react'
import { 
  Zap, Battery, Activity, Settings, Play, 
  AlertCircle, CheckCircle2, XCircle, RefreshCw, Power
} from 'lucide-react'
import { useAuthToken } from '../services/auth'

const ML_SERVICE_URL = import.meta.env.VITE_ML_SERVICE_URL || 'http://localhost:5000'

export default function MLControl() {
  const [availableCommands, setAvailableCommands] = useState(null)
  const [activeControls, setActiveControls] = useState([])
  const [controlForm, setControlForm] = useState({
    node_id: '',
    action: 'Hold',
    magnitude: 0,
    reason: '',
    duration_minutes: 15
  })
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const { makeApiCall } = useAuthToken()

  useEffect(() => {
    fetchAvailableCommands()
    fetchActiveControls()
    const interval = setInterval(() => {
      fetchActiveControls()
    }, 10000) // Update every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchAvailableCommands = async () => {
    try {
      const response = await makeApiCall(`${ML_SERVICE_URL}/control/commands/available`)
      if (response.ok) {
        const data = await response.json()
        setAvailableCommands(data)
      }
    } catch (error) {
      console.error('Error fetching available commands:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchActiveControls = async () => {
    try {
      // Note: This endpoint might need to be implemented or use a different endpoint
      // For now, we'll use a placeholder
      const response = await makeApiCall(`${ML_SERVICE_URL}/health`)
      if (response.ok) {
        const data = await response.json()
        // Extract active controls from health check if available
        if (data.statistics?.active_controls !== undefined) {
          // This is a placeholder - you may need to implement a proper endpoint
          setActiveControls([])
        }
      }
    } catch (error) {
      console.error('Error fetching active controls:', error)
    }
  }

  const handleExecuteControl = async () => {
    if (!controlForm.node_id) {
      alert('Please enter a node ID')
      return
    }

    if (controlForm.action !== 'Hold' && !controlForm.magnitude) {
      alert('Please enter a magnitude')
      return
    }

    if (!controlForm.reason) {
      alert('Please provide a reason for this action')
      return
    }

    setExecuting(true)
    try {
      const response = await makeApiCall(`${ML_SERVICE_URL}/control/power/execute`, {
        method: 'POST',
        body: JSON.stringify(controlForm)
      })

      if (response.ok) {
        const data = await response.json()
        if (data.status === 'success') {
          alert(`Control executed successfully: ${controlForm.action} on ${controlForm.node_id}`)
          setControlForm({
            node_id: '',
            action: 'Hold',
            magnitude: 0,
            reason: '',
            duration_minutes: 15
          })
          fetchActiveControls()
        } else {
          alert(`Control rejected: ${data.reason || 'Unknown error'}`)
        }
      } else {
        const error = await response.json()
        alert(`Error: ${error.detail || 'Failed to execute control'}`)
      }
    } catch (error) {
      console.error('Error executing control:', error)
      alert('Failed to execute control command')
    } finally {
      setExecuting(false)
    }
  }

  const actionIcons = {
    Charge: Battery,
    Discharge: Zap,
    Hold: Activity,
    'Load Deferral': Settings
  }

  const actionColors = {
    Charge: 'blue',
    Discharge: 'green',
    Hold: 'gray',
    'Load Deferral': 'orange'
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">ML Power Control Panel</h1>
            <p className="mt-2 text-gray-600">Execute intelligent power control commands with safety validation</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 px-4 py-2 bg-primary-50 border border-primary-200 rounded-xl">
              <Power className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-medium text-primary-700">Autonomous Control</span>
            </div>
          </div>
        </div>
      </div>

      {/* Available Commands */}
      {availableCommands && (
        <div className="card mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Available Commands</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {availableCommands.commands?.map((command) => {
              const Icon = actionIcons[command] || Activity
              const color = actionColors[command] || 'gray'
              return (
                <div key={command} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon className={`w-5 h-5 text-${color}-600`} />
                    <h3 className="font-semibold text-gray-900">{command}</h3>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">
                    {availableCommands.descriptions?.[command] || 'No description'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {availableCommands.magnitude_units?.[command] || 'N/A'}
                  </p>
                </div>
              )
            })}
          </div>
          {availableCommands.safety_limits && (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h3 className="text-sm font-semibold text-yellow-900 mb-2">Safety Limits</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-yellow-700">SOC Range:</span>
                  <span className="ml-1 font-medium">
                    {availableCommands.safety_limits.min_soc}% - {availableCommands.safety_limits.max_soc}%
                  </span>
                </div>
                <div>
                  <span className="text-yellow-700">Frequency:</span>
                  <span className="ml-1 font-medium">
                    {availableCommands.safety_limits.min_frequency} - {availableCommands.safety_limits.max_frequency} Hz
                  </span>
                </div>
                <div>
                  <span className="text-yellow-700">Max Charge:</span>
                  <span className="ml-1 font-medium">
                    {availableCommands.safety_limits.max_charge_rate} kW
                  </span>
                </div>
                <div>
                  <span className="text-yellow-700">Max Discharge:</span>
                  <span className="ml-1 font-medium">
                    {availableCommands.safety_limits.max_discharge_rate} kW
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Control Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
              <Play className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Execute Control Command</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Node ID</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., DC01"
                value={controlForm.node_id}
                onChange={(e) => setControlForm({ ...controlForm, node_id: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
              <select
                className="input"
                value={controlForm.action}
                onChange={(e) => setControlForm({ ...controlForm, action: e.target.value })}
              >
                {availableCommands?.commands?.map((cmd) => (
                  <option key={cmd} value={cmd}>{cmd}</option>
                )) || (
                  <>
                    <option value="Charge">Charge</option>
                    <option value="Discharge">Discharge</option>
                    <option value="Hold">Hold</option>
                    <option value="Load Deferral">Load Deferral</option>
                  </>
                )}
              </select>
            </div>
            {controlForm.action !== 'Hold' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Magnitude ({controlForm.action === 'Load Deferral' ? '%' : 'kW'})
                </label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  max={controlForm.action === 'Load Deferral' ? 100 : 250}
                  value={controlForm.magnitude}
                  onChange={(e) => setControlForm({ ...controlForm, magnitude: parseFloat(e.target.value) })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {controlForm.action === 'Load Deferral' 
                    ? 'Percentage of workload to defer (0-100%)'
                    : `Power rate in kW (0-250 kW)`}
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
              <input
                type="number"
                className="input"
                min="1"
                max="120"
                value={controlForm.duration_minutes}
                onChange={(e) => setControlForm({ ...controlForm, duration_minutes: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
              <textarea
                className="input"
                rows="3"
                placeholder="Explain why this action is needed..."
                value={controlForm.reason}
                onChange={(e) => setControlForm({ ...controlForm, reason: e.target.value })}
              />
            </div>
            <button
              className="btn btn-primary w-full"
              onClick={handleExecuteControl}
              disabled={executing || !controlForm.node_id || !controlForm.reason}
            >
              {executing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Execute Control
                </>
              )}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Active Controls</h2>
          </div>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-primary-600" />
              <p className="text-gray-500">Loading active controls...</p>
            </div>
          ) : activeControls.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Activity className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500">No active controls</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeControls.map((control, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{control.node_id || 'N/A'}</span>
                    <span className={`badge ${
                      control.status === 'success' ? 'badge-success' : 
                      control.status === 'error' ? 'badge-error' : 
                      'badge-warning'
                    }`}>
                      {control.status || 'active'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Action: {control.action || 'N/A'}</p>
                    <p>Magnitude: {control.magnitude || 0} {control.action === 'Load Deferral' ? '%' : 'kW'}</p>
                    <p>Duration: {control.duration_minutes || 0} minutes</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Safety Information */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Safety & Validation</h2>
        </div>
        <div className="space-y-3">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900 mb-1">Automatic Safety Validation</h3>
                <p className="text-sm text-green-700">
                  All commands are validated against safety limits before execution. The system checks:
                </p>
                <ul className="text-sm text-green-700 mt-2 list-disc list-inside space-y-1">
                  <li>Battery SOC limits (20% - 90%)</li>
                  <li>Power rate limits (0 - 250 kW)</li>
                  <li>Grid frequency bounds (49.7 - 50.3 Hz)</li>
                  <li>Command format and parameters</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Command Types</h3>
                <div className="text-sm text-blue-700 space-y-2 mt-2">
                  <p><strong>Charge:</strong> Charge battery at specified kW rate (0-250 kW)</p>
                  <p><strong>Discharge:</strong> Discharge battery at specified kW rate (0-250 kW)</p>
                  <p><strong>Hold:</strong> Maintain current operating state (magnitude = 0)</p>
                  <p><strong>Load Deferral:</strong> Defer data center workload by specified percentage (0-100%)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

