'use client'

import React, { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'

interface PreparationInfoEditModalProps {
  isOpen: boolean
  onClose: () => void
  productId: string
  channelId: string | null
  languageCode: string
  initialValue: string
  productName?: string
  onSaved: (newValue: string) => void
}

export default function PreparationInfoEditModal({
  isOpen,
  onClose,
  productId,
  channelId,
  languageCode,
  initialValue,
  productName,
  onSaved
}: PreparationInfoEditModalProps) {
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue)
      setError(null)
    }
  }, [isOpen, initialValue])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/product-details/preparation-info', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          languageCode,
          channelId: channelId ?? null,
          preparationInfo: value
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || '저장에 실패했습니다.')
        return
      }
      onSaved(value)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg w-full max-w-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            추천 준비물 수정 (영구 저장)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={22} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {productName && (
            <p className="text-sm text-gray-600">
              상품: <span className="font-medium text-gray-900">{productName}</span>
              {languageCode === 'en' ? ' (영어)' : ' (한국어)'}
            </p>
          )}
          <p className="text-sm text-gray-600">
            아래 내용은 상품의 준비 사항으로 저장되며, 이후 픽업 스케줄 알림 등 모든 이메일에 반영됩니다.
          </p>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="준비물·주의사항을 입력하세요"
          />
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                저장 중...
              </>
            ) : (
              '저장'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
