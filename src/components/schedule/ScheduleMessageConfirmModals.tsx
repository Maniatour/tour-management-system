'use client'

import { X } from 'lucide-react'
import type {
  ScheduleConfirmModalContent,
  ScheduleMessageModalType,
} from '@/hooks/useScheduleViewDialogs'

type ScheduleMessageConfirmModalsProps = {
  showMessageModal: boolean
  messageModalContent: { title: string; message: string; type: ScheduleMessageModalType }
  onCloseMessage: () => void
  showConfirmModal: boolean
  confirmModalContent: ScheduleConfirmModalContent
  onCloseConfirm: () => void
  onConfirm: () => void
}

export default function ScheduleMessageConfirmModals({
  showMessageModal,
  messageModalContent,
  onCloseMessage,
  showConfirmModal,
  confirmModalContent,
  onCloseConfirm,
  onConfirm,
}: ScheduleMessageConfirmModalsProps) {
  return (
    <>
      {showMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    messageModalContent.type === 'success'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-red-100 text-red-600'
                  }`}
                >
                  {messageModalContent.type === 'success' ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <h3
                  className={`text-lg font-semibold ${
                    messageModalContent.type === 'success' ? 'text-green-900' : 'text-red-900'
                  }`}
                >
                  {messageModalContent.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onCloseMessage}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p
              className={`text-sm ${
                messageModalContent.type === 'success' ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {messageModalContent.message}
            </p>

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={onCloseMessage}
                className={`px-4 py-2 rounded-lg text-white transition-colors ${
                  messageModalContent.type === 'success'
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1200]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-yellow-100 text-yellow-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-yellow-900">{confirmModalContent.title}</h3>
              </div>
              <button
                type="button"
                onClick={onCloseConfirm}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-sm text-yellow-700 mb-6">{confirmModalContent.message}</p>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onCloseConfirm}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${confirmModalContent.buttonColor}`}
              >
                {confirmModalContent.buttonText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
