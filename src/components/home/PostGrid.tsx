'use client'

import { useEffect } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { usePostsStore } from '@/store/postsStore'
import PostCard from './PostCard'

export default function PostGrid() {
  const { posts, loading, fetchPosts, refreshFeed } = usePostsStore()

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handleRefresh = () => {
    refreshFeed()
  }

  if (loading && posts.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-gray-200 rounded-lg aspect-square animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Explore</h2>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500">
            <p className="text-lg font-medium">No posts yet</p>
            <p className="text-sm mt-1">Be the first to share your ink!</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}