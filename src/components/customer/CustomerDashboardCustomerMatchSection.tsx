'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

export type CustomerMatchSearchForm = {
  phone: string
  email: string
  tourDate: string
  productName: string
}

type CustomerSearchResult = {
  id: string
  name: string
  email: string | null
  phone: string | null
}

type CustomerDashboardCustomerMatchSectionProps = {
  searchForm: CustomerMatchSearchForm
  onSearchFormChange: (field: keyof CustomerMatchSearchForm, value: string) => void
  onSearch: () => void
  isSearching: boolean
  searchResults: CustomerSearchResult[]
  onMatch: (customerId: string) => void
}

export default function CustomerDashboardCustomerMatchSection({
  searchForm,
  onSearchFormChange,
  onSearch,
  isSearching,
  searchResults,
  onMatch,
}: CustomerDashboardCustomerMatchSectionProps) {
  const t = useTranslations('customerDashboard')

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
        <Search className="w-5 h-5 mr-2" />
        {t('searchTitle')}
      </h2>
      <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6">
        <p className="text-primary text-sm font-medium mb-2">💡 {t('otaHintTitle')}</p>
        <p className="text-primary text-sm">{t('otaHintBody')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('phoneLabel')}</label>
          <input
            type="text"
            value={searchForm.phone}
            onChange={(e) => onSearchFormChange('phone', e.target.value)}
            placeholder={t('phonePlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('emailLabel')}</label>
          <input
            type="email"
            value={searchForm.email}
            onChange={(e) => onSearchFormChange('email', e.target.value)}
            placeholder={t('emailPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('tourDateLabel')}</label>
          <input
            type="date"
            value={searchForm.tourDate}
            onChange={(e) => onSearchFormChange('tourDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('productNameLabel')}</label>
          <input
            type="text"
            value={searchForm.productName}
            onChange={(e) => onSearchFormChange('productName', e.target.value)}
            placeholder={t('productNamePlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onSearch}
        disabled={isSearching}
        className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
      >
        {isSearching ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            {t('searching')}
          </>
        ) : (
          <>
            <Search className="w-4 h-4 mr-2" />
            {t('search')}
          </>
        )}
      </button>

      {searchResults.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('searchResults')}</h3>
          <div className="space-y-3">
            {searchResults.map((result) => (
              <div key={result.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{result.name}</h4>
                    <p className="text-sm text-gray-600">{result.email}</p>
                    {result.phone && <p className="text-sm text-gray-600">{result.phone}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => onMatch(result.id)}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                  >
                    {t('match')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
