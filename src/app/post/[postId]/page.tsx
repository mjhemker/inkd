'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, HeartIcon, ChatBubbleOvalLeftIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'

interface Post {
  id: string
  user_id: string
  image_url: string
  description: string | null
  location: string | null
  tags: string[] | null
  created_at: string
  user?: {
    name: string | null
    handle: string | null
    profile_img: string | null
  }
}

export default function PostDetailPage() {
  const params = useParams()
  const postId = params.postId as string
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select(`
            *,
            user:users(name, handle, profile_img)
          `)
          .eq('id', postId)
          .single()

        if (error) throw error
        setPost(data)
      } catch (error) {
        console.error('Error fetching post:', error)
      } finally {
        setLoading(false)
      }
    }

    if (postId) {
      fetchPost()
    }
  }, [postId])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="h-6 bg-gray-200 rounded animate-pulse w-24" />
        <div className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3" />
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">Post not found</h1>
        <p className="text-gray-600 mt-2">This post may have been deleted or is private.</p>
        <Link href="/" className="text-indigo-600 hover:text-indigo-500 mt-4 inline-block">
          ← Back to Home
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <Link
        href="/"
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        <span>Back to feed</span>
      </Link>

      {/* Post image */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <img
          src={post.image_url}
          alt={post.description || ''}
          className="w-full aspect-square object-cover"
        />
        
        {/* Post actions */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button className="flex items-center space-x-1 text-gray-600 hover:text-red-600 transition-colors">
                <HeartIcon className="h-5 w-5" />
                <span className="text-sm">Like</span>
              </button>
              <button className="flex items-center space-x-1 text-gray-600 hover:text-indigo-600 transition-colors">
                <ChatBubbleOvalLeftIcon className="h-5 w-5" />
                <span className="text-sm">Comment</span>
              </button>
            </div>
            <button className="p-1 text-gray-600 hover:text-gray-900">
              <EllipsisHorizontalIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Post details */}
        <div className="p-4">
          {/* User info */}
          <div className="flex items-center space-x-3 mb-4">
            <Link href={`/profile/${post.user_id}`} className="flex items-center space-x-3 hover:opacity-80">
              <img
                src={post.user?.profile_img || '/default-avatar.svg'}
                alt=""
                className="w-10 h-10 rounded-full bg-gray-200"
              />
              <div>
                <p className="font-medium text-gray-900">
                  {post.user?.name || post.user?.handle || 'Unknown User'}
                </p>
                <p className="text-sm text-gray-600">@{post.user?.handle || 'unknown'}</p>
              </div>
            </Link>
          </div>

          {/* Description */}
          {post.description && (
            <p className="text-gray-700 mb-4">{post.description}</p>
          )}

          {/* Location */}
          {post.location && (
            <p className="text-sm text-gray-600 mb-4">📍 {post.location}</p>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Timestamp */}
          <p className="text-xs text-gray-500">
            {new Date(post.created_at).toLocaleDateString()} at{' '}
            {new Date(post.created_at).toLocaleTimeString()}
          </p>
        </div>

        {/* Comments section (placeholder) */}
        <div className="p-4 bg-gray-50">
          <h3 className="font-medium text-gray-900 mb-3">Comments</h3>
          <div className="text-center py-8 text-gray-500">
            <p>Comments coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  )
}