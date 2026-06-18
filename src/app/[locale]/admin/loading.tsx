import AdminPageContentSkeleton from '@/components/admin/AdminPageContentSkeleton'

export default function AdminLoading() {
  return (
    <div className="max-w-[1920px] mx-auto px-3 sm:px-4 py-4">
      <div className="mb-4 animate-pulse space-y-2">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-4 w-72 max-w-full rounded bg-gray-100" />
      </div>
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <AdminPageContentSkeleton rows={8} />
      </div>
    </div>
  )
}
