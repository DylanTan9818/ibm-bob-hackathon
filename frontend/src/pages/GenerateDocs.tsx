import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function GenerateDocs() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    doc_type: 'release_notes',
    repository: '',
    from_commit: '',
    to_commit: 'HEAD',
    incident_id: '',
    metadata: {}
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await axios.post(`${API_URL}/api/v1/docs/generate`, formData)
      const { task_id } = response.data
      navigate(`/tasks/${task_id}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate documentation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Generate Documentation</h1>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Document Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.doc_type}
              onChange={(e) => setFormData({ ...formData, doc_type: e.target.value })}
              className="w-full bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
    </div>
  )
}

// Made with Bob
