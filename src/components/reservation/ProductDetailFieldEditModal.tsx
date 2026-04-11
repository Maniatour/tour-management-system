'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Loader2 } from 'lucide-react'
import LightRichEditor from '@/components/LightRichEditor'
import { createClientSupabase } from '@/lib/supabase'
import {
  type ProductDetailEmailEditableField,
  PRODUCT_DETAIL_FIELD_DEFAULT_SECTION_TITLES,
  PRODUCT_DETAIL_FIELD_LABELS_EN,
  PRODUCT_DETAIL_FIELD_LABELS_KO,
  isProductDetailVisibleOnCustomerPage,
} from '@/lib/fetchProductDetailsForEmail'

type ChannelRow = { id: string; name: string; type: string }

function resolveStoredChannelId(
  channel: ChannelRow | undefined,
  channelId: string
): string {
  if (!channel) {
    const upper = channelId.toUpperCase()
    if (upper === 'SELF' || upper === 'SELF_GROUP') return 'SELF_GROUP'
    return channelId
  }
  return channel.type === 'self' || channel.type === 'SELF'
    ? 'SELF_GROUP'
    : channelId
}

interface ProductDetailFieldEditModalProps {
  isOpen: boolean
  onClose: () => void
  productId: string
  channelId: string | null
  variantKey: string
  languageCode: string
  field: ProductDetailEmailEditableField | null
  initialValue: string
  sourceLabel?: string
  isEnglish?: boolean
  /** DB section_titles JSON (문자열 값만 사용) */
  sectionTitles?: Record<string, string>
  /** DB customer_page_visibility JSON */
  customerPageVisibility?: Record<string, unknown> | null
  onSaved: () => void
}

export default function ProductDetailFieldEditModal({
  isOpen,
  onClose,
  productId,
  channelId,
  variantKey,
  languageCode,
  field,
  initialValue,
  sourceLabel,
  isEnglish = false,
  sectionTitles: sectionTitlesProp,
  customerPageVisibility: customerPageVisibilityProp,
  onSaved,
}: ProductDetailFieldEditModalProps) {
  const supabase = createClientSupabase()
  const sectionTitlesFromRow = useMemo(
    () => sectionTitlesProp ?? {},
    [sectionTitlesProp]
  )

  const [value, setValue] = useState(initialValue)
  const [sectionTitleInput, setSectionTitleInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [channels, setChannels] = useState<ChannelRow[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [importLang, setImportLang] = useState(languageCode)
  const [importChannelId, setImportChannelId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const [copyOpen, setCopyOpen] = useState(false)
  const [copyTargets, setCopyTargets] = useState<Record<string, boolean>>({})
  const [copying, setCopying] = useState(false)
  const [showOnCustomerPage, setShowOnCustomerPage] = useState(true)

  const fieldLabel =
    field == null
      ? ''
      : isEnglish
        ? PRODUCT_DETAIL_FIELD_LABELS_EN[field]
        : PRODUCT_DETAIL_FIELD_LABELS_KO[field]

  const defaultSectionTitle =
    field == null ? '' : PRODUCT_DETAIL_FIELD_DEFAULT_SECTION_TITLES[field]

  const headerTitle =
    (sectionTitleInput.trim() || defaultSectionTitle || fieldLabel).trim()

  useEffect(() => {
    if (isOpen && field) {
      setValue(initialValue)
      setSectionTitleInput(sectionTitlesFromRow[field] ?? '')
      setShowOnCustomerPage(
        isProductDetailVisibleOnCustomerPage(customerPageVisibilityProp ?? null, field)
      )
      setError(null)
      setImportLang(languageCode)
      setImportChannelId(null)
      setImportOpen(false)
      setCopyOpen(false)
      setCopyTargets({})
    }
  }, [
    isOpen,
    initialValue,
    field,
    languageCode,
    sectionTitlesFromRow,
    customerPageVisibilityProp,
  ])

  const loadChannels = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('channels')
      .select('id, name, type')
      .order('type, name')
    if (err) {
      console.error(err)
      return
    }
    setChannels((data || []) as ChannelRow[])
  }, [supabase])

  useEffect(() => {
    if (isOpen) void loadChannels()
  }, [isOpen, loadChannels])

  const currentStoredId =
    channelId != null && channelId !== ''
      ? resolveStoredChannelId(
          channels.find((c) => c.id === channelId),
          channelId
        )
      : null

  const openCopyModal = () => {
    const next: Record<string, boolean> = {}
    for (const ch of channels) {
      const sid = resolveStoredChannelId(ch, ch.id)
      if (currentStoredId != null && sid === currentStoredId) continue
      next[ch.id] = false
    }
    setCopyTargets(next)
    setCopyOpen(true)
  }

  /** Without service role, API needs Bearer JWT (session may live in localStorage only). */
  const patchFieldHeaders = async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    }
    return headers
  }

  const handleSave = async () => {
    if (!field) return
    setSaving(true)
    setError(null)
    try {
      const effectiveChannelId =
        channelId != null && channelId !== ''
          ? resolveStoredChannelId(
              channels.find((c) => c.id === channelId),
              channelId
            )
          : null
      const res = await fetch('/api/product-details/field', {
        method: 'PATCH',
        headers: await patchFieldHeaders(),
        body: JSON.stringify({
          productId,
          languageCode,
          channelId: effectiveChannelId,
          variantKey,
          field,
          value,
          sectionTitle: sectionTitleInput,
          customerPageVisible: showOnCustomerPage,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || '저장에 실패했습니다.')
        return
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const plainLen = (raw: string) =>
    raw.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().length

  const handleImportFromChannel = async () => {
    if (!field || !importChannelId) {
      setError('가져올 채널을 선택하세요.')
      return
    }
    setImporting(true)
    setError(null)
    try {
      const ch = channels.find((c) => c.id === importChannelId)
      const stored = resolveStoredChannelId(ch, importChannelId)

      const tryVk = async (vk: string) => {
        const { data, error: qErr } = await supabase
          .from('product_details_multilingual')
          .select(`${String(field)}, section_titles, customer_page_visibility`)
          .eq('product_id', productId)
          .eq('channel_id', stored)
          .eq('language_code', importLang)
          .eq('variant_key', vk)
          .maybeSingle()
        if (qErr && qErr.code !== 'PGRST116') throw qErr
        return data as Record<string, unknown> | null
      }

      let row = await tryVk(variantKey)
      if (!row) row = await tryVk('default')

      if (!row) {
        setError('선택한 채널·언어에 해당 행이 없습니다.')
        return
      }

      const rawVal = row[field]
      const html =
        rawVal == null ? '' : typeof rawVal === 'string' ? rawVal : String(rawVal)
      if (plainLen(html) === 0) {
        setError('가져올 내용이 비어 있습니다.')
        return
      }

      setValue(html)
      const st = row.section_titles
      if (st && typeof st === 'object' && !Array.isArray(st)) {
        const custom = (st as Record<string, unknown>)[field]
        if (typeof custom === 'string') setSectionTitleInput(custom)
      }
      setImportOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '가져오기 실패')
    } finally {
      setImporting(false)
    }
  }

  const handleDuplicateToChannels = async () => {
    if (!field) return
    const ids = Object.keys(copyTargets).filter((id) => copyTargets[id])
    if (ids.length === 0) {
      setError('복사할 채널을 한 개 이상 선택하세요.')
      return
    }
    setCopying(true)
    setError(null)
    const failures: string[] = []
    try {
      for (const id of ids) {
        const ch = channels.find((c) => c.id === id)
        const stored = resolveStoredChannelId(ch, id)
        const res = await fetch('/api/product-details/field', {
          method: 'PATCH',
          headers: await patchFieldHeaders(),
          body: JSON.stringify({
            productId,
            languageCode,
            channelId: stored,
            variantKey,
            field,
            value,
            sectionTitle: sectionTitleInput,
            customerPageVisible: showOnCustomerPage,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          failures.push(
            `${ch?.name || id}: ${data.error || res.statusText}`
          )
        }
      }
      if (failures.length > 0) {
        setError(
          `일부 채널에 저장되지 않았습니다 (행이 없을 수 있습니다).\n${failures.join('\n')}`
        )
      }
      setCopyOpen(false)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : '복사 중 오류')
    } finally {
      setCopying(false)
    }
  }

  if (!isOpen || !field) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg w-full max-w-3xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
            <h3 className="text-base font-semibold text-gray-900">{headerTitle}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={22} />
            </button>
          </div>

          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openCopyModal}
              className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Duplicate to channels
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Import from another channel
            </button>
          </div>

          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            <p className="text-xs text-gray-600">
              상품 상세 · {fieldLabel}{' '}
              <span className="text-gray-500">(저장 시 DB 전역 반영)</span>
            </p>
            {sourceLabel && (
              <p className="text-sm text-gray-600">
                대상:{' '}
                <span className="font-medium text-gray-900">{sourceLabel}</span>
                {languageCode === 'en' ? ' · EN' : ' · KO'} · variant{' '}
                {variantKey}
              </p>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                섹션 제목
              </label>
              <input
                type="text"
                value={sectionTitleInput}
                onChange={(e) => setSectionTitleInput(e.target.value)}
                placeholder={defaultSectionTitle}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                비워두면 기본 제목을 사용합니다.
              </p>
            </div>

            <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-gray-200 bg-slate-50 px-3 py-2.5">
              <input
                type="checkbox"
                checked={showOnCustomerPage}
                onChange={(e) => setShowOnCustomerPage(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-800 leading-snug">
                <span className="font-medium">고객 상품 페이지에 표시</span>
                <span className="block text-[11px] text-gray-500 mt-0.5 font-normal">
                  끄면 공개 상품 페이지에서 이 섹션만 숨깁니다. 예약 확인 이메일 등은 별도입니다.
                </span>
              </span>
            </label>

            <LightRichEditor
              value={value}
              onChange={(v) => setValue(v || '')}
              height={320}
              placeholder="고객에게 보여질 내용을 입력하세요"
              enableResize
            />

            {error && (
              <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>
            )}
          </div>

          <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              닫기
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

      {importOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4"
          onClick={() => setImportOpen(false)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
              <h4 className="text-sm font-semibold text-gray-900">
                섹션 가져오기 (Import)
              </h4>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              <p className="text-xs text-gray-600">
                다른 채널에 저장된 동일 필드를 불러와 편집기에 붙여넣습니다. 필요 시
                아래에서 저장하세요.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  소스 언어
                </label>
                <select
                  value={importLang}
                  onChange={(e) => setImportLang(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  <option value="ko">KO · 한국어</option>
                  <option value="en">EN · English</option>
                  <option value="ja">JA · 日本語</option>
                  <option value="zh">ZH · 中文</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  소스 채널
                </label>
                <div className="border border-gray-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-gray-100">
                  {channels.map((ch) => (
                    <label
                      key={ch.id}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 ${
                        importChannelId === ch.id ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="importSrcCh"
                        checked={importChannelId === ch.id}
                        onChange={() => setImportChannelId(ch.id)}
                        className="h-4 w-4 text-emerald-600"
                      />
                      <span className="text-sm text-gray-800">{ch.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded text-sm"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleImportFromChannel}
                disabled={importing || !importChannelId}
                className="px-4 py-2 bg-emerald-600 text-white rounded text-sm disabled:opacity-50"
              >
                {importing ? '가져오는 중…' : '가져오기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {copyOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4"
          onClick={() => setCopyOpen(false)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-900">
                {fieldLabel} — 다른 채널로 복사
              </h4>
              <button
                type="button"
                onClick={() => setCopyOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            <p className="px-5 pt-4 text-sm text-gray-600">
              현재 편집 중인 HTML·섹션 제목을 선택한 채널의{' '}
              <span className="font-medium">같은 언어·variant</span> 행에 덮어씁니다.
              해당 행이 없으면 건너뜁니다.
            </p>
            <div className="p-5 space-y-2 max-h-72 overflow-y-auto">
              {channels.map((ch) => {
                const sid = resolveStoredChannelId(ch, ch.id)
                if (currentStoredId != null && sid === currentStoredId) return null
                return (
                  <label
                    key={ch.id}
                    className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={copyTargets[ch.id] || false}
                      onChange={(e) =>
                        setCopyTargets((prev) => ({
                          ...prev,
                          [ch.id]: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 text-blue-600 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-800">{ch.name}</span>
                  </label>
                )
              })}
            </div>
            <div className="p-5 border-t bg-gray-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCopyOpen(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDuplicateToChannels}
                disabled={copying}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg disabled:opacity-50"
              >
                {copying ? '복사 중…' : '복사 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
