'use client'

import { useRef, useState } from 'react'
import { Download, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ProductContentCsvPanelProps = {
  productId: string
  productLabel?: string
}

export default function ProductContentCsvPanel({
  productId,
  productLabel,
}: ProductContentCsvPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async () => {
    setDownloading(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch(`/api/admin/products/${productId}/content-csv`, {
        method: 'GET',
        credentials: 'include',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `다운로드 실패 (${res.status})`)
      }

      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
      const plainMatch = /filename="([^"]+)"/i.exec(disposition)
      const filename = utfMatch
        ? decodeURIComponent(utfMatch[1])
        : plainMatch?.[1] || `product-content_${productId}.csv`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setMessage('CSV를 다운로드했습니다. Excel에서 UTF-8(쉼표로 분리)로 열어 주세요.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '다운로드 실패')
    } finally {
      setDownloading(false)
    }
  }

  const handleUploadFile = async (file: File) => {
    setUploading(true)
    setMessage(null)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/admin/products/${productId}/content-csv`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || `업로드 실패 (${res.status})`)
      }

      const parts = [
        `행 ${body.updatedRows ?? 0}개 · 셀 ${body.updatedCells ?? 0}개 반영`,
      ]
      if (Array.isArray(body.warnings) && body.warnings.length > 0) {
        parts.push(body.warnings.slice(0, 3).join(' / '))
      }
      setMessage(parts.join('. '))
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold text-gray-900">다국어 콘텐츠 CSV</h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
            고객에게 보이는 항목(상품명·요약·상세·FAQ·일정·투어코스·초이스)을
            <span className="font-medium text-gray-700"> 제목 · 한국어 · English · 각 언어 </span>
            컬럼으로 내려받아 수정한 뒤, 한 번에 업로드할 수 있습니다.
            {productLabel ? (
              <span className="block mt-0.5 text-gray-500">대상: {productLabel}</span>
            ) : null}
          </p>
          <p className="text-[11px] text-amber-700/90">
            `key` 컬럼은 수정하지 마세요. FAQ·투어코스는 라이브러리 원본을 갱신하므로 다른 상품과 공유 시 함께 바뀝니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 rounded-lg"
            disabled={downloading || uploading}
            onClick={() => void handleDownload()}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>CSV 다운로드</span>
          </Button>

          <Button
            type="button"
            size="sm"
            className="h-10 rounded-lg"
            disabled={downloading || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span>CSV 업로드</span>
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUploadFile(file)
            }}
          />
        </div>
      </div>

      {message ? (
        <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}
    </div>
  )
}
