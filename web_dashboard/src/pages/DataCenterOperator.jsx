import { useEffect, useState } from 'react'
import { 
  Activity, Battery, Zap, Server, Database, TrendingUp, 
  DollarSign, BarChart3, Settings, FileText, Clock, 
  AlertCircle, CheckCircle2, XCircle
} from 'lucide-react'

export default function DataCenterOperator() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Connect to WebSocket for real-time updates
    // TODO: Fetch data center operator data from API
    setTimeout(() => {
      setData({
        // Live Operations
        currentLoadMW: 2.45,
        soc: 78.5,
        powerImportExport: -0.5, // negative = export, positive = import
        gridFrequency: 49.98,
        demandResponseMode: 'Auto',
        
        // Revenue Streams
        currentDayEarnings: 12500,
        monthlyRevenue: 375000,
        revenueByService: {
          sras: 45000,
          tras: 120000,
          arbitrage: 150000,
          dr: 60000
        },
        
        // Performance Trends
        bessUtilizationRate: 85.2,
        loadDeferralPercent: 12.5,
        efficiencyFactor: 0.92,
        batteryDegradationIndex: 0.95,
        
        // Forecasts
        next24hDemand: [],
        predictedGridEvents: [
          { time: '14:00', stressScore: 0.8, type: 'Peak Demand' },
          { time: '18:00', stressScore: 0.6, type: 'Evening Load' }
        ],
        
        // Compliance
        smartContractHistory: [],
        walletBalance: 125000,
        energyCredits: 450
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
            <p className="text-2xl font-bold text-gray-900">{data.currentLoadMW} MW</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">SOC (Battery %)</p>
            <p className="text-2xl font-bold text-gray-900">{data.soc}%</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Power Import/Export</p>
            <p className={`text-2xl font-bold ${data.powerImportExport < 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.powerImportExport > 0 ? '+' : ''}{data.powerImportExport} kW
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {data.powerImportExport < 0 ? 'Exporting' : 'Importing'}
            </p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Grid Frequency</p>
            <p className="text-2xl font-bold text-gray-900">{data.gridFrequency} Hz</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">DR Mode</p>
            <div className="flex items-center mt-2">
              <span className="badge badge-success">{data.demandResponseMode}</span>
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
            <p className="text-3xl font-bold text-green-600">₹{data.currentDayEarnings.toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Monthly Revenue</p>
            <p className="text-3xl font-bold text-gray-900">₹{data.monthlyRevenue.toLocaleString()}</p>
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Split by Service Type</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">SRAS</span>
                <span className="font-semibold">₹{data.revenueByService.sras.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">TRAS</span>
                <span className="font-semibold">₹{data.revenueByService.tras.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Arbitrage</span>
                <span className="font-semibold">₹{data.revenueByService.arbitrage.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">DR</span>
                <span className="font-semibold">₹{data.revenueByService.dr.toLocaleString()}</span>
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
            <p className="text-2xl font-bold text-gray-900">{data.bessUtilizationRate}%</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Load Deferral %</p>
            <p className="text-2xl font-bold text-gray-900">{data.loadDeferralPercent}%</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Efficiency Factor</p>
            <p className="text-2xl font-bold text-gray-900">{data.efficiencyFactor}</p>
            <p className="text-xs text-gray-500 mt-1">kWh in/out</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-600 mb-1">Battery Degradation</p>
            <p className="text-2xl font-bold text-gray-900">{data.batteryDegradationIndex}</p>
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
              {data.predictedGridEvents.map((event, idx) => (
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
              ))}
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
            <p className="text-3xl font-bold text-green-600 mb-2">₹{data.walletBalance.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Solana Wallet</p>
            <button className="btn btn-secondary mt-4 w-full">View Wallet</button>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Energy Credits</h3>
            <p className="text-3xl font-bold text-primary-600 mb-2">{data.energyCredits}</p>
            <p className="text-sm text-gray-500">Total credits earned</p>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Smart Contract History</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mr-2" />
                  <span className="text-sm">Settlement #1234</span>
                </div>
                <span className="text-xs text-gray-500">2h ago</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mr-2" />
                  <span className="text-sm">Settlement #1233</span>
                </div>
                <span className="text-xs text-gray-500">1d ago</span>
              </div>
            </div>
            <button className="btn btn-secondary mt-4 w-full">View All</button>
          </div>
        </div>
      </div>
    </div>
  )
}
