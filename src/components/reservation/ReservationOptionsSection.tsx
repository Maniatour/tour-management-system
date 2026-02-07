'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useReservationOptions, type ReservationOption, type CreateReservationOptionData } from '@/hooks/useReservationOptions'

interface ReservationOptionsSectionProps {
  reservationId: string
  onTotalPriceChange?: (totalPrice: number) => void
}

export default function ReservationOptionsSection({ reservationId, onTotalPriceChange }: ReservationOptionsSectionProps) {
  const t = useTranslations('reservations.reservationOptions')
  const tCommon = useTranslations('common')
  
  const {
    reservationOptions,
    loading,
    error,
    createReservationOption,
    updateReservationOption,
    deleteReservationOption,
    setReservationOptions,
  } = useReservationOptions(reservationId)

  const [editingOption, setEditingOption] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState<CreateReservationOptionData>({
    option_id: '',
    ea: 1,
    price: 0,
    total_price: 0,
    status: 'active',
    note: ''
  })

  const handleAddOption = async () => {
    try {
      await createReservationOption(formData)
      setFormData({
        option_id: '',
        ea: 1,
        price: 0,
        total_price: 0,
        status: 'active',
        note: ''
      })
      setShowAddForm(false)
    } catch (error) {
      console.error('Error adding reservation option:', error)
      alert('옵션 추가 중 오류가 발생했습니다.')
    }
  }

  const handleUpdateOption = async (option: ReservationOption) => {
    try {
      await updateReservationOption({
        id: option.id,
        option_id: option.option_id,
        ea: option.ea,
        price: option.price,
        total_price: option.total_price,
        status: option.status || 'active',
        note: option.note
      })
      setEditingOption(null)
    } catch (error) {
      console.error('Error updating reservation option:', error)
      alert('옵션 수정 중 오류가 발생했습니다.')
    }
  }

  const handleDeleteOption = async (optionId: string) => {
    if (confirm(t('confirmDelete'))) {
      try {
        await deleteReservationOption(optionId)
      } catch (error) {
        console.error('Error deleting reservation option:', error)
        alert('옵션 삭제 중 오류가 발생했습니다.')
      }
    }
  }

  const calculateTotalPrice = (price: number, ea: number) => {
    return price * ea
  }

  // 예약 옵션 총 가격을 부모 컴포넌트로 전달
  useEffect(() => {
    if (onTotalPriceChange) {
      const totalPrice = reservationOptions.reduce((sum, option) => sum + (option.total_price || 0), 0)
      onTotalPriceChange(totalPrice)
    }
  }, [reservationOptions, onTotalPriceChange])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-xs text-gray-600">{t('loadingOptions')}</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="text-red-600 text-center py-3 text-xs">
          {t('errorLoading', { error })}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-semibold text-gray-900">{t('title')}</h3>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-1 px-2 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium transition-colors flex-shrink-0 ml-auto"
        >
          <Plus size={14} />
          {t('addOption')}
        </button>
      </div>

      {/* 옵션 추가 폼 */}
      {showAddForm && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg border">
          <h4 className="text-xs font-medium mb-2">{t('addNewOption')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('optionId')}</label>
              <input
                type="text"
                value={formData.option_id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, option_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('optionId')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('quantity')}</label>
              <input
                type="number"
                min="1"
                value={formData.ea || 1}
                onChange={(e) => {
                  const ea = parseInt(e.target.value) || 1
                  setFormData(prev => ({ 
                    ...prev, 
                    ea,
                    total_price: calculateTotalPrice(prev.price || 0, ea)
                  }))
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('unitPrice')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.price || 0}
                onChange={(e) => {
                  const price = parseFloat(e.target.value) || 0
                  setFormData(prev => ({ 
                    ...prev, 
                    price,
                    total_price: calculateTotalPrice(price, prev.ea || 1)
                  }))
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('totalPrice')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.total_price || 0}
                onChange={(e) => setFormData(prev => ({ ...prev, total_price: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('status')}</label>
              <select
                value={formData.status || 'active'}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'cancelled' | 'refunded' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="active">{t('statusActive')}</option>
                <option value="cancelled">{t('statusCancelled')}</option>
                <option value="refunded">{t('statusRefunded')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('note')}</label>
              <input
                type="text"
                value={formData.note || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="메모 입력"
              />
            </div>
          </div>
          <div className="flex space-x-2 mt-4">
            <button
              type="button"
              onClick={handleAddOption}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Save size={16} className="mr-1" />
              {tCommon('save')}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="flex items-center px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              <X size={16} className="mr-1" />
              {tCommon('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* 옵션 목록 */}
      <div className="space-y-3">
        {reservationOptions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {t('noOptions')}
          </div>
        ) : (
          reservationOptions.map((option) => (
            <div key={option.id} className="border border-gray-200 rounded-lg p-4">
              {editingOption === option.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">옵션 ID</label>
                      <input
                        type="text"
                        value={option.option_id || ''}
                        onChange={(e) => {
                          const updatedOption = { ...option, option_id: e.target.value }
                          setReservationOptions(prev => 
                            prev.map(o => o.id === option.id ? updatedOption : o)
                          )
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('quantity')}</label>
                      <input
                        type="number"
                        min="1"
                        value={option.ea || 1}
                        onChange={(e) => {
                          const ea = parseInt(e.target.value) || 1
                          const updatedOption = { 
                            ...option, 
                            ea,
                            total_price: calculateTotalPrice(option.price, ea)
                          }
                          setReservationOptions(prev => 
                            prev.map(o => o.id === option.id ? updatedOption : o)
                          )
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('unitPrice')}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={option.price || 0}
                        onChange={(e) => {
                          const price = parseFloat(e.target.value) || 0
                          const updatedOption = { 
                            ...option, 
                            price,
                            total_price: calculateTotalPrice(price, option.ea)
                          }
                          setReservationOptions(prev => 
                            prev.map(o => o.id === option.id ? updatedOption : o)
                          )
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('totalPrice')}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={option.total_price || 0}
                        onChange={(e) => {
                          const updatedOption = { ...option, total_price: parseFloat(e.target.value) || 0 }
                          setReservationOptions(prev => 
                            prev.map(o => o.id === option.id ? updatedOption : o)
                          )
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('status')}</label>
                      <select
                        value={option.status || 'active'}
                        onChange={(e) => {
                          const updatedOption = { ...option, status: e.target.value as 'active' | 'cancelled' | 'refunded' }
                          setReservationOptions(prev => 
                            prev.map(o => o.id === option.id ? updatedOption : o)
                          )
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="active">활성</option>
                        <option value="cancelled">취소</option>
                        <option value="refunded">환불</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('note')}</label>
                      <input
                        type="text"
                        value={option.note || ''}
                        onChange={(e) => {
                          const updatedOption = { ...option, note: e.target.value }
                          setReservationOptions(prev => 
                            prev.map(o => o.id === option.id ? updatedOption : o)
                          )
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateOption(option)}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Save size={16} className="mr-1" />
                      {tCommon('save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingOption(null)}
                      className="flex items-center px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                      <X size={16} className="mr-1" />
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {option.option_name || option.option_id} ${(option.price || 0).toFixed(2)} × {option.ea} = ${(option.total_price || 0).toFixed(2)}
                      </div>
                      <div className="mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          (option.status || 'active') === 'active' ? 'bg-green-100 text-green-800' :
                          (option.status || 'active') === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {(option.status || 'active') === 'active' ? t('statusActive') : 
                           (option.status || 'active') === 'cancelled' ? t('statusCancelled') : t('statusRefunded')}
                        </span>
                        {option.note && (
                          <span className="ml-2 text-xs text-gray-600">{option.note}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button
                      type="button"
                      onClick={() => setEditingOption(option.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="편집"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOption(option.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 총합계 */}
      {reservationOptions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-end">
              <div className="text-lg font-semibold">
                {t('totalOptionPrice')}: ${reservationOptions.reduce((sum, option) => sum + option.total_price, 0).toFixed(2)}
              </div>
            </div>
        </div>
      )}
    </div>
  )
}
