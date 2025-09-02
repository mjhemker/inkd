'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useProfileStore } from '@/store/profileStore'

interface ProfileTabsProps {
  userId: string
}

export default function ProfileTabs({ userId }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'posts' | 'portfolio'>('info')
  const {
    profile,
    posts,
    portfolio,
    postsLoading,
    portfolioLoading,
    fetchUserPosts,
    fetchUserPortfolio,
  } = useProfileStore()

  useEffect(() => {
    if (activeTab === 'posts') {
      fetchUserPosts(userId)
    } else if (activeTab === 'portfolio') {
      fetchUserPortfolio(userId)
    }
  }, [activeTab, userId, fetchUserPosts, fetchUserPortfolio])

  const tabs = [
    { id: 'info', name: 'Info' },
    { id: 'posts', name: 'Posts' },
    { id: 'portfolio', name: 'Portfolio' },
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'info':
        return (
          <div className="prose max-w-none">
            {profile?.bio ? (
              <p className="text-gray-700">{profile.bio}</p>
            ) : (
              <p className="text-gray-500 italic">No bio available</p>
            )}
            
            {profile?.locations && profile.locations.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Locations</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.locations.map((location) => (
                    <span
                      key={location}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {location}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile?.styles && profile.styles.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Specialties</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.styles.map((style) => (
                    <span
                      key={style}
                      className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm"
                    >
                      {style}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )

      case 'posts':
        return (
          <div>
            {postsLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : posts.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/post/${post.id}`}
                    className="aspect-square bg-gray-200 rounded-lg overflow-hidden group"
                  >
                    <img
                      src={post.image_url}
                      alt={post.description || ''}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No posts yet</p>
              </div>
            )}
          </div>
        )

      case 'portfolio':
        if (!profile?.is_artist) {
          return (
            <div className="text-center py-12">
              <p className="text-gray-500">Only artists have portfolios</p>
            </div>
          )
        }

        const portfolioByCategory = portfolio.reduce((acc, item) => {
          if (!acc[item.category]) {
            acc[item.category] = []
          }
          acc[item.category].push(item)
          return acc
        }, {} as Record<string, typeof portfolio>)

        return (
          <div className="space-y-8">
            {portfolioLoading ? (
              <div className="space-y-6">
                {['Tattoos', 'Flashes', 'Designs'].map((category) => (
                  <div key={category}>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">{category}</h3>
                    <div className="flex space-x-4 overflow-x-auto">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex-shrink-0 w-48 h-48 bg-gray-200 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              Object.entries(portfolioByCategory).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 capitalize">
                    {category}s
                  </h3>
                  {items.length > 0 ? (
                    <div className="flex space-x-4 overflow-x-auto pb-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex-shrink-0 w-48 h-48 bg-gray-200 rounded-lg overflow-hidden group cursor-pointer"
                        >
                          <img
                            src={item.image_url}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No {category}s yet</p>
                  )}
                </div>
              ))
            )}
            
            {!portfolioLoading && Object.keys(portfolioByCategory).length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No portfolio items yet</p>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {renderContent()}
      </div>
    </div>
  )
}