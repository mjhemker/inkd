'use client'

import { useState } from 'react'
import { Dialog } from '@headlessui/react'
import { XMarkIcon, PhotoIcon, SwatchIcon, CubeIcon } from '@heroicons/react/24/outline'
import PostCreateForm from './PostCreateForm'
import DesignCreateForm from './DesignCreateForm'
import ARTesterStub from './ARTesterStub'

interface CreateModalProps {
  isOpen: boolean
  onClose: () => void
}

type CreateMode = 'select' | 'post' | 'design' | 'ar'

export default function CreateModal({ isOpen, onClose }: CreateModalProps) {
  const [mode, setMode] = useState<CreateMode>('select')

  const handleClose = () => {
    setMode('select')
    onClose()
  }

  const renderContent = () => {
    switch (mode) {
      case 'post':
        return <PostCreateForm onSuccess={handleClose} onCancel={() => setMode('select')} />
      case 'design':
        return <DesignCreateForm onSuccess={handleClose} onCancel={() => setMode('select')} />
      case 'ar':
        return <ARTesterStub onClose={() => setMode('select')} />
      default:
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">What would you like to create?</h2>
            
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setMode('post')}
                className="flex items-center space-x-3 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <PhotoIcon className="h-8 w-8 text-indigo-600" />
                <div className="text-left">
                  <h3 className="font-medium text-gray-900">Post</h3>
                  <p className="text-sm text-gray-600">Share your latest tattoo or inspiration</p>
                </div>
              </button>

              <button
                onClick={() => setMode('design')}
                className="flex items-center space-x-3 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <SwatchIcon className="h-8 w-8 text-indigo-600" />
                <div className="text-left">
                  <h3 className="font-medium text-gray-900">Design</h3>
                  <p className="text-sm text-gray-600">Add artwork to your portfolio</p>
                </div>
              </button>

              <button
                onClick={() => setMode('ar')}
                className="flex items-center space-x-3 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <CubeIcon className="h-8 w-8 text-indigo-600" />
                <div className="text-left">
                  <h3 className="font-medium text-gray-900">AR Tester</h3>
                  <p className="text-sm text-gray-600">Preview tattoos with augmented reality</p>
                </div>
              </button>
            </div>
          </div>
        )
    }
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <Dialog.Title className="text-lg font-medium">
              {mode === 'select' && 'Create'}
              {mode === 'post' && 'New Post'}
              {mode === 'design' && 'Add Design'}
              {mode === 'ar' && 'AR Tester'}
            </Dialog.Title>
            <button
              onClick={handleClose}
              className="rounded-md p-1 hover:bg-gray-100"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {renderContent()}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}