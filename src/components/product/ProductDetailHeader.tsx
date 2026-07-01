'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CustomerPageZone from '@/components/product/CustomerPageZone'

type ProductDetailHeaderProps = {
  locale: string
  displayName: string
  categoryLabel: string
  primaryTag?: string | null
}

export default function ProductDetailHeader({
  locale,
  displayName,
  categoryLabel,
  primaryTag,
}: ProductDetailHeaderProps) {
  return (
    <CustomerPageZone zone="detail-header" className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href={`/${locale}/products`} className="text-gray-500 hover:text-gray-700">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {categoryLabel}
                </span>
                {primaryTag && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {primaryTag}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </CustomerPageZone>
  )
}
