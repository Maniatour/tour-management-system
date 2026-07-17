'use client'

import { useEffect, useState } from 'react'
import { Check, Image as ImageIcon, List, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  normalizeChoicesDisplayMode,
  type ChoicesDisplayMode,
} from '@/lib/productChoiceGrouping'

type ChoicesDisplayModeSelectorProps = {
  productId: string
  onSaved?: () => void
}

const MODE_OPTIONS: Array<{
  id: ChoicesDisplayMode
  label: string
  description: string
  icon: typeof List
}> = [
  {
    id: 'list',
    label: '리스트 형식',
    description: '옵션명·가격을 한 줄씩 라디오 리스트로 표시',
    icon: List,
  },
  {
    id: 'card',
    label: '사진 카드뷰',
    description: '옵션 사진과 함께 카드 그리드로 표시',
    icon: ImageIcon,
  },
]

/** 고객 상세 페이지 상품 초이스 표시 방식(list/card) 선택 — products.choices_display_mode 저장 */
export default function ChoicesDisplayModeSelector({
  productId,
  onSaved,
}: ChoicesDisplayModeSelectorProps) {
  const [mode, setMode] = useState<ChoicesDisplayMode | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error: loadError } = await supabase
        .from('products')
        .select('choices_display_mode')
        .eq('id', productId)
        .maybeSingle()

      if (cancelled) return
      if (loadError) {
        console.error('초이스 표시 방식 로드 오류:', loadError)
        setMode('list')
        return
      }
      setMode(
        normalizeChoicesDisplayMode(
          (data as { choices_display_mode?: string | null } | null)?.choices_display_mode
        )
      )
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [productId])

  const handleSelect = async (nextMode: ChoicesDisplayMode) => {
    if (saving || mode === nextMode) return
    const previous = mode
    setMode(nextMode)
    setSaving(true)
    setError(null)

    const { error: saveError } = await supabase
      .from('products')
      .update({ choices_display_mode: nextMode } as never)
      .eq('id', productId)

    setSaving(false)
    if (saveError) {
      console.error('초이스 표시 방식 저장 오류:', saveError)
      setMode(previous)
      setError('표시 방식을 저장하지 못했습니다. 다시 시도해 주세요.')
      return
    }
    onSaved?.()
  }

  return (
    <div className="rounded-lg border border-border/60 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-800">고객 페이지 초이스 표시 방식</p>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MODE_OPTIONS.map((option) => {
          const selected = mode === option.id
          const Icon = option.icon
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={mode == null || saving}
              onClick={() => void handleSelect(option.id)}
              className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors disabled:opacity-60 ${
                selected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border/60 hover:border-primary/40 hover:bg-muted/40'
              }`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                  selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-gray-500'
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-xs font-semibold text-gray-900">
                  {option.label}
                  {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-gray-500">
                  {option.description}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
      <p className="mt-2 text-[11px] text-gray-400">
        선택 즉시 저장되며, 고객 상세 페이지의 상품 초이스 영역에 적용됩니다.
      </p>
    </div>
  )
}
