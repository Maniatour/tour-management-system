'use client'

import { useEffect, useState } from 'react'
import { Download, ExternalLink, FileText, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface PreviewDocument {
  title: string
  file_name: string
  file_path: string
  file_type: string
  mime_type: string
}

interface DocumentPreviewModalProps {
  document: PreviewDocument
  onClose: () => void
  onDownload: () => void
}

type PreviewKind = 'image' | 'pdf' | 'other'

function getPreviewKind(doc: PreviewDocument): PreviewKind {
  const mime = (doc.mime_type || '').toLowerCase()
  const ext = (doc.file_type || doc.file_name.split('.').pop() || '').toLowerCase()

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
    return 'image'
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf'
  }
  return 'other'
}

export default function DocumentPreviewModal({
  document,
  onClose,
  onDownload,
}: DocumentPreviewModalProps) {
  const [loading, setLoading] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const kind = getPreviewKind(document)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    const loadPreview = async () => {
      setLoading(true)
      setError(null)
      setPreviewUrl(null)

      try {
        const { data: signed, error: signedError } = await supabase.storage
          .from('document-files')
          .createSignedUrl(document.file_path, 3600)

        if (!signedError && signed?.signedUrl) {
          if (!cancelled) setPreviewUrl(signed.signedUrl)
          return
        }

        const { data, error: downloadError } = await supabase.storage
          .from('document-files')
          .download(document.file_path)

        if (downloadError) throw downloadError

        const blob =
          data.type && data.type !== 'application/octet-stream'
            ? data
            : new Blob([data], { type: document.mime_type || 'application/octet-stream' })
        objectUrl = URL.createObjectURL(blob)
        if (!cancelled) setPreviewUrl(objectUrl)
      } catch (err) {
        console.error('문서 미리보기 오류:', err)
        if (!cancelled) {
          setError('문서를 불러오는 중 오류가 발생했습니다.')
          toast.error('문서를 불러오는 중 오류가 발생했습니다.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadPreview()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [document.file_path, document.mime_type])

  const openInNewTab = () => {
    if (!previewUrl) return
    window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-xl sm:h-auto sm:max-h-[90vh] sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-preview-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <h2 id="document-preview-title" className="break-words text-lg font-semibold leading-snug text-gray-900 sm:text-xl">
              {document.title}
            </h2>
            <p className="mt-0.5 break-all text-xs text-gray-500 sm:text-sm">{document.file_name}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {previewUrl && (
              <button
                type="button"
                onClick={openInNewTab}
                className="rounded p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-ring"
                title="새 탭에서 열기"
              >
                <ExternalLink className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onDownload}
              className="rounded p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-ring"
              title="다운로드"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-ring"
              title="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-[60vh] flex-1 items-center justify-center overflow-auto bg-gray-50">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              문서를 불러오는 중...
            </div>
          ) : error || !previewUrl ? (
            <div className="px-6 py-10 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-gray-400" />
              <p className="text-sm text-gray-600">{error || '문서를 표시할 수 없습니다.'}</p>
              <button
                type="button"
                onClick={onDownload}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Download className="h-4 w-4" />
                다운로드
              </button>
            </div>
          ) : kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={document.title}
              className="max-h-[70vh] w-full object-contain p-4"
            />
          ) : kind === 'pdf' ? (
            <iframe
              src={previewUrl}
              title={document.title}
              className="h-[70vh] w-full border-0 bg-white"
            />
          ) : (
            <div className="px-6 py-10 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-gray-400" />
              <p className="text-sm font-medium text-gray-900">이 파일 형식은 미리보기를 지원하지 않습니다.</p>
              <p className="mt-1 text-xs text-gray-500">다운로드하거나 새 탭에서 열어 확인하세요.</p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={openInNewTab}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  새 탭에서 열기
                </button>
                <button
                  type="button"
                  onClick={onDownload}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Download className="h-4 w-4" />
                  다운로드
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
