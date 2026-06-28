'use client'

import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import PaymentProcessor from '@/components/payment/PaymentProcessor'

type ProductDetailPaymentModalProps = {
  paymentData: any
  cartItems: any[]
  onSuccess: (result: any) => void
  onError: (error: string) => void
  onClose: () => void
}

export default function ProductDetailPaymentModal({
  paymentData,
  cartItems,
  onSuccess,
  onError,
  onClose,
}: ProductDetailPaymentModalProps) {
  const t = useTranslations('productDetail')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">{t('completePayment')}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          <PaymentProcessor
            paymentData={paymentData}
            cartItems={cartItems}
            onSuccess={onSuccess}
            onError={onError}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  )
}
