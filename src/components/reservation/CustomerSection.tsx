'use client'

import { RefObject } from 'react'

interface Customer {
  id: string
  name: string
  email?: string | null
  phone?: string | null
}

interface CustomerSectionProps {
  formData: {
    customerSearch: string
    customerId: string
    showCustomerDropdown: boolean
    channelRN: string
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (data: any) => void
  customers: Customer[]
  customerSearchRef: RefObject<HTMLDivElement>
  setShowCustomerForm: (show: boolean) => void
  t: (key: string) => string
}

export default function CustomerSection({
  formData,
  setFormData,
  customers,
  customerSearchRef,
  setShowCustomerForm,
  t
}: CustomerSectionProps) {
  
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">{t('form.customer')}</label>
          {formData.customerId && !formData.showCustomerDropdown && (
            <span className="text-xs text-gray-600">
              선택된 고객: {customers.find(c => c.id === formData.customerId)?.name || '알 수 없음'}
            </span>
          )}
        </div>
        <div className="relative" ref={customerSearchRef}>
          <input
            type="text"
            value={formData.customerSearch || ''}
            onChange={(e) => {
              setFormData({ ...formData, customerSearch: e.target.value })
              // 검색어가 변경되면 고객 ID 초기화
              if (e.target.value === '') {
                setFormData((prev: any) => ({ ...prev, customerId: '' })) // eslint-disable-line @typescript-eslint/no-explicit-any
              }
            }}
            onFocus={() => setFormData((prev: any) => ({ ...prev, showCustomerDropdown: true }))} // eslint-disable-line @typescript-eslint/no-explicit-any
            placeholder="고객 이름, 이메일, 전화번호로 검색..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-20"
            required
          />
          <button
            type="button"
            onClick={() => setShowCustomerForm(true)}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center justify-center"
          >
            +
          </button>
          
          {/* 고객 검색 드롭다운 */}
          {formData.showCustomerDropdown && formData.customerSearch && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {customers
                .filter(customer => 
                  customer.name?.toLowerCase().includes(formData.customerSearch.toLowerCase()) ||
                  customer.email?.toLowerCase().includes(formData.customerSearch.toLowerCase()) ||
                  customer.phone?.toLowerCase().includes(formData.customerSearch.toLowerCase())
                )
                .slice(0, 10) // 최대 10개만 표시
                .map(customer => (
                  <div
                    key={customer.id}
                    onClick={() => {
                      setFormData((prev: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                        ...prev,
                        customerId: customer.id,
                        customerSearch: customer.name || '',
                        showCustomerDropdown: false
                      }))
                    }}
                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{customer.name || '이름 없음'}</div>
                    {customer.email && (
                      <div className="text-sm text-gray-500">{customer.email}</div>
                    )}
                    {customer.phone && (
                      <div className="text-sm text-gray-500">{customer.phone}</div>
                    )}
                  </div>
                ))}
              {customers.filter(customer => 
                customer.name?.toLowerCase().includes(formData.customerSearch.toLowerCase()) ||
                customer.email?.toLowerCase().includes(formData.customerSearch.toLowerCase()) ||
                customer.phone?.toLowerCase().includes(formData.customerSearch.toLowerCase())
              ).length === 0 && (
                <div className="px-3 py-2 text-gray-500 text-center">
                  검색 결과가 없습니다
                </div>
              )}
            </div>
          )}
        </div>
      </div>
       
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.channelRN')}</label>
        <input
          type="text"
          value={formData.channelRN}
          onChange={(e) => setFormData({ ...formData, channelRN: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('form.channelRNPlaceholder')}
        />
      </div>
    </div>
  )
}
