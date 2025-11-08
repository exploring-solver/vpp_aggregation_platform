import { useEffect, useState } from 'react'
import { 
  Activity, Battery, Zap, Server, Database, TrendingUp, 
  DollarSign, BarChart3, Settings, FileText, Clock, 
  AlertCircle, CheckCircle2, XCircle
} from 'lucide-react'
import { useAuthToken } from '../services/auth'

export default function DataCenterOperator() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [nodeId] = useState('DC01') // TODO: Get from user context or URL params
  const { makeApiCall, isTokenReady } = useAuthToken()

  useEffect(() => {
    if (isTokenReady) {
      fetchNodeData()
      const interval = setInterval(fetchNodeData, 10000)
      return () => clearInterval(interval)
    }
  }, [nodeId, makeApiCall, isTokenReady])

  const fetchNodeData = async () => {
    try {
      // Fetch node details
      const nodeUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/nodes/${nodeId}`
      const nodeResponse = await makeApiCall(nodeUrl)
      
      if (nodeResponse.ok) {
        const nodeResult = await nodeResponse.json()
        const node = nodeResult.data
        const lastState = node.last_state || {}
        
        // Fetch aggregate for revenue calculations
        const aggUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/aggregate`
        const aggResponse = await makeApiCall(aggUrl)
        let revenueData = { revenue_today: 0, co2_saved: 0 }
        if (aggResponse.ok) {
          const aggResult = await aggResponse.json()
          const agg = aggResult.data
          // Calculate per-node share (simplified)
          const nodeShare = node.online ? (1 / (agg.online_nodes || 1)) : 0
          revenueData = {
            revenue_today: Math.round(agg.revenue_today * nodeShare),
            co2_saved: parseFloat((agg.co2_saved * nodeShare).toFixed(1))
          }
        }
        
        setData({
          currentLoadMW: (lastState.power_kw || 0) / 1000,
          soc: lastState.soc || 0,
          powerImportExport: (lastState.power_kw || 0) / 1000, // Simplified
          gridFrequency: lastState.freq || 50.0,
          demandResponseMode: 'Auto',
          currentDayEarnings: revenueData.revenue_today,
          monthlyRevenue: revenueData.revenue_today * 30, // Estimate
          revenueByService: {
            sras: Math.round(revenueData.revenue_today * 0.3),
            tras: Math.round(revenueData.revenue_today * 0.4),
            arbitrage: Math.round(revenueData.revenue_today * 0.2),
            dr: Math.round(revenueData.revenue_today * 0.1)
          },
          bessUtilizationRate: lastState.soc || 0,
          loadDeferralPercent: 12.5, // TODO: Calculate from actual data
          efficiencyFactor: 0.92, // TODO: Calculate from actual data
          batteryDegradationIndex: 0.95, // TODO: Calculate from actual data
          predictedGridEvents: [], // TODO: Fetch from forecast API
          walletBalance: 125000, // TODO: Fetch from blockchain API
          energyCredits: 450 // TODO: Fetch from blockchain API
        })
      }
    } catch (error) {
      console.error('Error fetching node data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
            <p className="text-sm font-medium text-gray-600 mb-1">DR Mode</p>
            <div className="flex items-center mt-2">
              <span className="badge badge-success">{data?.demandResponseMode || 'Auto'}</span>
            </div>
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
            <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
              Chart placeholder - implement with Recharts
            </div>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Predicted Grid Events</h3>
            <div className="space-y-3">
              {(data?.predictedGridEvents || []).length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No predicted grid events</p>
                </div>
              ) : (
                data.predictedGridEvents.map((event, idx) => (
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
                      Stress: {event.stressScore}
                    </span>
                  </div>
                </div>
                ))
              )}
            </div>
            <div className="mt-4 p-3 bg-primary-50 rounded-lg">
              <p className="text-sm text-primary-900">
                <strong>Recommended Scheduling:</strong> Prepare for peak demand at 14:00. 
                Charge BESS to 90% by 13:30 for optimal participation.
              </p>
            </div>
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
            <h3 className="text-lg font-semibold mb-4">Smart Contract History</h3>
            {(data?.smartContractHistory || []).length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No contract history</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.smartContractHistory.map((contract, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mr-2" />
                      <span className="text-sm">Settlement #{contract.id || idx}</span>
                    </div>
                    <span className="text-xs text-gray-500">{contract.time || 'N/A'}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-secondary mt-4 w-full">View All</button>
          </div>
        </div>
      </div>
    </div>
  )
}
