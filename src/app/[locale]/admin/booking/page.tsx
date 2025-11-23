'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import TicketBookingList from '@/components/booking/TicketBookingList';
import TourHotelBookingList from '@/components/booking/TourHotelBookingList';

type TabType = 'tickets' | 'hotels';

export default function BookingManagementPage() {
  const t = useTranslations('booking');
  const [activeTab, setActiveTab] = useState<TabType>('tickets');

  const tabs = [
    { id: 'tickets' as TabType, name: t('tabs.tickets'), component: TicketBookingList },
    { id: 'hotels' as TabType, name: t('tabs.hotels'), component: TourHotelBookingList },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pt-2 sm:pt-3 lg:pt-4 pb-4 sm:pb-6 lg:pb-8">
        {/* 헤더 - 모바일 최적화 */}
        <div className="mb-6 sm:mb-8 px-1 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('title')}</h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600">
            {t('subtitle')}
          </p>
        </div>

        {/* 탭 네비게이션 - 모바일 최적화 */}
        <div className="border-b border-gray-200 mb-4 sm:mb-6 px-1 sm:px-6 lg:px-8">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* 탭 컨텐츠 - 모바일 최적화 */}
        <div className="mx-0 sm:mx-4 lg:mx-8 bg-white rounded-lg shadow">
          {ActiveComponent && <ActiveComponent />}
        </div>

        {/* 안내 메시지 */}
        <div className="mt-8 mx-1 sm:mx-6 lg:mx-8 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                {t('info.title')}
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc pl-5 space-y-1">
                  {t.raw('info.items').map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
