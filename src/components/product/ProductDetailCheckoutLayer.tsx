'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import BookingFlow from '@/components/booking/BookingFlow'
import { CartSidebar } from '@/components/cart/CartProvider'
import CartCheckout from '@/components/cart/CartCheckout'
import ProductDetailChoiceDescriptionModal, {
  type ProductChoiceGroup,
} from '@/components/product/ProductDetailChoiceDescriptionModal'
import ProductDetailPaymentModal from '@/components/product/ProductDetailPaymentModal'
import type { Product, ProductChoice } from '@/components/product/productDetailTypes'
import type { TravelerCounts } from '@/lib/productDetailTravelers'

type ProductDetailCheckoutLayerProps = {
  product: Product
  productChoices: ProductChoice[]
  groupedChoices: Record<string, ProductChoiceGroup>
  /** 상세 페이지에서 선택한 값들을 예약 모달 초기값으로 전달 */
  initialDate?: string
  initialParticipants?: TravelerCounts
  initialSelectedOptions?: Record<string, string>
  initialSelectedChoiceQuantities?: Record<string, Record<string, number>>
}

export function useProductDetailCheckoutActions() {
  const [showBookingFlow, setShowBookingFlow] = useState(false)
  const [showChoiceDescriptionModal, setShowChoiceDescriptionModal] = useState(false)

  const openBookingFlow = useCallback(() => setShowBookingFlow(true), [])
  const openChoiceDescriptionModal = useCallback(() => setShowChoiceDescriptionModal(true), [])
  const closeChoiceDescriptionModal = useCallback(() => setShowChoiceDescriptionModal(false), [])

  return {
    showBookingFlow,
    setShowBookingFlow,
    showChoiceDescriptionModal,
    openBookingFlow,
    openChoiceDescriptionModal,
    closeChoiceDescriptionModal,
  }
}

export default function ProductDetailCheckoutLayer({
  product,
  productChoices,
  groupedChoices,
  initialDate,
  initialParticipants,
  initialSelectedOptions,
  initialSelectedChoiceQuantities,
  showBookingFlow,
  onCloseBookingFlow,
  showChoiceDescriptionModal,
  onCloseChoiceDescriptionModal,
}: ProductDetailCheckoutLayerProps & {
  showBookingFlow: boolean
  onCloseBookingFlow: () => void
  showChoiceDescriptionModal: boolean
  onCloseChoiceDescriptionModal: () => void
}) {
  const tProduct = useTranslations('productDetail')
  const [showCart, setShowCart] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentData] = useState<unknown>(null)
  const [cartItems, setCartItems] = useState<unknown[]>([])

  useEffect(() => {
    const handleOpenCartCheckout = () => {
      setShowCart(false)
      setShowCheckout(true)
    }

    window.addEventListener('openCartCheckout', handleOpenCartCheckout)
    return () => {
      window.removeEventListener('openCartCheckout', handleOpenCartCheckout)
    }
  }, [])

  const handleBookingComplete = (bookingData: {
    tourDate: string
    departureTime: string
    participants: unknown
    selectedOptions: unknown
    totalPrice: number
    customerInfo: unknown
  }) => {
    const cartItem = {
      productId: product.id,
      productName: product.name,
      productNameKo: product.customer_name_ko,
      productNameEn: product.customer_name_en || product.name_en,
      tourDate: bookingData.tourDate,
      departureTime: bookingData.departureTime,
      participants: bookingData.participants,
      selectedOptions: bookingData.selectedOptions,
      basePrice: product.base_price || 0,
      totalPrice: bookingData.totalPrice,
      customerInfo: bookingData.customerInfo,
    }

    setCartItems((prev) => [...prev, cartItem])
    onCloseBookingFlow()
    setShowCart(true)
  }

  const handleCheckout = () => {
    setShowCart(false)
    setShowCheckout(true)
  }

  const handleCheckoutSuccess = () => {
    setShowCheckout(false)
    setCartItems([])
  }

  const handlePaymentSuccess = (result: unknown) => {
    console.log('결제 성공:', result)
    setShowPayment(false)
    setCartItems([])
    alert(tProduct('bookingSuccess'))
  }

  const handlePaymentError = (error: string) => {
    console.error('결제 오류:', error)
    alert(tProduct('paymentError', { error }))
  }

  return (
    <>
      {showBookingFlow && (
        <BookingFlow
          product={product}
          productChoices={productChoices}
          {...(initialDate ? { initialDate } : {})}
          {...(initialParticipants ? { initialParticipants } : {})}
          {...(initialSelectedOptions ? { initialSelectedOptions } : {})}
          {...(initialSelectedChoiceQuantities
            ? { initialSelectedChoiceQuantities }
            : {})}
          onClose={onCloseBookingFlow}
          onComplete={handleBookingComplete}
        />
      )}

      <CartSidebar
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        onCheckout={handleCheckout}
      />

      <CartCheckout
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onSuccess={handleCheckoutSuccess}
      />

      {showPayment && paymentData && (
        <ProductDetailPaymentModal
          paymentData={paymentData}
          cartItems={cartItems}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
          onClose={() => setShowPayment(false)}
        />
      )}

      {showChoiceDescriptionModal && (
        <ProductDetailChoiceDescriptionModal
          groupedChoices={groupedChoices}
          onClose={onCloseChoiceDescriptionModal}
        />
      )}
    </>
  )
}
