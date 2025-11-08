import { useEffect, useState } from 'react'
import { 
  Activity, Battery, Zap, Server, Grid3x3, TrendingUp, 
  DollarSign, BarChart3, Settings, FileText, Clock, 
  AlertCircle, CheckCircle2, XCircle, Send, Check, X,
  Leaf, Shield
} from 'lucide-react'
import { useAuthToken } from '../services/auth'

export default function DGridOperator() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [flexibilityRequest, setFlexibilityRequest] = useState({ mw: '', duration: '' })
  const [activeBids, setActiveBids] = useState([])
  const [agentStatus, setAgentStatus] = useState(null)
  const [agentDecisions, setAgentDecisions] = useState([])
  const { makeApiCall } = useAuthToken()

  useEffect(() => {
    fetchAggregateData()
    fetchActiveBids()
    fetchAgentStatus()
    fetchAgentDecisions()
    const interval = setInterval(() => {
      fetchAggregateData()
      fetchActiveBids()
      fetchAgentStatus()
      fetchAgentDecisions()
    }, 10000)
    return () => clearInterval(interval)
  }, [makeApiCall])

  const fetchAggregateData = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/aggregate`
      const response = await makeApiCall(apiUrl)
      if (response.ok) {
        const result = await response.json()
        const agg = result.data
        setData({
          totalAggregatedVPPCapacity: (agg.total_capacity_kw || 0) / 1000,
          activeParticipants: agg.online_nodes || 0,
          availableReserve: agg.available_reserve_mw || 0,
          committedReserve: agg.committed_reserve_mw || 0,
          gridFrequency: agg.avg_freq || 50.0,
          areaControlError: 0.02, // TODO: Calculate from actual data
          realTimePowerFlowBalance: (agg.total_power_kw || 0) / 1000,
          co2EmissionsReduced: agg.co2_saved || 0,
          costAvoidedVsPeaker: agg.revenue_today || 0,
          reliabilityScore: 0.98 // TODO: Calculate from actual data
        })
      }
    } catch (error) {
      console.error('Error fetching aggregate data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchActiveBids = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/market/bids`
      const response = await makeApiCall(apiUrl)
      if (response.ok) {
        const result = await response.json()
        setActiveBids(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching active bids:', error)
    }
  }

  const fetchAgentStatus = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/agents/status`
      const response = await makeApiCall(apiUrl)
      if (response.ok) {
        const result = await response.json()
        setAgentStatus(result.data)
      }
    } catch (error) {
      console.error('Error fetching agent status:', error)
    }
  }

  const fetchAgentDecisions = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/agents/decisions`
      const response = await makeApiCall(apiUrl)
      if (response.ok) {
        const result = await response.json()
        setAgentDecisions(result.data.recentDecisions || [])
      }
    } catch (error) {
      console.error('Error fetching agent decisions:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const handleSendFlexibilityRequest = async () => {
    if (!flexibilityRequest.mw || !flexibilityRequest.duration) {
      alert('Please enter both capacity and duration')
      return
    }
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/dispatch`
      const response = await makeApiCall(apiUrl, {
        method: 'POST',
        body: JSON.stringify({
          targets: 'all',
          action: 'discharge',
          params: {
            power_kw: parseFloat(flexibilityRequest.mw) * 1000,
            duration_minutes: parseInt(flexibilityRequest.duration)
          }
        })
      })
      if (response.ok) {
        alert(`Flexibility request sent: ${flexibilityRequest.mw} MW for ${flexibilityRequest.duration} minutes`)
        setFlexibilityRequest({ mw: '', duration: '' })
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to send request'}`)
      }
    } catch (error) {
      console.error('Error sending flexibility request:', error)
      alert('Failed to send flexibility request')
    }
  }

  const handleApproveBid = (bidId) => {
    // TODO: Implement API call to approve bid
    console.log('Approving bid:', bidId)
    alert('Bid approval functionality coming soon')
  }

  const handleRejectBid = (bidId) => {
    // TODO: Implement API call to reject bid
    console.log('Rejecting bid:', bidId)
    alert('Bid rejection functionality coming soon')
  }

  const handleTriggerDREvent = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/dispatch`
      const response = await makeApiCall(apiUrl, {
        method: 'POST',
        body: JSON.stringify({
          targets: 'all',
          action: 'defer_load',
          params: {
            power_kw: 100, // Default DR event
            duration_minutes: 30
          }
        })
      })
      if (response.ok) {
        alert('Demand Response event triggered')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to trigger DR event'}`)
      }
    } catch (error) {
      console.error('Error triggering DR event:', error)
      alert('Failed to trigger DR event')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Grid Operations & Flexibility Dashboard</h1>
            <p className="mt-2 text-gray-600">Monitor and control grid flexibility aggregation</p>
          </div>
        </div>
      </div>

      {/* Real-Time Grid Flexibility View Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-primary-600" />
          Real-Time Grid Flexibility View
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Total Aggregated VPP Capacity</p>
            <p className="text-3xl font-bold text-gray-900">{data?.totalAggregatedVPPCapacity?.toFixed(1) || 0} MW</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Active Participants</p>
            <p className="text-3xl font-bold text-gray-900">{data?.activeParticipants || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Data centers</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Available Reserve</p>
            <p className="text-3xl font-bold text-green-600">{data?.availableReserve?.toFixed(1) || 0} MW</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Committed Reserve</p>
            <p className="text-3xl font-bold text-blue-600">{data?.committedReserve?.toFixed(1) || 0} MW</p>
          </div>
        </div>
      </div>

      {/* Frequency & Load Monitoring Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-primary-600" />
          Frequency & Load Monitoring
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Grid Frequency Trends</h3>
            <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg mb-4">
              Chart placeholder - implement with Recharts
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Current Frequency</p>
                <p className="text-2xl font-bold text-gray-900">{data?.gridFrequency?.toFixed(2) || 50.0} Hz</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Area Control Error</p>
                <p className="text-2xl font-bold text-gray-900">{data?.areaControlError?.toFixed(2) || 0.02}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Power Flow Balance</p>
                <p className="text-2xl font-bold text-gray-900">{data?.realTimePowerFlowBalance?.toFixed(1) || 0} MW</p>
              </div>
            </div>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Real-Time Power Flow Balance</h3>
            <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg mb-4">
              Chart placeholder - implement with Recharts
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mr-2" />
                  <span className="text-sm font-medium">Grid Status: Stable</span>
                </div>
                <span className="badge badge-success">Normal</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center">
                  <Activity className="w-5 h-5 text-blue-600 mr-2" />
                  <span className="text-sm font-medium">ACE: {data?.areaControlError?.toFixed(2) || 0.02}</span>
                </div>
                <span className="badge badge-info">Within Limits</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ancillary Market Interface Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <DollarSign className="w-5 h-5 mr-2 text-primary-600" />
          Ancillary Market Interface
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Active Bids</h3>
            <div className="space-y-3">
              {activeBids.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No active bids</p>
                </div>
              ) : (
                activeBids.map((bid) => (
                <div key={bid.bid_id || bid.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center mb-2">
                        <span className="badge badge-info mr-2">{bid.service_type || 'N/A'}</span>
                        <span className="text-sm font-medium text-gray-900">{bid.capacity_mw || 0} MW</span>
                      </div>
                      <p className="text-sm text-gray-600">Price: ₹{bid.price_per_mw || 0}/MW</p>
                      <p className="text-xs text-gray-500 mt-1">Duration: {bid.duration_minutes || 0} min</p>
                    </div>
                    <span className={`badge ${
                      bid.status === 'active' ? 'badge-success' : 'badge-info'
                    }`}>
                      {bid.status || 'pending'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleApproveBid(bid.bid_id || bid.id)}
                      className="btn btn-primary flex-1 text-sm"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Approve
                    </button>
                    <button 
                      onClick={() => handleRejectBid(bid.bid_id || bid.id)}
                      className="btn btn-secondary flex-1 text-sm"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Reject
                    </button>
                  </div>
                </div>
                ))
              )}
            </div>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Market Summary</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Market Summary</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Active Bids</span>
                    <span className="font-semibold">{activeBids.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Total Capacity</span>
                    <span className="font-semibold">{data?.totalAggregatedVPPCapacity?.toFixed(1) || 0} MW</span>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600 mb-1">Available Reserve</p>
                <p className="text-2xl font-bold text-green-600">{data?.availableReserve?.toFixed(1) || 0} MW</p>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600 mb-1">Historical Performance</p>
                <div className="h-32 flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
                  Chart placeholder
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dispatch Control Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Settings className="w-5 h-5 mr-2 text-primary-600" />
          Dispatch Control
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Send Flexibility Request</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacity Required (MW)
                </label>
                <input
                  type="number"
                  className="input"
                  placeholder="Enter MW"
                  value={flexibilityRequest.mw}
                  onChange={(e) => setFlexibilityRequest({ ...flexibilityRequest, mw: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  className="input"
                  placeholder="Enter duration"
                  value={flexibilityRequest.duration}
                  onChange={(e) => setFlexibilityRequest({ ...flexibilityRequest, duration: e.target.value })}
                />
              </div>
              <button 
                onClick={handleSendFlexibilityRequest}
                className="btn btn-primary w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Flexibility Request
              </button>
            </div>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Demand Response Events</h3>
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center mb-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                  <span className="font-medium text-yellow-900">No Active DR Events</span>
                </div>
                <p className="text-sm text-yellow-700">
                  Trigger a demand response event to request immediate load reduction from participants.
                </p>
              </div>
              <button 
                onClick={handleTriggerDREvent}
                className="btn btn-secondary w-full"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Trigger DR Event
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Agent System Status */}
      {agentStatus && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Brain className="w-5 h-5 mr-2 text-primary-600" />
            Autonomous Multi-Agent System
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-4">
            {Object.entries(agentStatus.agents || {}).map(([name, status]) => (
              <div key={name} className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{name}</h3>
                  <span className={`badge ${
                    status.status === 'idle' ? 'badge-success' :
                    status.status === 'running' ? 'badge-info' :
                    'badge-warning'
                  }`}>
                    {status.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Runs:</span>
                    <span className="font-medium">{status.runCount || 0}</span>
                  </div>
                  {status.lastRun && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Run:</span>
                      <span className="font-medium">
                        {new Date(status.lastRun).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Recent Agent Decisions */}
          {agentDecisions.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Recent Agent Decisions</h3>
              <div className="space-y-3">
                {agentDecisions.slice(-5).reverse().map((decision, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        {decision.decision?.action || 'No action'}
                      </span>
                      <span className={`badge ${
                        decision.decision?.priority === 'high' ? 'badge-warning' :
                        decision.decision?.priority === 'medium' ? 'badge-info' :
                        'badge-success'
                      }`}>
                        {decision.decision?.priority || 'low'}
                      </span>
                    </div>
                    {decision.decision?.reasoning && decision.decision.reasoning.length > 0 && (
                      <ul className="text-sm text-gray-600 space-y-1">
                        {decision.decision.reasoning.map((reason, rIdx) => (
                          <li key={rIdx}>• {reason}</li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(decision.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Impact & Savings Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-primary-600" />
          Impact & Savings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <div className="flex items-center mb-3">
              <Leaf className="w-6 h-6 text-green-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">CO₂ Emissions Reduced</h3>
            </div>
            <p className="text-3xl font-bold text-green-600 mb-1">{data?.co2EmissionsReduced?.toFixed(1) || 0} tCO₂</p>
            <p className="text-sm text-gray-500">Per day</p>
          </div>
          <div className="card">
            <div className="flex items-center mb-3">
              <DollarSign className="w-6 h-6 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Revenue Today</h3>
            </div>
            <p className="text-3xl font-bold text-blue-600 mb-1">₹{data?.costAvoidedVsPeaker?.toLocaleString() || 0}</p>
            <p className="text-sm text-gray-500">Per day</p>
          </div>
          <div className="card">
            <div className="flex items-center mb-3">
              <Shield className="w-6 h-6 text-purple-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Reliability Score</h3>
            </div>
            <p className="text-3xl font-bold text-purple-600 mb-1">{(data?.reliabilityScore * 100 || 98).toFixed(0)}%</p>
            <p className="text-sm text-gray-500">System reliability</p>
          </div>
        </div>
      </div>
    </div>
  )
}
