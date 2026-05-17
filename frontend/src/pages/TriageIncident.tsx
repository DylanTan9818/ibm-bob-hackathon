import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface TriageResult {
  severity: string
  category: string
  assigned_team: string
  initial_steps: string[]
  confidence: number
  reasoning: string
  similar_incidents: any[]
}

interface TaskResult {
  agent: string
  data: TriageResult
  metadata: {
    agent_description: string
    llm_provider: string
    llm_model: string
  }
}

export default function TriageIncident() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskStatus, setTaskStatus] = useState<string>('')
  const [result, setResult] = useState<TaskResult | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    source: 'manual',
    metadata: {}
  })

  // Poll for task status
  useEffect(() => {
    if (!taskId) return

    const pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(`${API_URL}/api/v1/tasks/${taskId}`)
        const task = response.data
        setTaskStatus(task.status)

        if (task.status === 'completed' || task.status === 'awaiting_approval') {
          setResult(task.result)
          setLoading(false)
          clearInterval(pollInterval)
        } else if (task.status === 'failed') {
          setError(task.error || 'Task failed')
          setLoading(false)
          clearInterval(pollInterval)
        }
      } catch (err: any) {
        console.error('Error polling task:', err)
      }
    }, 1000)

    return () => clearInterval(pollInterval)
  }, [taskId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    setTaskId(null)

    try {
      const response = await axios.post(`${API_URL}/api/v1/incidents/triage`, formData)
      const { task_id } = response.data
      setTaskId(task_id)
      setTaskStatus('pending')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit incident')
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFormData({
      title: '',
      description: '',
      source: 'manual',
      metadata: {}
    })
    setResult(null)
    setTaskId(null)
    setTaskStatus('')
    setError('')
  }

  const getSeverityColor = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-500'
      case 'HIGH': return 'bg-orange-500'
      case 'MEDIUM': return 'bg-yellow-500'
      case 'LOW': return 'bg-blue-500'
      case 'INFO': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Triage Incident</h1>
      
      {!result ? (
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

          {loading && (
            <div className="bg-blue-500/10 border border-blue-500 text-blue-400 px-4 py-3 rounded mb-4">
              <div className="flex items-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>
                  {taskStatus === 'pending' && 'Submitting incident...'}
                  {taskStatus === 'in_progress' && 'AI agent analyzing incident...'}
                  {taskStatus === 'awaiting_approval' && 'Finalizing results...'}
                </span>
              </div>
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
                disabled={loading}
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
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Source</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
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
              {loading ? 'Processing...' : 'Submit for Triage'}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Success Banner */}
          <div className="bg-green-500/10 border border-green-500 text-green-400 px-6 py-4 rounded-lg">
            <div className="flex items-center">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold">Triage Complete</h3>
                <p className="text-sm text-green-300">AI agent has analyzed the incident</p>
              </div>
            </div>
          </div>

          {/* Incident Summary */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Incident Summary</h2>
            <div className="space-y-3">
              <div>
                <span className="text-gray-400">Title:</span>
                <p className="font-medium">{formData.title}</p>
              </div>
              <div>
                <span className="text-gray-400">Description:</span>
                <p className="text-gray-300">{formData.description}</p>
              </div>
            </div>
          </div>

          {/* Triage Results */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Triage Results</h2>
            
            {/* Severity & Team */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Severity</div>
                <div className="flex items-center">
                  <span className={`${getSeverityColor(result.data.severity)} px-3 py-1 rounded-full text-sm font-semibold`}>
                    {result.data.severity}
                  </span>
                </div>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Category</div>
                <div className="font-medium capitalize">{result.data.category}</div>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Assigned Team</div>
                <div className="font-medium">{result.data.assigned_team}</div>
              </div>
            </div>

            {/* Confidence */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Confidence</span>
                <span className="font-medium">{(result.data.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${result.data.confidence * 100}%` }}
                />
              </div>
            </div>

            {/* Initial Steps */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Initial Steps
              </h3>
              <ol className="space-y-2">
                {result.data.initial_steps.map((step, index) => (
                  <li key={index} className="flex items-start">
                    <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mr-3 mt-0.5 flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-gray-300">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Reasoning */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Reasoning
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">{result.data.reasoning}</p>
            </div>
          </div>

          {/* Similar Incidents */}
          {result.data.similar_incidents && result.data.similar_incidents.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Similar Past Incidents
              </h2>
              <p className="text-gray-400 text-sm mb-4">
                Found {result.data.similar_incidents.length} similar incident{result.data.similar_incidents.length !== 1 ? 's' : ''} from history
              </p>
              <div className="space-y-4">
                {result.data.similar_incidents.map((incident: any, index: number) => (
                  <div key={index} className="bg-gray-700 rounded-lg p-4 border-l-4 border-green-500">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg">{incident.title}</h3>
                      <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium">
                        {(incident.similarity * 100).toFixed(1)}% match
                      </span>
                    </div>
                    {incident.description && (
                      <p className="text-gray-400 text-sm mb-3">{incident.description}</p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {incident.severity && (
                        <div>
                          <span className="text-gray-500">Severity:</span>
                          <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${getSeverityColor(incident.severity)}`}>
                            {incident.severity}
                          </span>
                        </div>
                      )}
                      {incident.team && (
                        <div>
                          <span className="text-gray-500">Team:</span>
                          <span className="ml-2 text-gray-300">{incident.team}</span>
                        </div>
                      )}
                      {incident.resolution && (
                        <div className="md:col-span-2">
                          <span className="text-gray-500">Resolution:</span>
                          <p className="text-gray-300 mt-1">{incident.resolution}</p>
                        </div>
                      )}
                      {incident.resolution_time && (
                        <div>
                          <span className="text-gray-500">Resolution Time:</span>
                          <span className="ml-2 text-green-400 font-medium">{incident.resolution_time}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleReset}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-medium transition"
            >
              Triage Another Incident
            </button>
            {taskId && (
              <Link
                to={`/tasks/${taskId}`}
                className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded font-medium transition inline-block"
              >
                View Full Task Details
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Made with Bob
