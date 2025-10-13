'use client'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  startIndex: number
  endIndex: number
  onPageChange: (page: number) => void
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPageChange
}: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between mt-8">
      <div className="text-sm text-gray-700">
        페이지 {currentPage} / {totalPages} (총 {totalItems}개)
      </div>
      
      <div className="flex items-center space-x-2">
        {/* 이전 페이지 버튼 */}
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          이전
        </button>
        
        {/* 페이지 번호들 */}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum
          if (totalPages <= 5) {
            pageNum = i + 1
          } else if (currentPage <= 3) {
            pageNum = i + 1
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + i
          } else {
            pageNum = currentPage - 2 + i
          }
          
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                currentPage === pageNum
                  ? 'text-white bg-blue-600 border border-blue-600'
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {pageNum}
            </button>
          )
        })}
        
        {/* 다음 페이지 버튼 */}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          다음
        </button>
      </div>
    </div>
  )
}
