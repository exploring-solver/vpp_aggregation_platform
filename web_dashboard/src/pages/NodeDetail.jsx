import { useParams } from 'react-router-dom'
import { Server } from 'lucide-react'

export default function NodeDetail() {
  const { dcId } = useParams()

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Node: {dcId}</h1>
          <p className="mt-2 text-gray-600">Detailed view of edge node telemetry and status</p>
        </div>
      </div>
      <div className="card">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
            <Server className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Node Details</h2>
        </div>
        <p className="text-gray-600">Node details - implement API integration</p>
      </div>
    </div>
  )
}
