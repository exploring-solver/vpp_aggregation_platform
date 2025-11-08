import { useEffect, useState } from 'react'
import { 
  Activity, Battery, Zap, Server, Grid3x3, TrendingUp, 
  DollarSign, BarChart3, Settings, FileText, Clock, 
  AlertCircle, CheckCircle2, XCircle, Send, Check, X,
  Leaf, Shield
} from 'lucide-react'

export default function DGridOperator() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [flexibilityRequest, setFlexibilityRequest] = useState({ mw: '', duration: '' })

  useEffect(() => {
    // TODO: Connect to WebSocket for real-time updates
    // TODO: Fetch grid operator data from API
    setTimeout(() => {
      setData({
        // Real-Time Grid Flexibility View
        totalAggregatedVPPCapacity: 245.8,
        activeParticipants: 12,
        availableReserve: 180.5,
        committedReserve: 65.3,
        
        // Frequency & Load Monitoring
        gridFrequency: 49.98,
        areaControlError: 0.02,
        realTimePowerFlowBalance: 245.8,
        frequencyTrend: [],
        
        // Ancillary Market Interface
        activeBids: [
          { id: 1, service: 'SRAS', capacity: '50 MW', price: '₹2,500/MW', status: 'Active', responseTime: '150ms' },
          { id: 2, service: 'TRAS', capacity: '30 MW', price: '₹3,200/MW', status: 'Active', responseTime: '120ms' }
        ],
        clearingPrices: {
          sras: 2500,
          tras: 3200
        },
        avgResponseTime: 135,
        
        // Impact & Savings
        co2EmissionsReduced: 125.5,
        costAvoidedVsPeaker: 450000,
        reliabilityScore: 0.98
      })
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const handleSendFlexibilityRequest = () => {
    // TODO: Implement API call to send flexibility request
    console.log('Sending flexibility request:', flexibilityRequest)
    alert(`Flexibility request sent: ${flexibilityRequest.mw} MW for ${flexibilityRequest.duration} minutes`)
  }

  const handleApproveBid = (bidId) => {
    // TODO: Implement API call to approve bid
    console.log('Approving bid:', bidId)
  }

  const handleRejectBid = (bidId) => {
    // TODO: Implement API call to reject bid
    console.log('Rejecting bid:', bidId)
  }

  const handleTriggerDREvent = () => {
    // TODO: Implement API call to trigger DR event
    console.log('Triggering DR event')
    alert('Demand Response event triggered')
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
            <p className="text-3xl font-bold text-gray-900">{data.totalAggregatedVPPCapacity} MW</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Active Participants</p>
            <p className="text-3xl font-bold text-gray-900">{data.activeParticipants}</p>
            <p className="text-xs text-gray-500 mt-1">Data centers</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Available Reserve</p>
            <p className="text-3xl font-bold text-green-600">{data.availableReserve} MW</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Committed Reserve</p>
            <p className="text-3xl font-bold text-blue-600">{data.committedReserve} MW</p>
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
                <p className="text-2xl font-bold text-gray-900">{data.gridFrequency} Hz</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Area Control Error</p>
                <p className="text-2xl font-bold text-gray-900">{data.areaControlError}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Power Flow Balance</p>
                <p className="text-2xl font-bold text-gray-900">{data.realTimePowerFlowBalance} MW</p>
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
                  <span className="text-sm font-medium">ACE: {data.areaControlError}</span>
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
              {data.activeBids.map((bid) => (
                <div key={bid.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center mb-2">
                        <span className="badge badge-info mr-2">{bid.service}</span>
                        <span className="text-sm font-medium text-gray-900">{bid.capacity}</span>
                      </div>
                      <p className="text-sm text-gray-600">Price: {bid.price}</p>
                      <p className="text-xs text-gray-500 mt-1">Response Time: {bid.responseTime}</p>
                    </div>
                    <span className="badge badge-success">{bid.status}</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleApproveBid(bid.id)}
                      className="btn btn-primary flex-1 text-sm"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Approve
                    </button>
                    <button 
                      onClick={() => handleRejectBid(bid.id)}
                      className="btn btn-secondary flex-1 text-sm"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Market Summary</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Clearing Prices</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">SRAS</span>
                    <span className="font-semibold">₹{data.clearingPrices.sras.toLocaleString()}/MW</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">TRAS</span>
                    <span className="font-semibold">₹{data.clearingPrices.tras.toLocaleString()}/MW</span>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600 mb-1">Average Response Time</p>
                <p className="text-2xl font-bold text-gray-900">{data.avgResponseTime} ms</p>
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
            <p className="text-3xl font-bold text-green-600 mb-1">{data.co2EmissionsReduced} tCO₂</p>
            <p className="text-sm text-gray-500">Per day</p>
          </div>
          <div className="card">
            <div className="flex items-center mb-3">
              <DollarSign className="w-6 h-6 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Cost Avoided vs Peaker Plants</h3>
            </div>
            <p className="text-3xl font-bold text-blue-600 mb-1">₹{data.costAvoidedVsPeaker.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Per day</p>
          </div>
          <div className="card">
            <div className="flex items-center mb-3">
              <Shield className="w-6 h-6 text-purple-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Reliability Score</h3>
            </div>
            <p className="text-3xl font-bold text-purple-600 mb-1">{(data.reliabilityScore * 100).toFixed(0)}%</p>
            <p className="text-sm text-gray-500">System reliability</p>
          </div>
        </div>
      </div>
    </div>
  )
}
