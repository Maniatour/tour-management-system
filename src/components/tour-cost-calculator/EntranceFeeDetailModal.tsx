'use client'

import React from 'react'
import { X } from 'lucide-react'

interface EntranceFeeDetail {
  courseName: string
  priceType: string
  unitPrice: number
  quantity: number
  total: number
}

interface HotelAccommodationDetail {
  courseName: string
  priceType: string
  unitPrice: number
  quantity: number
  total: number
}

interface EntranceFeeDetailModalProps {
  isOpen: boolean
  entranceFeeDetails: EntranceFeeDetail[]
  hotelAccommodationDetails: HotelAccommodationDetail[]
  entranceFees: number
  hotelAccommodationCost: number
  numberOfDays: number
  onClose: () => void
  locale?: string
}

const EntranceFeeDetailModal: React.FC<EntranceFeeDetailModalProps> = ({
  isOpen,
  entranceFeeDetails,
  hotelAccommodationDetails,
  entranceFees,
  hotelAccommodationCost,
  numberOfDays,
  onClose,
  locale = 'ko'
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">
            {locale === 'ko' ? '입장료 및 호텔 숙박비 상세 내역' : 'Entrance Fees and Hotel Accommodation Details'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-6">
          {/* 입장료 섹션 */}
          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-3">
              {locale === 'ko' ? '입장료' : 'Entrance Fees'}
            </h4>
            {entranceFeeDetails.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">
                        {locale === 'ko' ? '투어 코스' : 'Tour Course'}
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">
                        {locale === 'ko' ? '가격 타입' : 'Price Type'}
                      </th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">
                        {locale === 'ko' ? '단가' : 'Unit Price'}
                      </th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">
                        {locale === 'ko' ? '수량' : 'Quantity'}
                      </th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">
                        {locale === 'ko' ? '합계' : 'Total'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entranceFeeDetails.map((detail, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-900">{detail.courseName}</td>
                        <td className="py-2 px-3 text-gray-600">{detail.priceType}</td>
                        <td className="py-2 px-3 text-right text-gray-700">${detail.unitPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-gray-700">{detail.quantity}</td>
                        <td className="py-2 px-3 text-right font-medium text-gray-900">${detail.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td colSpan={4} className="py-3 px-3 text-right font-semibold text-gray-900">
                        {locale === 'ko' ? '입장료 합계' : 'Entrance Fee Total'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-lg text-blue-600">
                        ${entranceFees.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                <p>{locale === 'ko' ? '입장료 내역이 없습니다.' : 'No entrance fee details.'}</p>
              </div>
            )}
          </div>

          {/* 호텔 숙박비 섹션 */}
          {hotelAccommodationDetails.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-3">
                {locale === 'ko' ? '호텔 숙박비' : 'Hotel Accommodation'}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">
                        {locale === 'ko' ? '투어 코스' : 'Tour Course'}
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">
                        {locale === 'ko' ? '가격 타입' : 'Price Type'}
                      </th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">
                        {locale === 'ko' ? '단가' : 'Unit Price'}
                      </th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">
                        {locale === 'ko' ? '수량' : 'Quantity'}
                      </th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">
                        {locale === 'ko' ? '합계' : 'Total'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotelAccommodationDetails.map((detail, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-900">{detail.courseName}</td>
                        <td className="py-2 px-3 text-gray-600">{detail.priceType}</td>
                        <td className="py-2 px-3 text-right text-gray-700">${detail.unitPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-gray-700">{detail.quantity}</td>
                        <td className="py-2 px-3 text-right font-medium text-gray-900">${detail.total.toFixed(2)}</td>
                      </tr>
                    ))}
                    {numberOfDays > 1 && (
                      <tr className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-900">
                          {locale === 'ko' ? '가이드 숙박비' : 'Guide Accommodation'}
                        </td>
                        <td className="py-2 px-3 text-gray-600">
                          {locale === 'ko' ? '1박당 $100' : '$100 per night'}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700">$100.00</td>
                        <td className="py-2 px-3 text-right text-gray-700">
                          {numberOfDays - 1} {locale === 'ko' ? '박' : 'nights'}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-gray-900">
                          ${((numberOfDays - 1) * 100).toFixed(2)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td colSpan={4} className="py-3 px-3 text-right font-semibold text-gray-900">
                        {locale === 'ko' ? '호텔 숙박비 합계' : 'Hotel Accommodation Total'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-lg text-green-600">
                        ${hotelAccommodationCost.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            {locale === 'ko' ? '닫기' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EntranceFeeDetailModal
