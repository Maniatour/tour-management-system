import AdminPageContentSkeleton from '@/components/admin/AdminPageContentSkeleton'

export default function LocaleLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <AdminPageContentSkeleton rows={5} />
    </div>
  )
}
