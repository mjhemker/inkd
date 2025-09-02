'use client'

import { useCallback, useRef } from 'react'
import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox'
import { MapPinIcon } from '@heroicons/react/24/solid'
import { useLocalStore } from '@/store/localStore'

export default function ArtistMap() {
  const mapRef = useRef<any>(null)
  const {
    artists,
    selectedArtistIndex,
    mapViewport,
    setSelectedArtistIndex,
    setMapViewport,
  } = useLocalStore()

  const onMapClick = useCallback((event: any) => {
    event.originalEvent.stopPropagation()
  }, [])

  const onMarkerClick = useCallback((artistIndex: number) => {
    setSelectedArtistIndex(artistIndex)
  }, [setSelectedArtistIndex])

  const onMove = useCallback((evt: any) => {
    setMapViewport(evt.viewState)
  }, [setMapViewport])

  return (
    <div className="w-full h-full relative">
      <Map
        ref={mapRef}
        {...mapViewport}
        onMove={onMove}
        onClick={onMapClick}
        mapStyle="mapbox://styles/mapbox/light-v11"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        className="w-full h-full"
      >
        <NavigationControl position="top-right" />
        
        {artists.map((artist, index) => (
          artist.lat && artist.lng && (
            <Marker
              key={artist.id}
              latitude={artist.lat}
              longitude={artist.lng}
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                onMarkerClick(index)
              }}
            >
              <button
                className={`relative ${
                  index === selectedArtistIndex
                    ? 'text-purple-600 scale-125'
                    : 'text-purple-500 hover:text-purple-600'
                } transition-all duration-200`}
              >
                <MapPinIcon className="h-8 w-8 drop-shadow-md" />
                {artist.profile_img && (
                  <img
                    src={artist.profile_img}
                    alt=""
                    className="absolute top-0.5 left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full object-cover"
                  />
                )}
              </button>
            </Marker>
          )
        ))}
      </Map>
    </div>
  )
}