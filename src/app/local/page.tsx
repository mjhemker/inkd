'use client'

import { useEffect, useState } from 'react'
import { ArrowsPointingOutIcon, ArrowsPointingInIcon } from '@heroicons/react/24/outline'
import { useLocalStore } from '@/store/localStore'
import LocalSearch from '@/components/local/LocalSearch'
import ArtistMap from '@/components/local/ArtistMap'
import ArtistCarousel from '@/components/local/ArtistCarousel'

export default function LocalPage() {
  const {
    fetchArtists,
    requestLocation,
    isFullscreenMap,
    setFullscreenMap,
    loading,
  } = useLocalStore()
  
  const [locationRequested, setLocationRequested] = useState(false)

  useEffect(() => {
    fetchArtists()
  }, [fetchArtists])

  useEffect(() => {
    if (!locationRequested) {
      requestLocation().catch(() => {
        console.log('Location access denied or unavailable')
      }).finally(() => {
        setLocationRequested(true)
      })
    }
  }, [requestLocation, locationRequested])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Local Artists</h1>
        <button
          onClick={() => setFullscreenMap(!isFullscreenMap)}
          className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          {isFullscreenMap ? (
            <>
              <ArrowsPointingInIcon className="h-4 w-4" />
              <span>Exit Fullscreen</span>
            </>
          ) : (
            <>
              <ArrowsPointingOutIcon className="h-4 w-4" />
              <span>Fullscreen Map</span>
            </>
          )}
        </button>
      </div>

      <LocalSearch />

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className={`transition-all duration-300 ${
          isFullscreenMap 
            ? 'fixed inset-0 z-40 bg-white p-4'
            : 'relative'
        }`}>
          {isFullscreenMap && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Map View</h2>
              <button
                onClick={() => setFullscreenMap(false)}
                className="p-2 text-gray-500 hover:text-gray-700"
              >
                <ArrowsPointingInIcon className="h-6 w-6" />
              </button>
            </div>
          )}
          
          <div className={`grid gap-4 ${
            isFullscreenMap 
              ? 'h-full'
              : 'grid-cols-1 lg:grid-cols-3 h-[600px]'
          }`}>
            {/* Map section */}
            <div className={`${
              isFullscreenMap 
                ? 'h-full'
                : 'lg:col-span-2 h-full'
            } rounded-lg overflow-hidden border border-gray-200`}>
              <ArtistMap />
            </div>

            {/* Artist cards section */}
            {!isFullscreenMap && (
              <div className="h-full">
                <ArtistCarousel />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}