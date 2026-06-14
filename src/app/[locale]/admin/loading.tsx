export default function AdminLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-gray-50 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
          role="status"
          aria-label="관리자 페이지 불러오는 중"
        />
        <p className="text-sm text-gray-500">관리자 페이지를 불러오는 중...</p>
      </div>
    </div>
  )
}
