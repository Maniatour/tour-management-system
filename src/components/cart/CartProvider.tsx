'use client'

import React, { useState, useEffect, createContext, useContext } from 'react'
import { ShoppingCart, Plus, Minus, Trash2, X, CreditCard, Calendar } from 'lucide-react'
import { useLocale } from 'next-intl'

interface CartItem {
  id: string
  productId: string
  productName: string
  productNameKo: string
  productNameEn?: string | null
  tourDate: string
  departureTime: string
  participants: {
    adults: number
    children: number
    infants: number
  }
  selectedOptions: Record<string, string>
  basePrice: number
  totalPrice: number
  customerInfo: {
    name: string
    email: string
    phone: string
    nationality: string
    specialRequests: string
  }
  addedAt: string
}

interface CartContextType {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'id' | 'addedAt'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, participants: CartItem['participants']) => void
  clearCart: () => void
  getTotalPrice: () => number
  getTotalItems: () => number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([])

  // 로컬 스토리지에서 카트 데이터 로드
  useEffect(() => {
    const savedCart = localStorage.getItem('tour-cart')
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart))
      } catch (error) {
        console.error('카트 데이터 로드 오류:', error)
      }
    }
  }, [])

  // 카트 데이터 저장
  useEffect(() => {
    localStorage.setItem('tour-cart', JSON.stringify(items))
  }, [items])

  const addItem = (item: Omit<CartItem, 'id' | 'addedAt'>) => {
    const newItem: CartItem = {
      ...item,
      id: `cart_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      addedAt: new Date().toISOString()
    }
    setItems(prev => [...prev, newItem])
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const updateQuantity = (id: string, participants: CartItem['participants']) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const totalParticipants = participants.adults + participants.children + participants.infants
        return {
          ...item,
          participants,
          totalPrice: item.basePrice * totalParticipants
        }
      }
      return item
    }))
  }

  const clearCart = () => {
    setItems([])
  }

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + item.totalPrice, 0)
  }

  const getTotalItems = () => {
    return items.reduce((total, item) => {
      return total + item.participants.adults + item.participants.children + item.participants.infants
    }, 0)
  }

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getTotalPrice,
      getTotalItems
    }}>
      {children}
    </CartContext.Provider>
  )
}

// 카트 아이콘 컴포넌트
export const CartIcon: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { getTotalItems } = useCart()
  const totalItems = getTotalItems()

  return (
    <button
      onClick={onClick}
      className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
    >
      <ShoppingCart className="h-6 w-6" />
      {totalItems > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {totalItems}
        </span>
      )}
    </button>
  )
}

// 카트 사이드바 컴포넌트
export const CartSidebar: React.FC<{ isOpen: boolean; onClose: () => void; onCheckout: () => void }> = ({
  isOpen,
  onClose,
  onCheckout
}) => {
  const { items, removeItem, updateQuantity, getTotalPrice, clearCart } = useCart()
  const locale = useLocale()
  const isEnglish = locale === 'en'
  const translate = (ko: string, en: string) => (isEnglish ? en : ko)

  const handleQuantityChange = (itemId: string, type: 'adults' | 'children' | 'infants', delta: number) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    const newParticipants = { ...item.participants }
    newParticipants[type] = Math.max(0, newParticipants[type] + delta)
    
    updateQuantity(itemId, newParticipants)
  }

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? 'block' : 'hidden'}`}>
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
        <div className="flex flex-col h-full">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{translate('장바구니', 'Cart')}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* 카트 아이템 목록 */}
          <div className="flex-1 overflow-y-auto p-4">
            {items.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-600">{translate('장바구니가 비어있습니다', 'Your cart is empty')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{isEnglish ? item.productNameEn || item.productName || item.productNameKo : item.productNameKo || item.productName}</h3>
                        <div className="text-sm text-gray-600 mt-1">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {new Date(item.tourDate).toLocaleDateString(isEnglish ? 'en-US' : 'ko-KR')}
                          </div>
                          {item.departureTime && (
                            <div className="flex items-center mt-1">
                              <Clock className="h-4 w-4 mr-1" />
                              {item.departureTime}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* 인원 수 조정 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{translate('성인', 'Adult')}</span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleQuantityChange(item.id, 'adults', -1)}
                            className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-sm font-medium">{item.participants.adults}</span>
                          <button
                            onClick={() => handleQuantityChange(item.id, 'adults', 1)}
                            className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {item.participants.children > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">{translate('아동', 'Child')}</span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleQuantityChange(item.id, 'children', -1)}
                              className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-medium">{item.participants.children}</span>
                            <button
                              onClick={() => handleQuantityChange(item.id, 'children', 1)}
                              className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {item.participants.infants > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">{translate('유아', 'Infant')}</span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleQuantityChange(item.id, 'infants', -1)}
                              className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-medium">{item.participants.infants}</span>
                            <button
                              onClick={() => handleQuantityChange(item.id, 'infants', 1)}
                              className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 가격 */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{translate('총 가격', 'Total price')}</span>
                        <span className="font-semibold text-blue-600">${item.totalPrice}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 푸터 */}
          {items.length > 0 && (
            <div className="border-t border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold text-gray-900">{translate('총 가격', 'Total price')}</span>
                <span className="text-xl font-bold text-blue-600">${getTotalPrice()}</span>
              </div>
              
              <div className="space-y-2">
                <button
                  onClick={onCheckout}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center"
                >
                  <CreditCard className="h-5 w-5 mr-2" />
                  {translate('결제하기', 'Proceed to payment')}
                </button>
                <button
                  onClick={clearCart}
                  className="w-full text-gray-600 py-2 px-4 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                >
                  {translate('장바구니 비우기', 'Clear cart')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 카트 미니 컴포넌트 (헤더용)
export const CartMini: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { getTotalItems, getTotalPrice } = useCart()
  const totalItems = getTotalItems()
  const totalPrice = getTotalPrice()
  const locale = useLocale()
  const isEnglish = locale === 'en'
  const translate = (ko: string, en: string) => (isEnglish ? en : ko)

  return (
    <button
      onClick={onClick}
      className="flex items-center space-x-2 p-2 text-gray-600 hover:text-gray-900 transition-colors"
    >
      <div className="relative">
        <ShoppingCart className="h-6 w-6" />
        {totalItems > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {totalItems}
          </span>
        )}
      </div>
      <div className="text-left">
        <div className="text-sm font-medium">{translate('장바구니', 'Cart')}</div>
        {totalItems > 0 && (
          <div className="text-xs text-gray-500">
            {isEnglish ? `${totalItems} item${totalItems === 1 ? '' : 's'}` : `${totalItems}개 상품`} • ${totalPrice}
          </div>
        )}
      </div>
    </button>
  )
}
