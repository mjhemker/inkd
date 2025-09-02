'use client'

import Link from 'next/link'
import { HeartIcon, ChatBubbleOvalLeftIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'

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

interface PostCardProps {
  post: Post
}

export default function PostCard({ post }: PostCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden group hover:shadow-md transition-shadow duration-200">
      <Link href={`/post/${post.id}`}>
        <div className="aspect-square relative overflow-hidden bg-gray-200">
          <img
            src={post.image_url}
            alt={post.description || ''}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
          
          {/* Overlay with actions (visible on hover) */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
          
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button className="p-1 bg-white/80 rounded-full hover:bg-white">
              <EllipsisHorizontalIcon className="h-4 w-4 text-gray-700" />
            </button>
          </div>

          <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button className="flex items-center space-x-1 px-2 py-1 bg-white/80 rounded-full text-xs font-medium text-gray-700 hover:bg-white">
                  <HeartIcon className="h-3 w-3" />
                  <span>Like</span>
                </button>
                <button className="flex items-center space-x-1 px-2 py-1 bg-white/80 rounded-full text-xs font-medium text-gray-700 hover:bg-white">
                  <ChatBubbleOvalLeftIcon className="h-3 w-3" />
                  <span>Comment</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Link>

      {/* Post info */}
      <div className="p-3">
        <div className="flex items-center space-x-2 mb-2">
          <Link href={`/profile/${post.user_id}`} className="flex items-center space-x-2 hover:opacity-80">
            <img
              src={post.user?.profile_img || '/default-avatar.svg'}
              alt=""
              className="w-6 h-6 rounded-full bg-gray-200"
            />
            <span className="text-sm font-medium text-gray-900">
              @{post.user?.handle || 'unknown'}
            </span>
          </Link>
          {post.location && (
            <span className="text-xs text-gray-500">• {post.location}</span>
          )}
        </div>

        {post.description && (
          <p className="text-sm text-gray-700 line-clamp-2 mb-2">
            {post.description}
          </p>
        )}

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full"
              >
                #{tag}
              </span>
            ))}
            {post.tags.length > 3 && (
              <span className="text-xs text-gray-500">+{post.tags.length - 3} more</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}