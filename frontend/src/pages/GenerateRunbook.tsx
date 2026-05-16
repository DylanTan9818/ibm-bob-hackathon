import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function GenerateRunbook() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    incident_title: '',
    incident_description: '',
    error_logs: '',
    metadata: {}
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await axios.post(`${API_URL}/api/v1/runbooks/generate`, formData)
      const { task_id } = response.data
      navigate(`/tasks/${task_id}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate runbook')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Generate Runbook</h1>
      <div className="bg-gray-800 rounded-lg p-6">
        <p className="text-gray-400 mb-6">
          Generate a step-by-step runbook for resolving an incident. The AI agent will
          search for similar past incidents and create detailed resolution procedures.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Incident Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.incident_title}
              onChange={(e) => setFormData({ ...formData, incident_title: e.target.value })}
              className="w-full bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Database connection pool exhausted"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Incident Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              value={formData.incident_description}
              onChange={(e) => setFormData({ ...formData, incident_description: e.target.value })}
              className="w-full bg-gray-700 rounded px-4 py-2 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Application cannot connect to database, users experiencing errors..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Error Logs (Optional)
            </label>
            <textarea
              value={formData.error_logs}
              onChange={(e) => setFormData({ ...formData, error_logs: e.target.value })}
              className="w-full bg-gray-700 rounded px-4 py-2 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="Paste relevant error logs here..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded font-medium transition"
          >
            {loading ? 'Generating...' : 'Generate Runbook'}
          </button>
        </form>
      </div>
    </div>
  )
}

// Made with Bob
