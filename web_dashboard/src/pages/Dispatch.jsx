import { Send, Zap, Battery, Activity, AlertCircle } from 'lucide-react'

export default function Dispatch() {
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
              <select className="input">
                <option>All Nodes</option>
                <option>Node 1</option>
                <option>Node 2</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Command Type
              </label>
              <select className="input">
                <option>Charge</option>
                <option>Discharge</option>
                <option>Hold</option>
                <option>Load Deferral</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Power (kW)
              </label>
              <input type="number" className="input" placeholder="Enter power value" />
            </div>
            <button className="btn btn-primary w-full">
              <Send className="w-4 h-4 mr-2" />
              Send Dispatch Command
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
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Node 1 - Charge</span>
                <span className="badge badge-success">Active</span>
              </div>
              <p className="text-xs text-gray-600">50 kW • Started 2m ago</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Node 2 - Discharge</span>
                <span className="badge badge-success">Active</span>
              </div>
              <p className="text-xs text-gray-600">30 kW • Started 5m ago</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Dispatch History</h2>
        <div className="text-center py-12 text-gray-400">
          <Send className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Dispatch history will appear here</p>
        </div>
      </div>
    </div>
  )
}
