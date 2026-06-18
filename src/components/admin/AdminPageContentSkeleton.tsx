'use client'

type AdminPageContentSkeletonProps = {
  rows?: number
  className?: string
}

/** Admin 페이지 본문(탭·테이블) 로딩 — 전체 화면 스피너 대신 레이아웃 유지 */
export default function AdminPageContentSkeleton({
  rows = 6,
  className = '',
}: AdminPageContentSkeletonProps) {
  return (
    <div className={`animate-pulse space-y-3 p-3 sm:p-6 ${className}`.trim()} aria-hidden>
      <div className="h-7 w-40 rounded bg-gray-200 sm:w-56" />
      <div className="h-4 w-full max-w-2xl rounded bg-gray-100" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="h-10 rounded bg-gray-100 sm:h-12"
            style={{ opacity: 1 - index * 0.08 }}
          />
        ))}
      </div>
    </div>
  )
}
