import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import TriageIncident from './pages/TriageIncident'
import GenerateRunbook from './pages/GenerateRunbook'
import ReviewPR from './pages/ReviewPR'
import GenerateDocs from './pages/GenerateDocs'
import TaskDetails from './pages/TaskDetails'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-900 text-white">
          {/* Navigation */}
          <nav className="bg-gray-800 border-b border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center">
                  <Link to="/" className="text-xl font-bold text-blue-400">
                    DevOps Autopilot
                  </Link>
                  <div className="ml-10 flex items-baseline space-x-4">
                    <Link
                      to="/"
                      className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/triage"
                      className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                    >
                      Triage Incident
                    </Link>
                    <Link
                      to="/runbook"
                      className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                    >
                      Generate Runbook
                    </Link>
                    <Link
                      to="/pr-review"
                      className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                    >
                      Review PR
                    </Link>
                    <Link
                      to="/docs"
                      className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                    >
                      Generate Docs
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/triage" element={<TriageIncident />} />
              <Route path="/runbook" element={<GenerateRunbook />} />
              <Route path="/pr-review" element={<ReviewPR />} />
              <Route path="/docs" element={<GenerateDocs />} />
              <Route path="/tasks/:taskId" element={<TaskDetails />} />
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  )
}

export default App

// Made with Bob
