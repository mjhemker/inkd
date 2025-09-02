'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePostsStore } from '@/store/postsStore'

export default function DailyHighlights() {
  const { dailyHighlights, fetchDailyHighlights } = usePostsStore()

  useEffect(() => {
    fetchDailyHighlights()
  }, [fetchDailyHighlights])

  if (!dailyHighlights) return null

  const { artworkOfTheDay, artistOfTheDay, suggestions } = dailyHighlights

  return (
    <div className="space-y-6 mb-8">
      {/* Daily Suggestions Rail */}
      {suggestions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Suggestions</h2>
          <div className="flex space-x-4 overflow-x-auto pb-2">
            {suggestions.map((post) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="flex-shrink-0 w-32 group"
              >
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-200">
                  <img
                    src={post.image_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1 truncate">
                  @{post.user?.handle || 'unknown'}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Artwork of the Day */}
        {artworkOfTheDay && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-4">
              <h3 className="text-sm font-medium text-indigo-600 mb-2">Artwork of the Day</h3>
              <Link href={`/post/${artworkOfTheDay.id}`} className="group">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-200 mb-3">
                  <img
                    src={artworkOfTheDay.image_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <img
                    src={artworkOfTheDay.user?.profile_img || '/default-avatar.svg'}
                    alt=""
                    className="w-6 h-6 rounded-full bg-gray-200"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    @{artworkOfTheDay.user?.handle || 'unknown'}
                  </span>
                </div>
                {artworkOfTheDay.description && (
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                    {artworkOfTheDay.description}
                  </p>
                )}
              </Link>
            </div>
          </div>
        )}

        {/* Artist of the Day */}
        {artistOfTheDay && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-4">
              <h3 className="text-sm font-medium text-indigo-600 mb-2">Artist of the Day</h3>
              <Link href={`/profile/${artistOfTheDay.id}`} className="group">
                <div className="flex items-center space-x-4">
                  <img
                    src={artistOfTheDay.profile_img || '/default-avatar.svg'}
                    alt=""
                    className="w-16 h-16 rounded-full bg-gray-200"
                  />
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-gray-900">
                      {artistOfTheDay.name || artistOfTheDay.handle}
                    </h4>
                    <p className="text-sm text-gray-600">@{artistOfTheDay.handle}</p>
                    {artistOfTheDay.styles && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {artistOfTheDay.styles.slice(0, 3).map((style: string) => (
                          <span
                            key={style}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                          >
                            {style}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {artistOfTheDay.bio && (
                  <p className="text-sm text-gray-600 mt-3 line-clamp-2">
                    {artistOfTheDay.bio}
                  </p>
                )}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}