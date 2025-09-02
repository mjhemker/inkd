'use client'

import { useState, useRef, useEffect } from 'react'
import { CameraIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface ARTesterStubProps {
  onClose: () => void
}

export default function ARTesterStub({ onClose }: ARTesterStubProps) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' }
        })
        setStream(mediaStream)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      } catch (err) {
        setError('Camera access denied or unavailable')
        console.error('Error accessing camera:', err)
      }
    }

    startCamera()

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <p className="text-sm text-yellow-800">
          🚧 AR Tester is in development. This is a camera preview stub for MVP.
        </p>
      </div>

      {error ? (
        <div className="p-6 text-center">
          <CameraIcon className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <p className="text-xs text-gray-500 mt-1">
            Please allow camera access to use the AR tester
          </p>
        </div>
      ) : (
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-64 bg-gray-900 rounded-lg object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/50 text-white px-3 py-1 rounded-full text-sm">
              AR Preview (Coming Soon)
            </div>
          </div>
        </div>
      )}

      <div className="flex space-x-3">
        <button
          type="button"
          onClick={stopCamera}
          className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Close
        </button>
        <button
          type="button"
          disabled
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-400 border border-transparent rounded-md cursor-not-allowed"
        >
          Take Photo (Coming Soon)
        </button>
      </div>
    </div>
  )
}