'use client'

import { useState } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useLocalStore } from '@/store/localStore'

const STYLE_OPTIONS = [
  'Traditional',
  'Realistic',
  'Watercolor',
  'Geometric',
  'Minimalist',
  'Blackwork',
  'Neo-Traditional',
  'Japanese',
  'Tribal',
  'Abstract',
]

export default function LocalSearch() {
  const {
    searchQuery,
    styleFilters,
    setSearchQuery,
    addStyleFilter,
    removeStyleFilter,
  } = useLocalStore()
  
  const [showStyleDropdown, setShowStyleDropdown] = useState(false)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const toggleStyleFilter = (style: string) => {
    if (styleFilters.includes(style)) {
      removeStyleFilter(style)
    } else {
      addStyleFilter(style)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search artists or shops..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Style filters */}
      <div className="relative">
        <button
          onClick={() => setShowStyleDropdown(!showStyleDropdown)}
          className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white text-left focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <span className="text-sm text-gray-700">
            {styleFilters.length === 0
              ? 'Filter by style'
              : `${styleFilters.length} style${styleFilters.length === 1 ? '' : 's'} selected`
            }
          </span>
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 20 20" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7l3-3 3 3m0 6l-3 3-3-3" />
          </svg>
        </button>

        {showStyleDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
            <div className="max-h-60 overflow-auto p-2">
              {STYLE_OPTIONS.map((style) => (
                <label
                  key={style}
                  className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={styleFilters.includes(style)}
                    onChange={() => toggleStyleFilter(style)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">{style}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Active filters */}
      {styleFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {styleFilters.map((filter) => (
            <span
              key={filter}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
            >
              {filter}
              <button
                onClick={() => removeStyleFilter(filter)}
                className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-indigo-200"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}