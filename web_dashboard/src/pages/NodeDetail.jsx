import { useParams } from 'react-router-dom'

export default function NodeDetail() {
  const { dcId } = useParams()

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Node: {dcId}</h1>
      <div className="card">
        <p className="text-gray-600">Node details - implement API integration</p>
      </div>
    </div>
  )
}
