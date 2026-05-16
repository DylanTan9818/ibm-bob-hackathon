import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface PolicyViolation {
  rule: string
  severity: string
  file: string
  line?: number
  description: string
}

interface SecurityIssue {
  type: string
  severity: string
  file: string
  line?: number
  description: string
  recommendation: string
}

interface PRReviewResult {
  approved: boolean
  security_issues: SecurityIssue[]
  policy_violations: PolicyViolation[]
  code_quality_score: number
  recommendations: string[]
  summary: string
}

interface TaskResult {
  agent: string
  data: PRReviewResult
  metadata: {
    agent_description: string
    llm_provider: string
    llm_model: string
  }
}

export default function ReviewPR() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskStatus, setTaskStatus] = useState<string>('')
  const [result, setResult] = useState<TaskResult | null>(null)
  const [formData, setFormData] = useState({
    pr_url: '',
    repository: '',
    pr_number: 0,
    title: '',
    description: '',
    files_changed: [] as string[],
    diff: ''
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
      const response = await axios.post(`${API_URL}/api/v1/prs/review`, formData)
      const { task_id } = response.data
      setTaskId(task_id)
      setTaskStatus('pending')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit PR for review')
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFormData({
      pr_url: '',
      repository: '',
      pr_number: 0,
      title: '',
      description: '',
      files_changed: [],
      diff: ''
    })
    setResult(null)
    setTaskId(null)
    setTaskStatus('')
    setError('')
  }

  const handleFilesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const files = e.target.value.split('\n').filter(f => f.trim())
    setFormData({ ...formData, files_changed: files })
  }

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Review Pull Request</h1>
      
      {!result ? (
        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-gray-400 mb-6">
            Submit a pull request for automated review. The AI agent will check for security
            vulnerabilities, code quality issues, and policy compliance.
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
                  {taskStatus === 'pending' && 'Submitting PR for review...'}
                  {taskStatus === 'in_progress' && 'AI agent reviewing code...'}
                  {taskStatus === 'awaiting_approval' && 'Finalizing review...'}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                PR URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                required
                value={formData.pr_url}
                onChange={(e) => setFormData({ ...formData, pr_url: e.target.value })}
                className="w-full bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://github.com/org/repo/pull/123"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Repository <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.repository}
                  onChange={(e) => setFormData({ ...formData, repository: e.target.value })}
                  className="w-full bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="org/repo"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  PR Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={formData.pr_number || ''}
                  onChange={(e) => setFormData({ ...formData, pr_number: parseInt(e.target.value) || 0 })}
                  className="w-full bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                PR Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add new feature X"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-gray-700 rounded px-4 py-2 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description of the changes..."
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Files Changed <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                onChange={handleFilesChange}
                className="w-full bg-gray-700 rounded px-4 py-2 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="src/app.py&#10;tests/test_app.py&#10;README.md"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">One file path per line</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Diff (Optional)
              </label>
              <textarea
                value={formData.diff}
                onChange={(e) => setFormData({ ...formData, diff: e.target.value })}
                className="w-full bg-gray-700 rounded px-4 py-2 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Paste git diff output here..."
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded font-medium transition"
            >
              {loading ? 'Reviewing...' : 'Submit for Review'}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status Banner */}
          <div className={`${result.data.approved ? 'bg-green-500/10 border-green-500 text-green-400' : 'bg-red-500/10 border-red-500 text-red-400'} border px-6 py-4 rounded-lg`}>
            <div className="flex items-center">
              {result.data.approved ? (
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <div>
                <h3 className="font-semibold">{result.data.approved ? 'PR Approved' : 'PR Requires Changes'}</h3>
                <p className="text-sm">{result.data.summary}</p>
              </div>
            </div>
          </div>

          {/* PR Info */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Pull Request</h2>
            <div className="space-y-2">
              <div>
                <span className="text-gray-400">Title:</span>
                <p className="font-medium">{formData.title}</p>
              </div>
              <div>
                <span className="text-gray-400">Repository:</span>
                <p className="font-medium">{formData.repository}</p>
              </div>
              <div>
                <span className="text-gray-400">PR Number:</span>
                <p className="font-medium">#{formData.pr_number}</p>
              </div>
            </div>
          </div>

          {/* Code Quality Score */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="font-semibold mb-4 flex items-center text-lg">
              <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Code Quality Score
            </h3>
            <div className="flex items-center">
              <div className={`text-5xl font-bold ${getScoreColor(result.data.code_quality_score)} mr-4`}>
                {result.data.code_quality_score}
              </div>
              <div className="flex-1">
                <div className="w-full bg-gray-700 rounded-full h-4">
                  <div 
                    className={`h-4 rounded-full transition-all duration-500 ${result.data.code_quality_score >= 80 ? 'bg-green-500' : result.data.code_quality_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${result.data.code_quality_score}%` }}
                  />
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  {result.data.code_quality_score >= 80 && 'Excellent code quality'}
                  {result.data.code_quality_score >= 60 && result.data.code_quality_score < 80 && 'Good code quality with room for improvement'}
                  {result.data.code_quality_score < 60 && 'Needs improvement'}
                </p>
              </div>
            </div>
          </div>

          {/* Security Issues */}
          {result.data.security_issues && result.data.security_issues.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-4 flex items-center text-lg">
                <svg className="w-6 h-6 mr-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Security Issues ({result.data.security_issues.length})
              </h3>
              <div className="space-y-3">
                {result.data.security_issues.map((issue, index) => (
                  <div key={index} className="bg-gray-700 rounded-lg p-4 border-l-4 border-red-500">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center">
                        <span className={`${getSeverityColor(issue.severity)} px-2 py-1 rounded text-xs font-semibold mr-2`}>
                          {issue.severity.toUpperCase()}
                        </span>
                        <span className="font-semibold">{issue.type}</span>
                      </div>
                      <span className="text-sm text-gray-400">{issue.file}{issue.line && `:${issue.line}`}</span>
                    </div>
                    <p className="text-gray-300 mb-2">{issue.description}</p>
                    <div className="bg-gray-800 rounded p-3 mt-2">
                      <p className="text-sm text-green-400">💡 {issue.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Policy Violations */}
          {result.data.policy_violations && result.data.policy_violations.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-4 flex items-center text-lg">
                <svg className="w-6 h-6 mr-2 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Policy Violations ({result.data.policy_violations.length})
              </h3>
              <div className="space-y-3">
                {result.data.policy_violations.map((violation, index) => (
                  <div key={index} className="bg-gray-700 rounded-lg p-4 border-l-4 border-yellow-500">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center">
                        <span className={`${getSeverityColor(violation.severity)} px-2 py-1 rounded text-xs font-semibold mr-2`}>
                          {violation.severity.toUpperCase()}
                        </span>
                        <span className="font-semibold">{violation.rule}</span>
                      </div>
                      <span className="text-sm text-gray-400">{violation.file}{violation.line && `:${violation.line}`}</span>
                    </div>
                    <p className="text-gray-300">{violation.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.data.recommendations && result.data.recommendations.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-4 flex items-center text-lg">
                <svg className="w-6 h-6 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Recommendations
              </h3>
              <ul className="space-y-2">
                {result.data.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start">
                    <svg className="w-5 h-5 mr-2 text-purple-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className="text-gray-300">{rec}</span>
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
              Review Another PR
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
