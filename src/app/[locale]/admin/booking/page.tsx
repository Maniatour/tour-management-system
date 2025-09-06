'use client';

import { useState } from 'react';
import TicketBookingList from '@/components/booking/TicketBookingList';
import TourHotelBookingList from '@/components/booking/TourHotelBookingList';

type TabType = 'tickets' | 'hotels';

export default function BookingManagementPage() {
  const [activeTab, setActiveTab] = useState<TabType>('tickets');

  const tabs = [
    { id: 'tickets' as TabType, name: '입장권 부킹', component: TicketBookingList },
    { id: 'hotels' as TabType, name: '투어 호텔 부킹', component: TourHotelBookingList },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">부킹 관리</h1>
          <p className="mt-2 text-gray-600">
            투어를 위한 입장권과 호텔 부킹을 관리하고 변경 이력을 추적할 수 있습니다.
          </p>
        </div>

        {/* 탭 네비게이션 */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
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

        {/* 탭 컨텐츠 */}
        <div className="bg-white rounded-lg shadow">
          {ActiveComponent && <ActiveComponent />}
        </div>

        {/* 안내 메시지 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                부킹 관리 안내
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc pl-5 space-y-1">
                  <li>투어 2일 전까지 공급업체에 비용을 지불하고 실예약을 완료해야 합니다.</li>
                  <li>투어 인원이 변경될 수 있으므로 상시로 부킹 내역을 확인하고 업데이트하세요.</li>
                  <li>모든 변경사항은 자동으로 히스토리에 기록되며, 언제든지 확인할 수 있습니다.</li>
                  <li>가예약 상태에서 실예약으로 변경 시 상태를 업데이트해주세요.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
