import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Task {
  id: string
  task_type: string
  title: string
  status: string
  created_at: string
}

export default function Dashboard() {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await axios.get<Task[]>(`${API_URL}/api/v1/tasks`)
      return response.data
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'failed':
        return 'bg-red-500'
      case 'in_progress':
        return 'bg-blue-500'
      case 'awaiting_approval':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">DevOps Autopilot Dashboard</h1>
        <p className="text-gray-400">
          Monitor and manage your automated DevOps tasks
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link
          to="/triage"
          className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition"
        >
          <h3 className="text-lg font-semibold mb-2">🚨 Triage Incident</h3>
          <p className="text-sm text-gray-400">
            Classify and route incidents automatically
          </p>
        </Link>
        <Link
          to="/runbook"
          className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition"
        >
          <h3 className="text-lg font-semibold mb-2">📖 Generate Runbook</h3>
          <p className="text-sm text-gray-400">
            Create resolution procedures from history
          </p>
        </Link>
        <Link
          to="/pr-review"
          className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition"
        >
          <h3 className="text-lg font-semibold mb-2">🔍 Review PR</h3>
          <p className="text-sm text-gray-400">
            Automated code review and policy checks
          </p>
        </Link>
        <Link
          to="/docs"
          className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition"
        >
          <h3 className="text-lg font-semibold mb-2">📝 Generate Docs</h3>
          <p className="text-sm text-gray-400">
            Auto-generate release notes and changelogs
          </p>
        </Link>
      </div>

      {/* Recent Tasks */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Tasks</h2>
        {isLoading ? (
          <p className="text-gray-400">Loading tasks...</p>
        ) : tasks && tasks.length > 0 ? (
          <div className="space-y-3">
            {tasks.map((task) => (
              <Link
                key={task.id}
                to={`/tasks/${task.id}`}
                className="block bg-gray-700 p-4 rounded hover:bg-gray-600 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2 h-2 rounded-full ${getStatusColor(
                          task.status
                        )}`}
                      ></span>
                      <span className="font-medium">{task.title}</span>
                      <span className="text-xs text-gray-400 uppercase">
                        {task.task_type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      {new Date(task.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400 capitalize">
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">No tasks yet. Create your first task!</p>
        )}
      </div>
    </div>
  )
}

// Made with Bob
