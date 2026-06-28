'use client'

import Image from 'next/image'
import { X } from 'lucide-react'

type CustomerReservationMediaModalProps = {
  mediaUrl: string | null
  onClose: () => void
}

export default function CustomerReservationMediaModal({
  mediaUrl,
  onClose,
}: CustomerReservationMediaModalProps) {
  if (!mediaUrl) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="relative max-w-4xl max-h-full">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        <Image
          src={mediaUrl}
          alt="Enlarged Media"
          width={800}
          height={600}
          className="max-w-full max-h-full object-contain rounded-lg"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
          }}
        />
      </div>
    </div>
  )
}
