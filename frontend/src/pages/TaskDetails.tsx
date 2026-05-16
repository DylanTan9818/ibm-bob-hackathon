import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import mermaid from 'mermaid'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#3b82f6',
    primaryTextColor: '#fff',
    primaryBorderColor: '#1e40af',
    lineColor: '#60a5fa',
    secondaryColor: '#10b981',
    tertiaryColor: '#8b5cf6',
  }
})

interface Task {
  id: string
  task_type: string
  title: string
  description: string
  status: string
  created_at: string
  updated_at: string
  assigned_agent: string | null
  result: any
  error: string | null
  requires_approval: boolean
  approved_by: string | null
  approved_at: string | null
}

export default function TaskDetails() {
  const { taskId } = useParams<{ taskId: string }>()
  const [approving, setApproving] = useState(false)
  const [approvalError, setApprovalError] = useState('')
  const mermaidRef = useRef<HTMLDivElement>(null)

  const { data: task, isLoading, refetch } = useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const response = await axios.get<Task>(`${API_URL}/api/v1/tasks/${taskId}`)
      return response.data
    },
    refetchInterval: (data) => {
      // Stop refetching if task is completed, failed, or rejected
      if (data?.status && ['completed', 'failed', 'rejected'].includes(data.status)) {
        return false
      }
      return 3000 // Refetch every 3 seconds
    },
  })

  // Render Mermaid diagram when task result contains mermaid_diagram
  useEffect(() => {
    if (task?.result?.data?.mermaid_diagram && mermaidRef.current) {
      const renderDiagram = async () => {
        try {
          mermaidRef.current!.innerHTML = ''
          const { svg } = await mermaid.render('task-mermaid-diagram', task.result.data.mermaid_diagram)
          mermaidRef.current!.innerHTML = svg
        } catch (error) {
          console.error('Error rendering Mermaid diagram:', error)
          mermaidRef.current!.innerHTML = '<p class="text-red-400">Error rendering diagram</p>'
        }
      }
      renderDiagram()
    }
  }, [task?.result?.data?.mermaid_diagram])

  const handleApproval = async (approved: boolean) => {
    setApproving(true)
    setApprovalError('')

    try {
      await axios.post(`${API_URL}/api/v1/tasks/${taskId}/approve`, {
        approved,
        approved_by: 'user@example.com',
        comment: approved ? 'Approved' : 'Rejected'
      })
      refetch()
    } catch (err: any) {
      setApprovalError(err.response?.data?.detail || 'Failed to process approval')
    } finally {
      setApproving(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-500 bg-green-500/10'
      case 'failed':
        return 'text-red-500 bg-red-500/10'
      case 'in_progress':
        return 'text-blue-500 bg-blue-500/10'
      case 'awaiting_approval':
        return 'text-yellow-500 bg-yellow-500/10'
      case 'approved':
        return 'text-green-500 bg-green-500/10'
      case 'rejected':
        return 'text-red-500 bg-red-500/10'
      default:
        return 'text-gray-500 bg-gray-500/10'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-500'
      case 'HIGH': return 'bg-orange-500'
      case 'MEDIUM': return 'bg-yellow-500'
      case 'LOW': return 'bg-blue-500'
      case 'INFO': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const renderTriageResult = (result: any) => {
    const data = result?.data
    if (!data) return null

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Severity</div>
            <span className={`${getSeverityColor(data.severity)} px-3 py-1 rounded-full text-sm font-semibold inline-block`}>
              {data.severity}
            </span>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Category</div>
            <div className="font-medium capitalize">{data.category}</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Assigned Team</div>
            <div className="font-medium">{data.assigned_team}</div>
          </div>
        </div>

        {data.confidence && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Confidence</span>
              <span className="font-medium">{(data.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${data.confidence * 100}%` }} />
            </div>
          </div>
        )}

        {data.initial_steps && data.initial_steps.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Initial Steps</h3>
            <ol className="space-y-2">
              {data.initial_steps.map((step: string, index: number) => (
                <li key={index} className="flex items-start">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mr-3 mt-0.5 flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-gray-300">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {data.reasoning && (
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="font-semibold mb-2">AI Reasoning</h3>
            <p className="text-gray-300 text-sm">{data.reasoning}</p>
          </div>
        )}
      </div>
    )
  }

  const renderRunbookResult = (result: any) => {
    const data = result?.data
    if (!data) return null

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Estimated Time</div>
            <div className="font-medium">{data.estimated_time}</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Steps</div>
            <div className="font-medium">{data.steps?.length || 0} steps</div>
          </div>
        </div>

        {data.prerequisites && data.prerequisites.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Prerequisites</h3>
            <ul className="space-y-2">
              {data.prerequisites.map((prereq: string, index: number) => (
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

        {data.steps && data.steps.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Resolution Steps</h3>
            <div className="space-y-3">
              {data.steps.map((step: any, index: number) => (
                <div key={index} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-start">
                    <span className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-2">{step.step}</h4>
                      <p className="text-gray-300 text-sm mb-2">{step.description}</p>
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
        )}
      </div>
    )
  }

  const renderPRReviewResult = (result: any) => {
    const data = result?.data
    if (!data) return null

    return (
      <div className="space-y-4">
        <div className={`${data.approved ? 'bg-green-500/10 border-green-500' : 'bg-red-500/10 border-red-500'} border rounded-lg p-4`}>
          <div className="flex items-center">
            {data.approved ? (
              <svg className="w-6 h-6 mr-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 mr-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div>
              <h3 className={`font-semibold ${data.approved ? 'text-green-400' : 'text-red-400'}`}>
                {data.approved ? 'PR Approved' : 'PR Requires Changes'}
              </h3>
              <p className="text-sm text-gray-300">{data.summary}</p>
            </div>
          </div>
        </div>

        {data.code_quality_score !== undefined && (
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Code Quality Score</h3>
            <div className="flex items-center">
              <div className={`text-4xl font-bold mr-4 ${data.code_quality_score >= 80 ? 'text-green-400' : data.code_quality_score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {data.code_quality_score}
              </div>
              <div className="flex-1">
                <div className="w-full bg-gray-600 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full ${data.code_quality_score >= 80 ? 'bg-green-500' : data.code_quality_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${data.code_quality_score}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {data.security_issues && data.security_issues.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 text-red-400">Security Issues ({data.security_issues.length})</h3>
            <div className="space-y-2">
              {data.security_issues.map((issue: any, index: number) => (
                <div key={index} className="bg-gray-700 rounded-lg p-4 border-l-4 border-red-500">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center">
                      <span className={`${getSeverityColor(issue.severity)} px-2 py-1 rounded text-xs font-semibold mr-2`}>
                        {issue.severity?.toUpperCase()}
                      </span>
                      <span className="font-semibold">{issue.type}</span>
                    </div>
                    <span className="text-sm text-gray-400">{issue.file}</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">{issue.description}</p>
                  {issue.recommendation && (
                    <div className="bg-gray-800 rounded p-3 mt-2">
                      <p className="text-sm text-green-400">💡 {issue.recommendation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {data.policy_violations && data.policy_violations.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 text-yellow-400">Policy Violations ({data.policy_violations.length})</h3>
            <div className="space-y-2">
              {data.policy_violations.map((violation: any, index: number) => (
                <div key={index} className="bg-gray-700 rounded-lg p-4 border-l-4 border-yellow-500">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-semibold">{violation.rule}</span>
                    <span className="text-sm text-gray-400">{violation.file}</span>
                  </div>
                  <p className="text-gray-300 text-sm">{violation.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.recommendations && data.recommendations.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Recommendations</h3>
            <ul className="space-y-2">
              {data.recommendations.map((rec: string, index: number) => (
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
      </div>
    )
  }

  const renderDocResult = (result: any) => {
    const data = result?.data
    if (!data) return null

    return (
      <div className="space-y-4">
        <div className="bg-gray-700 rounded-lg p-4">
          <h2 className="text-2xl font-bold mb-2">{data.title}</h2>
          <p className="text-gray-400 capitalize">{data.doc_type?.replace('_', ' ')}</p>
        </div>

        {data.mermaid_diagram && (
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Architecture Diagram</h3>
            <div className="bg-white rounded-lg p-6 overflow-x-auto">
              <div ref={mermaidRef} className="flex justify-center"></div>
            </div>
          </div>
        )}

        {data.sections && Object.keys(data.sections).length > 0 && (
          <div className="space-y-4">
            {Object.entries(data.sections).map(([sectionName, sectionContent]: [string, any], index: number) => (
              <div key={index} className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <span className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">
                    {index + 1}
                  </span>
                  {sectionName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h3>
                <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {sectionContent}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderResult = () => {
    if (!task?.result) return null

    switch (task.task_type) {
      case 'triage':
        return renderTriageResult(task.result)
      case 'runbook':
        return renderRunbookResult(task.result)
      case 'pr_review':
        return renderPRReviewResult(task.result)
      case 'documentation':
        return renderDocResult(task.result)
      default:
        return (
          <pre className="bg-gray-900 rounded p-4 overflow-x-auto text-sm">
            {JSON.stringify(task.result, null, 2)}
          </pre>
        )
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-400">Loading task details...</p>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Task not found</p>
        <Link to="/" className="text-blue-500 hover:underline mt-4 inline-block">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link to="/" className="text-blue-500 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">{task.title}</h1>
            <p className="text-gray-400">{task.description}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(task.status)}`}>
            {task.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Task ID:</span>
            <span className="ml-2 font-mono">{task.id}</span>
          </div>
          <div>
            <span className="text-gray-400">Type:</span>
            <span className="ml-2 capitalize">{task.task_type}</span>
          </div>
          <div>
            <span className="text-gray-400">Created:</span>
            <span className="ml-2">{new Date(task.created_at).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-400">Updated:</span>
            <span className="ml-2">{new Date(task.updated_at).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Approval Section */}
      {task.status === 'awaiting_approval' && (
        <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">⚠️ Approval Required</h2>
          <p className="text-gray-400 mb-4">
            This task requires human approval before proceeding. Please review the results below.
          </p>
          
          {approvalError && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded mb-4">
              {approvalError}
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => handleApproval(true)}
              disabled={approving}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-2 rounded font-medium transition"
            >
              {approving ? 'Processing...' : '✓ Approve'}
            </button>
            <button
              onClick={() => handleApproval(false)}
              disabled={approving}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-6 py-2 rounded font-medium transition"
            >
              {approving ? 'Processing...' : '✗ Reject'}
            </button>
          </div>
        </div>
      )}

      {/* Error Section */}
      {task.error && (
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2 text-red-500">Error</h2>
          <pre className="text-sm text-red-400 whitespace-pre-wrap">{task.error}</pre>
        </div>
      )}

      {/* Results Section */}
      {task.result && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Results</h2>
          {renderResult()}
        </div>
      )}

      {/* Loading State */}
      {task.status === 'in_progress' && (
        <div className="bg-blue-500/10 border border-blue-500 rounded-lg p-6">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
            <span>Task is being processed by the AI agent...</span>
          </div>
        </div>
      )}
    </div>
  )
}

// Made with Bob
