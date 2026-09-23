'use client'

import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MarketCompetitor } from '@/lib/market-research/types'
import { MarketResearchCompetitorEditor } from './MarketResearchCompetitorEditor'

export function MarketResearchCompetitorManager({
  competitors,
  listingCountById,
  isKo,
  onSave,
  onDelete,
}: {
  competitors: MarketCompetitor[]
  listingCountById: Record<string, number>
  isKo: boolean
  onSave: (
    input: { name: string; websiteUrl: string; notes: string; isActive: boolean },
    existing: MarketCompetitor | null
  ) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState<MarketCompetitor | 'new' | null>(null)
  const [busy, setBusy] = useState(false)

  if (editing) {
    return (
      <MarketResearchCompetitorEditor
        competitor={editing === 'new' ? null : editing}
        isKo={isKo}
        onCancel={() => setEditing(null)}
        onSave={async (input) => {
          await onSave(input, editing === 'new' ? null : editing)
          setEditing(null)
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          {isKo
            ? '비교에 쓸 경쟁사를 추가하고, 이름과 사이트를 관리합니다.'
            : 'Add and manage the competitors you compare against.'}
        </p>
        <Button className="h-10 rounded-xl" onClick={() => setEditing('new')}>
          <Plus className="mr-1 h-4 w-4" />
          {isKo ? '추가' : 'Add'}
        </Button>
      </div>
      {competitors.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
          {isKo ? '등록된 경쟁사가 없습니다.' : 'No competitors yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {competitors.map((row) => {
            const count = listingCountById[row.id] || 0
            return (
              <div
                key={row.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{row.name}</p>
                    {row.is_active === false ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {isKo ? '비활성' : 'Inactive'}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {row.website_url || (isKo ? '사이트 없음' : 'No website')}
                    {` · ${isKo ? `리스팅 ${count}` : `${count} listings`}`}
                  </p>
                  {row.notes?.trim() ? (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{row.notes.trim()}</p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isKo ? '내부 노트 없음' : 'No internal note'}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-lg"
                    onClick={() => setEditing(row)}
                  >
                    <Pencil className="mr-1 h-4 w-4" />
                    {isKo ? '수정' : 'Edit'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-lg"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          isKo
                            ? '이 경쟁사와 연결된 리스팅도 삭제됩니다. 삭제할까요?'
                            : 'This will also delete its listings. Continue?'
                        )
                      ) {
                        return
                      }
                      setBusy(true)
                      try {
                        await onDelete(row.id)
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {isKo ? '삭제' : 'Delete'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
