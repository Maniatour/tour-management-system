'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MarketCompetitor } from '@/lib/market-research/types'

export function MarketResearchCompetitorEditor({
  competitor,
  isKo,
  onSave,
  onCancel,
}: {
  competitor: MarketCompetitor | null
  isKo: boolean
  onSave: (input: { name: string; websiteUrl: string; notes: string; isActive: boolean }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(competitor?.name || '')
  const [websiteUrl, setWebsiteUrl] = useState(competitor?.website_url || '')
  const [notes, setNotes] = useState(competitor?.notes || '')
  const [isActive, setIsActive] = useState(competitor?.is_active !== false)
  const [saving, setSaving] = useState(false)

  return (
    <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="comp-name">{isKo ? '회사명' : 'Name'}</Label>
          <Input id="comp-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="comp-url">{isKo ? '공식 사이트' : 'Website'}</Label>
          <Input id="comp-url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="comp-notes">{isKo ? '내부 메모' : 'Notes'}</Label>
          <Input id="comp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          {isKo ? '활성' : 'Active'}
        </label>
        <div className="flex gap-2">
          <Button
            className="h-11 rounded-xl"
            disabled={saving || !name.trim()}
            onClick={async () => {
              setSaving(true)
              try {
                await onSave({ name, websiteUrl, notes, isActive })
              } finally {
                setSaving(false)
              }
            }}
          >
            {isKo ? '저장' : 'Save'}
          </Button>
          <Button variant="outline" className="h-11 rounded-xl" onClick={onCancel}>
            {isKo ? '취소' : 'Cancel'}
          </Button>
        </div>
    </div>
  )
}
