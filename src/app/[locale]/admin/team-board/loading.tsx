export default function TeamBoardLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-gray-500">
      <div className="text-center">
        <div
          className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600"
          aria-hidden
        />
        <p className="text-sm font-medium text-gray-600">업무 관리 불러오는 중…</p>
      </div>
    </div>
  )
}
