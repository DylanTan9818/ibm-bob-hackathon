import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface RunbookStep {
  step: string
  description: string
  command?: string
}

interface RunbookResult {
  title: string
  steps: RunbookStep[]
  prerequisites: string[]
  estimated_time: string
  related_docs: string[]
  similar_incidents: any[]
}

interface TaskResult {
  agent: string
  data: RunbookResult
  metadata: {
    agent_description: string
    llm_provider: string
    llm_model: string
  }
}

export default function GenerateRunbook() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskStatus, setTaskStatus] = useState<string>('')
  const [result, setResult] = useState<TaskResult | null>(null)
  const [formData, setFormData] = useState({
    incident_title: '',
    incident_description: '',
    error_logs: '',
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
      const response = await axios.post(`${API_URL}/api/v1/runbooks/generate`, formData)
      const { task_id } = response.data
      setTaskId(task_id)
      setTaskStatus('pending')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate runbook')
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFormData({
      incident_title: '',
      incident_description: '',
      error_logs: '',
      metadata: {}
    })
    setResult(null)
    setTaskId(null)
    setTaskStatus('')
    setError('')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Generate Runbook</h1>
      
      {!result ? (
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

          {loading && (
            <div className="bg-blue-500/10 border border-blue-500 text-blue-400 px-4 py-3 rounded mb-4">
              <div className="flex items-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>
                  {taskStatus === 'pending' && 'Submitting request...'}
                  {taskStatus === 'in_progress' && 'AI agent generating runbook...'}
                  {taskStatus === 'awaiting_approval' && 'Finalizing runbook...'}
                </span>
              </div>
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
                disabled={loading}
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
                disabled={loading}
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
                disabled={loading}
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
      ) : (
        <div className="space-y-6">
          {/* Success Banner */}
          <div className="bg-green-500/10 border border-green-500 text-green-400 px-6 py-4 rounded-lg">
            <div className="flex items-center">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold">Runbook Generated</h3>
                <p className="text-sm text-green-300">AI agent has created a resolution procedure</p>
              </div>
            </div>
          </div>

          {/* Runbook Header */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">{result.data.title}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Estimated Time</div>
                <div className="font-medium text-lg flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {result.data.estimated_time}
                </div>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Total Steps</div>
                <div className="font-medium text-lg flex items-center">
                  <svg className="w-5 h-5 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {result.data.steps.length} steps
                </div>
              </div>
            </div>
          </div>

          {/* Prerequisites */}
          {result.data.prerequisites.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-4 flex items-center text-lg">
                <svg className="w-6 h-6 mr-2 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Prerequisites
              </h3>
              <ul className="space-y-2">
                {result.data.prerequisites.map((prereq, index) => (
                  <li key={index} className="flex items-start">
                    <svg className="w-5 h-5 mr-2 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-300">{prereq}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Resolution Steps */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="font-semibold mb-4 flex items-center text-lg">
              <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Resolution Steps
            </h3>
            <div className="space-y-4">
              {result.data.steps.map((step, index) => (
                <div key={index} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-start mb-2">
                    <span className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg mb-2">{step.step}</h4>
                      <p className="text-gray-300 mb-3">{step.description}</p>
                      {step.command && (
                        <div className="bg-gray-900 rounded p-3 font-mono text-sm text-green-400 overflow-x-auto">
                          <code>{step.command}</code>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Similar Incidents */}
          {result.data.similar_incidents && result.data.similar_incidents.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-4 flex items-center text-lg">
                <svg className="w-6 h-6 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Similar Past Incidents
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Found {result.data.similar_incidents.length} similar incident{result.data.similar_incidents.length !== 1 ? 's' : ''} from history
              </p>
              <div className="space-y-4">
                {result.data.similar_incidents.map((incident: any, index: number) => (
                  <div key={index} className="bg-gray-700 rounded-lg p-4 border-l-4 border-green-500">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold">{incident.title}</h4>
                      <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium">
                        {(incident.similarity * 100).toFixed(1)}% match
                      </span>
                    </div>
                    {incident.description && (
                      <p className="text-gray-400 text-sm mb-3">{incident.description}</p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
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

          {/* Related Documentation */}
          {result.data.related_docs.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-4 flex items-center text-lg">
                <svg className="w-6 h-6 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Related Documentation
              </h3>
              <ul className="space-y-2">
                {result.data.related_docs.map((doc, index) => (
                  <li key={index} className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-blue-400 hover:underline cursor-pointer">{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleReset}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-medium transition"
            >
              Generate Another Runbook
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
