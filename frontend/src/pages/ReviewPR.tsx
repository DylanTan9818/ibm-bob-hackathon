import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ReviewPR() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    pr_url: '',
    repository: '',
    pr_number: 0,
    title: '',
    description: '',
    files_changed: [] as string[],
    diff: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await axios.post(`${API_URL}/api/v1/prs/review`, formData)
      const { task_id } = response.data
      navigate(`/tasks/${task_id}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit PR for review')
    } finally {
      setLoading(false)
    }
  }

  const handleFilesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const files = e.target.value.split('\n').filter(f => f.trim())
    setFormData({ ...formData, files_changed: files })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Review Pull Request</h1>
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
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded font-medium transition"
          >
            {loading ? 'Submitting...' : 'Submit for Review'}
          </button>
        </form>
      </div>
    </div>
  )
}

// Made with Bob
