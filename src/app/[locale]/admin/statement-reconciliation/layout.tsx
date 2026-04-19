import React from 'react'

/** 관리자 본문 `px` 안에서 좌우를 살짝 확장해 2K 등 넓은 화면에서 표 영역을 넓힘 */
export default function StatementReconciliationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0 -mx-1.5 sm:-mx-2 lg:-mx-3 px-1 sm:px-1.5 lg:px-2">
      {children}
    </div>
  )
}
