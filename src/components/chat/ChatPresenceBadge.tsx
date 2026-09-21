'use client'

export default function ChatPresenceBadge({
  online,
  isKo,
}: {
  online: boolean
  isKo: boolean
}) {
  return (
    <span
      className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'
      }`}
    >
      {online ? (isKo ? '활성' : 'Active') : isKo ? '비활성' : 'Inactive'}
    </span>
  )
}
