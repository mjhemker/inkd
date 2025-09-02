'use client'

import { useState, useRef } from 'react'
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/store/authStore'
import { useProfileStore } from '@/store/profileStore'
import { uploadFile } from '@/lib/upload'

interface DesignCreateFormProps {
  onSuccess: () => void
  onCancel: () => void
}

const CATEGORIES = [
  { value: 'tattoo', label: 'Tattoo' },
  { value: 'flash', label: 'Flash' },
  { value: 'design', label: 'Design' },
]

export default function DesignCreateForm({ onSuccess, onCancel }: DesignCreateFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [category, setCategory] = useState('tattoo')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuthStore()
  const { addPortfolioItem } = useProfileStore()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB')
        return
      }
      
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }

      setSelectedFile(file)
      setError('')
      
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || !user) return

    setLoading(true)
    setError('')

    try {
      const imageUrl = await uploadFile(selectedFile, 'portfolio', user.id, category)
      
      await addPortfolioItem({
        user_id: user.id,
        image_url: imageUrl,
        category,
      })

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to add design')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      {/* File upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Design Image
        </label>
        {previewUrl ? (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-48 object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null)
                setPreviewUrl(null)
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              }}
              className="absolute top-2 right-2 p-1 bg-white/80 rounded-full hover:bg-white"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 cursor-pointer"
          >
            <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              Click to upload your design
            </p>
            <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Category selection */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
          Category
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!selectedFile || loading}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Adding...' : 'Add to Portfolio'}
        </button>
      </div>
    </form>
  )
}