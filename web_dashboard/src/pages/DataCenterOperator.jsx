import { useEffect, useState } from 'react'
import { 
  Activity, Battery, Zap, Server, Database, TrendingUp, 
  DollarSign, BarChart3, Settings, FileText, Clock, 
  AlertCircle, CheckCircle2, XCircle, Plus, Building2
} from 'lucide-react'
import { useAuthToken } from '../services/auth'

// Energy Contracts Marketplace Component
function EnergyContractsMarketplace({ nodeId, makeApiCall, nodeCapacity }) {
  const [contracts, setContracts] = useState([])
  const [myBids, setMyBids] = useState([])
  const [loading, setLoading] = useState(true)
  const [showBidForm, setShowBidForm] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [bidForm, setBidForm] = useState({
    capacity_mw: '',
    price_per_mw: ''
  })

  useEffect(() => {
    fetchContracts()
    fetchMyBids()
    const interval = setInterval(() => {
      fetchContracts()
      fetchMyBids()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchContracts = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const response = await makeApiCall(`${baseUrl}/api/marketplace/contracts?status=open&limit=10`)
      if (response.ok) {
        const result = await response.json()
        setContracts(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching contracts:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMyBids = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const response = await makeApiCall(`${baseUrl}/api/marketplace/bids?operator_email=amansharma12607@gmail.com&limit=10`)
      if (response.ok) {
        const result = await response.json()
        setMyBids(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching bids:', error)
    }
  }

  const handlePlaceBid = async (e) => {
    e.preventDefault()
    if (!selectedContract) return

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const response = await makeApiCall(`${baseUrl}/api/marketplace/contracts/${selectedContract.contract_id}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capacity_mw: parseFloat(bidForm.capacity_mw),
          price_per_mw: parseFloat(bidForm.price_per_mw),
          operator_email: 'amansharma12607@gmail.com',
          node_id: nodeId
        })
      })

      if (response.ok) {
        alert('Bid placed successfully!')
        setShowBidForm(false)
        setSelectedContract(null)
        setBidForm({ capacity_mw: '', price_per_mw: '' })
        fetchContracts()
        fetchMyBids()
      } else {
        const error = await response.json()
        alert('Failed to place bid: ' + (error.error || 'Unknown error'))
      }
    } catch (error) {
      alert('Error placing bid: ' + error.message)
    }
  }

  const openBidForm = (contract) => {
    setSelectedContract(contract)
    setBidForm({
      capacity_mw: Math.min(contract.required_capacity_mw, (nodeCapacity || 5000) / 1000).toFixed(2), // Use node capacity if available
      price_per_mw: (contract.max_price_per_mw * 0.95).toFixed(2) // Start at 95% of max
    })
    setShowBidForm(true)
  }

  if (loading) {
    return <div className="text-center py-4 text-gray-500">Loading contracts...</div>
  }

  return (
    <div className="space-y-4">
      {/* Available Contracts */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Building2 className="w-5 h-5 mr-2 text-primary-600" />
          Available Energy Contracts
        </h3>
        {contracts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No open contracts available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((contract) => (
              <div key={contract.contract_id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{contract.title || contract.contract_id}</h4>
                      <span className="badge badge-success">Open</span>
                    </div>
                    {contract.description && (
                      <p className="text-sm text-gray-600 mb-2">{contract.description}</p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Required:</span>
                        <span className="font-semibold ml-1">{contract.required_capacity_mw} MW</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Max Price:</span>
                        <span className="font-semibold ml-1">₹{contract.max_price_per_mw}/MW</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Duration:</span>
                        <span className="font-semibold ml-1">{contract.duration_minutes} min</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Bids:</span>
                        <span className="font-semibold ml-1">{contract.bid_count || 0}</span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      <span>Vendor: {contract.vendor_name}</span>
                      <span className="ml-3">
                        Posted: {new Date(contract.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => openBidForm(contract)}
                    className="ml-4 btn btn-primary flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Place Bid
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Bids */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">My Bids</h3>
        {myBids.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No bids placed yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-semibold">Contract</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold">Capacity</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold">Price</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold">Status</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {myBids.map((bid) => (
                  <tr key={bid.bid_id} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-sm">{bid.contract?.title || bid.contract_id}</td>
                    <td className="py-2 px-3 text-sm">{bid.capacity_mw} MW</td>
                    <td className="py-2 px-3 text-sm">₹{bid.price_per_mw}/MW</td>
                    <td className="py-2 px-3 text-sm">
                      <span className={`badge ${
                        bid.status === 'accepted' ? 'badge-success' :
                        bid.status === 'rejected' ? 'badge-error' :
                        'badge-warning'
                      }`}>
                        {bid.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-500">
                      {new Date(bid.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bid Form Modal */}
      {showBidForm && selectedContract && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Place Bid on Contract</h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedContract.title || selectedContract.contract_id}
            </p>
            <form onSubmit={handlePlaceBid} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capacity (MW)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max={selectedContract.required_capacity_mw}
                  value={bidForm.capacity_mw}
                  onChange={(e) => setBidForm({...bidForm, capacity_mw: e.target.value})}
                  className="input w-full"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Max: {selectedContract.required_capacity_mw} MW
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price per MW (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedContract.max_price_per_mw}
                  value={bidForm.price_per_mw}
                  onChange={(e) => setBidForm({...bidForm, price_per_mw: e.target.value})}
                  className="input w-full"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Max: ₹{selectedContract.max_price_per_mw}/MW
                </p>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary flex-1">
                  Place Bid
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBidForm(false)
                    setSelectedContract(null)
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DataCenterOperator() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [nodeId] = useState('DC01') // TODO: Get from user context or URL params
  const { makeApiCall } = useAuthToken()
  const [forecastData, setForecastData] = useState(null)
  const [historicalData, setHistoricalData] = useState(null)
  const [dispatchLogs, setDispatchLogs] = useState([])

  useEffect(() => {
    fetchAllData()
    const interval = setInterval(fetchAllData, 10000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId])

  const fetchAllData = async () => {
    try {
      setError(null)
      await Promise.all([
        fetchNodeData(),
        fetchForecastData(),
        fetchHistoricalTelemetry(),
        fetchDispatchLogs()
      ])
    } catch (error) {
      console.error('Error fetching data:', error)
      setError(error.message || 'Failed to fetch data')
    }
  }

  const fetchNodeData = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      // Fetch node details
      const nodeUrl = `${baseUrl}/api/nodes/${nodeId}`
      const nodeResponse = await makeApiCall(nodeUrl)
      
      if (!nodeResponse.ok) {
        throw new Error(`Failed to fetch node: ${nodeResponse.status}`)
      }
      
      const nodeResult = await nodeResponse.json()
      const node = nodeResult.data
      const lastState = node.last_state || {}
      
      // Fetch aggregate for revenue calculations
      const aggUrl = `${baseUrl}/api/aggregate`
      const aggResponse = await makeApiCall(aggUrl)
      let revenueData = { revenue_today: 0, co2_saved: 0 }
      if (aggResponse.ok) {
        const aggResult = await aggResponse.json()
        const agg = aggResult.data
        // Calculate per-node share based on capacity
        const nodeCapacity = node.capacity_kw || 150
        const totalCapacity = agg.total_capacity_kw || nodeCapacity
        const nodeShare = node.online && totalCapacity > 0 ? (nodeCapacity / totalCapacity) : 0
        revenueData = {
          revenue_today: Math.round(agg.revenue_today * nodeShare),
          co2_saved: parseFloat((agg.co2_saved * nodeShare).toFixed(1))
        }
      }
      
      // Calculate metrics from historical data if available
      const bessUtilization = calculateBESSUtilization(lastState, node)
      const efficiency = calculateEfficiency(lastState)
      const degradation = calculateBatteryDegradation(lastState, node)
      
      setData({
        currentLoadMW: (lastState.power_kw || 0) / 1000,
        soc: lastState.soc || 0,
        powerImportExport: (lastState.power_kw || 0) / 1000,
        gridFrequency: lastState.freq || 50.0,
        demandResponseMode: 'Auto', // TODO: Get from node config or dispatch logs
        currentDayEarnings: revenueData.revenue_today,
        monthlyRevenue: revenueData.revenue_today * 30, // Estimate
        revenueByService: {
          sras: Math.round(revenueData.revenue_today * 0.3),
          tras: Math.round(revenueData.revenue_today * 0.4),
          arbitrage: Math.round(revenueData.revenue_today * 0.2),
          dr: Math.round(revenueData.revenue_today * 0.1)
        },
        bessUtilizationRate: bessUtilization,
        loadDeferralPercent: calculateLoadDeferral(lastState, node),
        efficiencyFactor: efficiency,
        batteryDegradationIndex: degradation,
        nodeCapacity: node.capacity_kw || 150,
        nodeBattery: node.battery_kwh || 200,
        online: node.online || false,
        lastUpdate: lastState.timestamp || new Date().toISOString()
      })
    } catch (error) {
      console.error('Error fetching node data:', error)
      setError(error.message || 'Failed to fetch node data')
    } finally {
      setLoading(false)
    }
  }

  const fetchForecastData = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      // Fetch load forecast
      const loadForecastUrl = `${baseUrl}/api/forecast/load?horizon_hours=24`
      const loadResponse = await makeApiCall(loadForecastUrl)
      
      // Fetch grid stress forecast
      const stressForecastUrl = `${baseUrl}/api/forecast/grid-stress?horizon_hours=24`
      const stressResponse = await makeApiCall(stressForecastUrl)
      
      let loadForecast = null
      let stressForecast = null
      
      if (loadResponse.ok) {
        const loadResult = await loadResponse.json()
        loadForecast = loadResult.data
      }
      
      if (stressResponse.ok) {
        const stressResult = await stressResponse.json()
        stressForecast = stressResult.data
        
        // Convert grid stress predictions to grid events
        const predictedEvents = stressForecast.predictions
          .filter(p => p.value > 0.6) // Only show high stress events
          .slice(0, 5) // Limit to 5 events
          .map(p => ({
            time: new Date(p.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            type: p.value > 0.8 ? 'High Stress' : 'Moderate Stress',
            stressScore: p.value
          }))
        
        setForecastData({
          loadForecast,
          stressForecast,
          predictedGridEvents: predictedEvents
        })
      }
    } catch (error) {
      console.error('Error fetching forecast data:', error)
    }
  }

  const fetchHistoricalTelemetry = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      // Get last 24 hours of data
      const endTime = new Date()
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000)
      
      const telemetryUrl = `${baseUrl}/api/telemetry/range?dc_id=${nodeId}&start=${startTime.toISOString()}&end=${endTime.toISOString()}`
      const response = await makeApiCall(telemetryUrl)
      
      if (response.ok) {
        const result = await response.json()
        setHistoricalData(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching historical telemetry:', error)
    }
  }

  const fetchDispatchLogs = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      const dispatchUrl = `${baseUrl}/api/dispatch/logs?dc_id=${nodeId}&limit=10`
      const response = await makeApiCall(dispatchUrl)
      
      if (response.ok) {
        const result = await response.json()
        setDispatchLogs(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching dispatch logs:', error)
    }
  }

  // Calculate BESS utilization rate
  const calculateBESSUtilization = (lastState, node) => {
    if (!lastState || !lastState.soc) return 0
    // Utilization is based on how much of the battery capacity is being used
    const batteryCapacity = node.battery_kwh || 200
    const currentEnergy = (batteryCapacity * lastState.soc) / 100
    return (currentEnergy / batteryCapacity) * 100
  }

  // Calculate efficiency factor (simplified)
  const calculateEfficiency = (lastState) => {
    // Base efficiency, could be improved with actual charge/discharge data
    return 0.92 // Default efficiency for Li-ion batteries
  }

  // Calculate battery degradation
  const calculateBatteryDegradation = (lastState, node) => {
    // Simplified degradation calculation
    // In production, this would use cycle count, temperature, depth of discharge, etc.
    if (!node.created_at) return 0.95
    
    const ageDays = (new Date() - new Date(node.created_at)) / (1000 * 60 * 60 * 24)
    const degradationRate = 0.0001 // 0.01% per day (very simplified)
    const degradation = 1 - (ageDays * degradationRate)
    return Math.max(0.8, Math.min(1, degradation)) // Clamp between 0.8 and 1.0
  }

  // Calculate load deferral percentage
  const calculateLoadDeferral = (lastState, node) => {
    if (!lastState || !lastState.power_kw || !node.capacity_kw) return 0
    // Load deferral is the percentage of load that can be deferred
    const loadRatio = Math.abs(lastState.power_kw) / node.capacity_kw
    return Math.min(100, loadRatio * 25) // Simplified calculation
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-lg font-semibold text-gray-900">Error loading data</p>
        <p className="text-sm text-gray-600 mt-2">{error}</p>
        <button 
          onClick={() => {
            setError(null)
            setLoading(true)
            fetchAllData()
          }} 
          className="btn btn-primary mt-4"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">No data available</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Data Center Energy Operations Dashboard</h1>
            <p className="mt-2 text-gray-600">Monitor and control your data center energy operations</p>
          </div>
        </div>
      </div>

      {/* Live Operations Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-primary-600" />
          Live Operations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Current Load</p>
            <p className="text-2xl font-bold text-gray-900">{data?.currentLoadMW?.toFixed(2) || 0} MW</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">SOC (Battery %)</p>
            <p className="text-2xl font-bold text-gray-900">{data?.soc?.toFixed(1) || 0}%</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Power Import/Export</p>
            <p className={`text-2xl font-bold ${(data?.powerImportExport || 0) < 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(data?.powerImportExport || 0) > 0 ? '+' : ''}{(data?.powerImportExport || 0).toFixed(1)} kW
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {(data?.powerImportExport || 0) < 0 ? 'Exporting' : 'Importing'}
            </p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Grid Frequency</p>
            <p className="text-2xl font-bold text-gray-900">{data?.gridFrequency?.toFixed(2) || 50.0} Hz</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Status</p>
            <div className="flex items-center mt-2">
              <span className={`badge ${data?.online ? 'badge-success' : 'badge-error'}`}>
                {data?.online ? 'Online' : 'Offline'}
              </span>
            </div>
            {data?.lastUpdate && (
              <p className="text-xs text-gray-500 mt-1">
                Updated: {new Date(data.lastUpdate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Revenue Streams Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <DollarSign className="w-5 h-5 mr-2 text-primary-600" />
          Revenue Streams
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Current Day Earnings</p>
            <p className="text-3xl font-bold text-green-600">₹{data?.currentDayEarnings?.toLocaleString() || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Monthly Revenue</p>
            <p className="text-3xl font-bold text-gray-900">₹{data?.monthlyRevenue?.toLocaleString() || 0}</p>
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Split by Service Type</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">SRAS</span>
                <span className="font-semibold">₹{data?.revenueByService?.sras?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">TRAS</span>
                <span className="font-semibold">₹{data?.revenueByService?.tras?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Arbitrage</span>
                <span className="font-semibold">₹{data?.revenueByService?.arbitrage?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">DR</span>
                <span className="font-semibold">₹{data?.revenueByService?.dr?.toLocaleString() || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Trends Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-primary-600" />
          Performance Trends
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">BESS Utilization Rate</p>
            <p className="text-2xl font-bold text-gray-900">{data?.bessUtilizationRate?.toFixed(1) || 0}%</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Load Deferral %</p>
            <p className="text-2xl font-bold text-gray-900">{data?.loadDeferralPercent?.toFixed(1) || 0}%</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Efficiency Factor</p>
            <p className="text-2xl font-bold text-gray-900">{data?.efficiencyFactor?.toFixed(2) || 0.92}</p>
            <p className="text-xs text-gray-500 mt-1">kWh in/out</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Battery Degradation</p>
            <p className="text-2xl font-bold text-gray-900">{data?.batteryDegradationIndex?.toFixed(2) || 0.95}</p>
            <p className="text-xs text-gray-500 mt-1">Health Index</p>
          </div>
        </div>
      </div>

      {/* Forecasts Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-primary-600" />
          Forecasts
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Next 24h Demand Curve</h3>
            {forecastData?.loadForecast?.predictions ? (
              <div className="h-64 flex flex-col justify-end">
                <div className="flex items-end justify-between h-full gap-1">
                  {forecastData.loadForecast.predictions
                    .filter((_, i) => i % 4 === 0) // Show every hour
                    .slice(0, 24)
                    .map((pred, idx) => {
                      const maxValue = Math.max(...forecastData.loadForecast.predictions.map(p => p.value))
                      const height = maxValue > 0 ? (pred.value / maxValue) * 100 : 0
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center">
                          <div 
                            className="w-full bg-primary-500 rounded-t transition-all"
                            style={{ height: `${height}%` }}
                            title={`${pred.value.toFixed(1)} kW at ${new Date(pred.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                          />
                          {idx % 6 === 0 && (
                            <span className="text-xs text-gray-500 mt-1">
                              {new Date(pred.time).toLocaleTimeString('en-US', { hour: '2-digit' })}
                            </span>
                          )}
                        </div>
                      )
                    })}
                </div>
                <div className="mt-2 text-xs text-gray-500 text-center">
                  Confidence: {(forecastData.loadForecast.confidence * 100).toFixed(0)}%
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
                {loading ? 'Loading forecast...' : 'No forecast data available'}
              </div>
            )}
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Predicted Grid Events</h3>
            <div className="space-y-3">
              {(forecastData?.predictedGridEvents || []).length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No predicted grid events</p>
                  {forecastData?.stressForecast && (
                    <p className="text-xs mt-2">
                      Current stress: {(forecastData.stressForecast.current_stress_score * 100).toFixed(0)}%
                    </p>
                  )}
                </div>
              ) : (
                forecastData.predictedGridEvents.map((event, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 text-gray-500 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{event.time}</p>
                      <p className="text-xs text-gray-500">{event.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className={`badge ${event.stressScore > 0.7 ? 'badge-error' : 'badge-warning'} mr-2`}>
                      Stress: {(event.stressScore * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                ))
              )}
            </div>
            {forecastData?.stressForecast && (
              <div className="mt-4 p-3 bg-primary-50 rounded-lg">
                <p className="text-sm text-primary-900">
                  <strong>Current Grid Stress:</strong> {(forecastData.stressForecast.current_stress_score * 100).toFixed(0)}%
                  {forecastData.stressForecast.current_stress_score > 0.6 && (
                    <span className="ml-2 text-orange-600">⚠️ High stress detected</span>
                  )}
                </p>
                {forecastData.predictedGridEvents && forecastData.predictedGridEvents.length > 0 && (
                  <p className="text-xs text-primary-700 mt-1">
                    Prepare for peak demand. Charge BESS to 90% before high stress periods.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Control Panel Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Settings className="w-5 h-5 mr-2 text-primary-600" />
          Control Panel
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Operation Mode</h3>
            <div className="space-y-3">
              <label className="flex items-center p-3 border-2 border-primary-500 rounded-lg cursor-pointer">
                <input type="radio" name="mode" value="auto" defaultChecked className="mr-3" />
                <div>
                  <p className="font-medium">Auto</p>
                  <p className="text-xs text-gray-500">Platform manages all operations</p>
                </div>
              </label>
              <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="radio" name="mode" value="manual" className="mr-3" />
                <div>
                  <p className="font-medium">Manual</p>
                  <p className="text-xs text-gray-500">You control dispatch decisions</p>
                </div>
              </label>
              <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="radio" name="mode" value="dr-only" className="mr-3" />
                <div>
                  <p className="font-medium">DR-Only</p>
                  <p className="text-xs text-gray-500">Only demand response events</p>
                </div>
              </label>
            </div>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Dispatch Override</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Charge/Discharge Rate (%)
                </label>
                <input 
                  type="range" 
                  min="-100" 
                  max="100" 
                  defaultValue="0" 
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>-100% (Discharge)</span>
                  <span>0%</span>
                  <span>+100% (Charge)</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maintenance Window
                </label>
                <div className="flex gap-2">
                  <input type="time" className="input flex-1" defaultValue="02:00" />
                  <span className="self-center">to</span>
                  <input type="time" className="input flex-1" defaultValue="04:00" />
                </div>
              </div>
              <button className="btn btn-primary w-full">Apply Override</button>
            </div>
          </div>
        </div>
      </div>

      {/* Energy Contracts Marketplace Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <DollarSign className="w-5 h-5 mr-2 text-primary-600" />
          Energy Contracts Marketplace
        </h2>
        <EnergyContractsMarketplace nodeId={nodeId} makeApiCall={makeApiCall} nodeCapacity={data?.nodeCapacity} />
      </div>

      {/* Compliance & Settlement Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-primary-600" />
          Compliance & Settlement
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Payment Wallet Balance</h3>
            <p className="text-3xl font-bold text-green-600 mb-2">₹{data?.walletBalance?.toLocaleString() || 0}</p>
            <p className="text-sm text-gray-500">Solana Wallet</p>
            <button className="btn btn-secondary mt-4 w-full">View Wallet</button>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Energy Credits</h3>
            <p className="text-3xl font-bold text-primary-600 mb-2">{data?.energyCredits || 0}</p>
            <p className="text-sm text-gray-500">Total credits earned</p>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Recent Dispatch Commands</h3>
            {dispatchLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No dispatch history</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dispatchLogs.slice(0, 5).map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center">
                      {log.status === 'active' || log.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 mr-2" />
                      ) : (
                        <Clock className="w-4 h-4 text-gray-400 mr-2" />
                      )}
                      <div>
                        <span className="text-sm font-medium">{log.action}</span>
                        {log.params?.power_kw && (
                          <span className="text-xs text-gray-500 ml-2">
                            {log.params.power_kw > 0 ? '+' : ''}{log.params.power_kw} kW
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-secondary mt-4 w-full">View All Logs</button>
          </div>
        </div>
      </div>
    </div>
  )
}
