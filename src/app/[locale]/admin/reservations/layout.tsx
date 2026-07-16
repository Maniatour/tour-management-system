import React from 'react'

/** 본문 패딩은 AdminSidebarAndHeader에서 예약 경로에 맞게 축소함 */
export default function ReservationsLayout({ children }: { children: React.ReactNode }) {
  return <div className="w-full min-w-0">{children}</div>
}
