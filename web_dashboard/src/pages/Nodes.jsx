import { Server, CheckCircle2, AlertCircle, Battery, Zap, Activity } from 'lucide-react'

export default function Nodes() {
  const nodes = [
    {
      id: 'DC-001',
      name: 'Data Center Node 1',
      status: 'online',
      power: 125.5,
      soc: 78.5,
      frequency: 49.98,
      location: 'Mumbai',
    },
    {
      id: 'DC-002',
      name: 'Data Center Node 2',
      status: 'online',
      power: 120.3,
      soc: 82.1,
      frequency: 49.99,
      location: 'Delhi',
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Edge Nodes</h1>
          <p className="mt-2 text-gray-600">Monitor and manage IoT edge nodes across data centers</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 px-4 py-2 bg-grid-50 border border-grid-200 rounded-xl">
            <div className="w-2 h-2 bg-grid-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-grid-700">{nodes.length} Nodes Online</span>
          </div>
        </div>
      </div>

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
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{node.location}</span>
                <span className={`badge ${node.status === 'online' ? 'badge-success' : 'badge-error'}`}>
                  {node.status}
                </span>
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
    </div>
  )
}
