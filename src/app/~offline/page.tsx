import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '오프라인',
  robots: { index: false, follow: false },
}

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50 px-6 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">네트워크에 연결할 수 없습니다</h1>
        <p className="text-gray-600">
          인터넷 연결을 확인한 뒤 다시 시도해 주세요. 이전에 방문한 페이지는 연결이 복구되면 자동으로
          갱신됩니다.
        </p>
        <p className="text-sm text-gray-500">
          You appear to be offline. Check your connection and try again.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        prefetch={false}
      >
        홈으로
      </Link>
    </div>
  )
}
