import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface DocResult {
  doc_type: string
  title: string
  content: string
  sections: Record<string, string>
  metadata: {
    version?: string
    date?: string
    author?: string
  }
}

interface TaskResult {
  agent: string
  data: DocResult
  metadata: {
    agent_description: string
    llm_provider: string
    llm_model: string
  }
}

export default function GenerateDocs() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskStatus, setTaskStatus] = useState<string>('')
  const [result, setResult] = useState<TaskResult | null>(null)
  const [formData, setFormData] = useState({
    doc_type: 'release_notes',
    repository: '',
    from_commit: '',
    to_commit: 'HEAD',
    incident_id: '',
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
      const response = await axios.post(`${API_URL}/api/v1/docs/generate`, formData)
      const { task_id } = response.data
      setTaskId(task_id)
      setTaskStatus('pending')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate documentation')
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFormData({
      doc_type: 'release_notes',
      repository: '',
      from_commit: '',
      to_commit: 'HEAD',
      incident_id: '',
      metadata: {}
    })
    setResult(null)
    setTaskId(null)
    setTaskStatus('')
    setError('')
  }

  const getDocTypeIcon = (docType: string) => {
    switch (docType) {
      case 'release_notes':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      case 'postmortem':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        )
      case 'changelog':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        )
      default:
        return null
    }
  }

  const copyToClipboard = () => {
    if (!result) return
    
    let text = `# ${result.data.title}\n\n`
    Object.entries(result.data.sections || {}).forEach(([sectionName, sectionContent]) => {
      const formattedName = sectionName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      text += `## ${formattedName}\n\n${sectionContent}\n\n`
    })
    
    navigator.clipboard.writeText(text)
    alert('Documentation copied to clipboard!')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Generate Documentation</h1>
      
      {!result ? (
        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-gray-400 mb-6">
            Automatically generate release notes, post-mortems, or changelogs from Git history
            or incident data.
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
                  {taskStatus === 'in_progress' && 'AI agent generating documentation...'}
                  {taskStatus === 'awaiting_approval' && 'Finalizing documentation...'}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Document Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.doc_type}
                onChange={(e) => setFormData({ ...formData, doc_type: e.target.value })}
                className="w-full bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="release_notes">Release Notes</option>
                <option value="postmortem">Post-Mortem</option>
                <option value="changelog">Changelog</option>
              </select>
            </div>

            {(formData.doc_type === 'release_notes' || formData.doc_type === 'changelog') && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Repository
                  </label>
                  <input
                    type="text"
                    value={formData.repository}
                    onChange={(e) => setFormData({ ...formData, repository: e.target.value })}
                    className="w-full bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="org/repo"
                    disabled={loading}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      From Commit
                    </label>
                    <input
                      type="text"
                      value={formData.from_commit}
                      onChange={(e) => setFormData({ ...formData, from_commit: e.target.value })}
                      className="w-full bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="abc123 or v1.0.0"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      To Commit
                    </label>
                    <input
                      type="text"
                      value={formData.to_commit}
                      onChange={(e) => setFormData({ ...formData, to_commit: e.target.value })}
                      className="w-full bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="HEAD or v2.0.0"
                      disabled={loading}
                    />
                  </div>
                </div>
              </>
            )}

            {formData.doc_type === 'postmortem' && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Incident ID
                </label>
                <input
                  type="text"
                  value={formData.incident_id}
                  onChange={(e) => setFormData({ ...formData, incident_id: e.target.value })}
                  className="w-full bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="INC-12345"
                  disabled={loading}
                />
              </div>
            )}

            <div className="bg-gray-700/50 rounded p-4">
              <h3 className="text-sm font-medium mb-2">What will be generated:</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                {formData.doc_type === 'release_notes' && (
                  <>
                    <li>• New features and improvements</li>
                    <li>• Bug fixes</li>
                    <li>• Breaking changes</li>
                    <li>• Upgrade instructions</li>
                  </>
                )}
                {formData.doc_type === 'postmortem' && (
                  <>
                    <li>• Incident timeline</li>
                    <li>• Root cause analysis</li>
                    <li>• Impact assessment</li>
                    <li>• Lessons learned</li>
                    <li>• Action items</li>
                  </>
                )}
                {formData.doc_type === 'changelog' && (
                  <>
                    <li>• Added features</li>
                    <li>• Changed functionality</li>
                    <li>• Deprecated features</li>
                    <li>• Removed features</li>
                    <li>• Bug fixes</li>
                    <li>• Security updates</li>
                  </>
                )}
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded font-medium transition"
            >
              {loading ? 'Generating...' : 'Generate Documentation'}
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
                <h3 className="font-semibold">Documentation Generated</h3>
                <p className="text-sm text-green-300">AI agent has created your documentation</p>
              </div>
            </div>
          </div>

          {/* Document Header */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="text-blue-400 mr-3">
                  {getDocTypeIcon(result.data.doc_type)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{result.data.title}</h2>
                  <p className="text-gray-400 text-sm capitalize">{result.data.doc_type.replace('_', ' ')}</p>
                </div>
              </div>
              <button
                onClick={copyToClipboard}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="text-sm text-gray-400 mb-1">Generated At</div>
                <div className="font-medium">{result.data.metadata.date ? new Date(result.data.metadata.date).toLocaleString() : new Date().toLocaleString()}</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="text-sm text-gray-400 mb-1">Sections</div>
                <div className="font-medium">{Object.keys(result.data.sections || {}).length} sections</div>
              </div>
            </div>
          </div>

          {/* Document Content */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="prose prose-invert max-w-none">
              {Object.entries(result.data.sections || {}).map(([sectionName, sectionContent], index) => (
                <div key={index} className="mb-8 last:mb-0">
                  <h3 className="text-xl font-semibold mb-4 flex items-center">
                    <span className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">
                      {index + 1}
                    </span>
                    {sectionName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h3>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {sectionContent}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleReset}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-medium transition"
            >
              Generate More Documentation
            </button>
            {taskId && (
              <a
                href={`/tasks/${taskId}`}
                className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded font-medium transition inline-block"
              >
                View Full Task Details
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Made with Bob
