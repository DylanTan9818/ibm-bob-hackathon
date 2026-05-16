import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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
          {task.assigned_agent && (
            <div>
              <span className="text-gray-400">Agent:</span>
              <span className="ml-2">{task.assigned_agent}</span>
            </div>
          )}
          {task.approved_by && (
            <div>
              <span className="text-gray-400">Approved By:</span>
              <span className="ml-2">{task.approved_by}</span>
            </div>
          )}
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
          <pre className="bg-gray-900 rounded p-4 overflow-x-auto text-sm">
            {JSON.stringify(task.result, null, 2)}
          </pre>
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
