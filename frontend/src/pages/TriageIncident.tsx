import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function TriageIncident() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    source: 'manual',
    metadata: {}
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await axios.post(`${API_URL}/api/v1/incidents/triage`, formData)
      const { task_id } = response.data
      navigate(`/tasks/${task_id}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit incident')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Triage Incident</h1>
      <div className="bg-gray-800 rounded-lg p-6">
        <p className="text-gray-400 mb-6">
          Submit an incident for automated triage. The AI agent will classify severity,
          route to the appropriate team, and suggest initial troubleshooting steps.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="High CPU usage on prod-server-01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-gray-700 rounded px-4 py-2 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Detailed description of the incident..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Source</label>
            <select
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="w-full bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="manual">Manual</option>
              <option value="prometheus">Prometheus</option>
              <option value="pagerduty">PagerDuty</option>
              <option value="datadog">Datadog</option>
              <option value="newrelic">New Relic</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded font-medium transition"
          >
            {loading ? 'Submitting...' : 'Submit for Triage'}
          </button>
        </form>
      </div>
    </div>
  )
}

// Made with Bob
