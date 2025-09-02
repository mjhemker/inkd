'use client'

import { useEffect, useState } from 'react'
import { ChartBarIcon, CalendarIcon, MapPinIcon, LinkIcon } from '@heroicons/react/24/outline'
import { useAssistantStore } from '@/store/assistantStore'
import { useAuthStore } from '@/store/authStore'

export default function MarketResearch() {
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { user } = useAuthStore()
  const { reports, fetchReports, requestMarketResearch } = useAssistantStore()

  useEffect(() => {
    if (user?.id) {
      fetchReports(user.id)
    }
  }, [user, fetchReports])

  const handleSubmitResearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || !user?.id || loading) return

    setLoading(true)
    try {
      await requestMarketResearch(query, user.id, region || undefined, timeStart || undefined, timeEnd || undefined)
      setQuery('')
      setRegion('')
      setTimeStart('')
      setTimeEnd('')
    } catch (error) {
      console.error('Error requesting research:', error)
    } finally {
      setLoading(false)
    }
  }

  const getConfidenceColor = (confidence: string | null) => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'low': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50'
      case 'processing': return 'text-blue-600 bg-blue-50'
      case 'failed': return 'text-red-600 bg-red-50'
      default: return 'text-yellow-600 bg-yellow-50'
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <ChartBarIcon className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-medium text-gray-900">Market Research</h2>
        </div>

        <form onSubmit={handleSubmitResearch} className="space-y-4">
          <div>
            <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
              Research Question
            </label>
            <input
              type="text"
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What were the most popular tattoo styles in California last year?"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-2">
                <MapPinIcon className="inline h-4 w-4 mr-1" />
                Region (optional)
              </label>
              <input
                type="text"
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="California, USA"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="timeStart" className="block text-sm font-medium text-gray-700 mb-2">
                <CalendarIcon className="inline h-4 w-4 mr-1" />
                Start Date (optional)
              </label>
              <input
                type="date"
                id="timeStart"
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="timeEnd" className="block text-sm font-medium text-gray-700 mb-2">
                End Date (optional)
              </label>
              <input
                type="date"
                id="timeEnd"
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Requesting Research...' : 'Request Research'}
          </button>
        </form>
      </div>

      {/* Research Reports */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Research Reports</h3>
        
        {reports.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-300" />
            <p className="text-gray-500 mt-2">No research reports yet</p>
            <p className="text-sm text-gray-400">Submit a research question to get started</p>
          </div>
        ) : (
          reports.map((report) => (
            <div key={report.id} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <h4 className="font-medium text-gray-900">{report.query}</h4>
                <div className="flex space-x-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(report.status)}`}>
                    {report.status}
                  </span>
                  {report.confidence && (
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getConfidenceColor(report.confidence)}`}>
                      {report.confidence} confidence
                    </span>
                  )}
                </div>
              </div>

              {report.region && (
                <p className="text-sm text-gray-600 mb-2">
                  <MapPinIcon className="inline h-4 w-4 mr-1" />
                  {report.region}
                </p>
              )}

              {(report.time_start || report.time_end) && (
                <p className="text-sm text-gray-600 mb-2">
                  <CalendarIcon className="inline h-4 w-4 mr-1" />
                  {report.time_start && new Date(report.time_start).toLocaleDateString()}
                  {report.time_start && report.time_end && ' - '}
                  {report.time_end && new Date(report.time_end).toLocaleDateString()}
                </p>
              )}

              {report.summary && (
                <div className="mt-4">
                  <h5 className="font-medium text-gray-900 mb-2">Summary</h5>
                  <p className="text-sm text-gray-700">{report.summary}</p>
                </div>
              )}

              {report.methodology && (
                <div className="mt-4">
                  <h5 className="font-medium text-gray-900 mb-2">Methodology</h5>
                  <p className="text-sm text-gray-700">{report.methodology}</p>
                </div>
              )}

              {report.sources && Array.isArray(report.sources) && report.sources.length > 0 && (
                <div className="mt-4">
                  <h5 className="font-medium text-gray-900 mb-2">Sources</h5>
                  <div className="space-y-1">
                    {report.sources.map((source: any, index: number) => (
                      <a
                        key={index}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-sm text-indigo-600 hover:text-indigo-500"
                      >
                        <LinkIcon className="h-3 w-3" />
                        <span>{source.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500 mt-4">
                Generated on {new Date(report.created_at).toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}