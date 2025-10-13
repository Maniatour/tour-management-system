import { X } from 'lucide-react'

interface BookingModalProps {
  isOpen: boolean
  title: string
  children: React.ReactNode
  onClose: () => void
}

export default function BookingModal({
  isOpen,
  title,
  children,
  onClose
}: BookingModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
