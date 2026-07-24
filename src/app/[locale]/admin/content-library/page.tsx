'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  HelpCircle,
  Library,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
} from 'lucide-react'
import AdminEditLocaleToggle from '@/components/admin/AdminEditLocaleToggle'
import ContentLibraryLocaleBadges from '@/components/admin/ContentLibraryLocaleBadges'
import FaqLibraryManagerPanel from '@/components/admin/FaqLibraryManagerPanel'
import WhyChooseLibraryManagerPanel from '@/components/admin/WhyChooseLibraryManagerPanel'
import TourAudienceLibraryManagerPanel from '@/components/admin/TourAudienceLibraryManagerPanel'
import LightRichEditor from '@/components/LightRichEditor'
import {
  getAdminEditLocaleLabel,
  normalizeAdminEditLocale,
  type AdminEditLocale,
} from '@/lib/adminEditLocales'
import { supabase } from '@/lib/supabase'
import {
  REUSABLE_DETAIL_KIND_LABELS,
  REUSABLE_DETAIL_KINDS,
  REUSABLE_OPERATION_KINDS,
  REUSABLE_POLICY_KINDS,
  buildDetailLibraryPayload,
  detailDraftFromLibraryItem,
  fetchDetailContentLibrary,
  getDetailContentFilledLocales,
  type DetailContentLibraryItem,
  type ReusableDetailKind,
} from '@/lib/reusableContentLibrary'
import type { SiteLocale } from '@/lib/siteLocales'

type TabId = 'faq' | 'why-choose' | 'tour-audience' | 'operation' | 'policy'

const OPERATION_KINDS: ReusableDetailKind[] = [...REUSABLE_OPERATION_KINDS]
const POLICY_KINDS: ReusableDetailKind[] = [...REUSABLE_POLICY_KINDS]

type DetailDraft = {
  name: string
  kind: ReusableDetailKind
  bodyByLocale: Partial<Record<SiteLocale, string>>
}

function emptyDetailDraft(kind: ReusableDetailKind): DetailDraft {
  return { name: '', kind, bodyByLocale: {} }
}

export default function AdminContentLibraryPage() {
  const [tab, setTab] = useState<TabId>('faq')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [details, setDetails] = useState<DetailContentLibraryItem[]>([])
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null)

  const [detailDraft, setDetailDraft] = useState<DetailDraft>(
    emptyDetailDraft('tour_operation_info')
  )
  const [editLocale, setEditLocale] = useState<AdminEditLocale>('ko')

  const loadAll = useCallback(async () => {
    if (tab === 'faq' || tab === 'why-choose' || tab === 'tour-audience') {
      setLoading(false)
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const detailRows = await fetchDetailContentLibrary(supabase as never, {
        activeOnly: false,
      })
      setDetails(detailRows)
    } catch (error) {
      console.error(error)
      setMessage('라이브러리를 불러오지 못했습니다. 마이그레이션 적용 여부를 확인하세요.')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const kindFilter = tab === 'operation' ? OPERATION_KINDS : POLICY_KINDS
  const filteredDetails = useMemo(() => {
    const q = search.trim().toLowerCase()
    return details.filter((row) => {
      if (row.is_active === false) return false
      if (!kindFilter.includes(row.kind)) return false
      if (!q) return true
      const hay = `${row.name} ${row.body} ${row.body_en || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [details, kindFilter, search])

  const selectDetail = (item: DetailContentLibraryItem) => {
    setSelectedDetailId(item.id)
    setDetailDraft(detailDraftFromLibraryItem(item))
  }

  const startNewDetail = (kind: ReusableDetailKind) => {
    setSelectedDetailId(null)
    setDetailDraft(emptyDetailDraft(kind))
  }

  const currentDetailBody = detailDraft.bodyByLocale[editLocale] ?? ''
  const localeLabel = getAdminEditLocaleLabel(editLocale)

  const saveDetail = async () => {
    const hasAnyLocale = Object.values(detailDraft.bodyByLocale).some((v) => v?.trim())
    if (!hasAnyLocale) {
      setMessage('최소 한 언어로 내용을 입력해 주세요.')
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const payload = {
        ...buildDetailLibraryPayload({
          kind: detailDraft.kind,
          name: detailDraft.name,
          bodyByLocale: detailDraft.bodyByLocale,
        }),
        updated_at: new Date().toISOString(),
      }

      if (selectedDetailId) {
        const { error } = await supabase
          .from('detail_content_library')
          .update(payload as never)
          .eq('id', selectedDetailId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('detail_content_library')
          .insert([payload] as never)
          .select('*')
          .single()
        if (error) throw error
        setSelectedDetailId(String((data as { id: string }).id))
      }
      setMessage('상세 콘텐츠 라이브러리에 저장했습니다. (모든 언어가 하나의 항목에 저장됩니다)')
      await loadAll()
    } catch (error) {
      console.error(error)
      setMessage('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const deactivateDetail = async (id: string) => {
    if (!confirm('이 항목을 라이브러리에서 비활성화할까요?')) return
    await supabase
      .from('detail_content_library')
      .update({ is_active: false } as never)
      .eq('id', id)
    if (selectedDetailId === id) startNewDetail(detailDraft.kind)
    await loadAll()
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Library className="h-6 w-6 text-primary" />
          재사용 콘텐츠 라이브러리
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          FAQ · Why choose Mania Tour · 추천 대상 · 투어 운영 안내 · 정책을 한 항목에 여러 언어로 저장하고, 상품 편집에서 연결해 재사용합니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'faq' as const, label: 'FAQ', icon: HelpCircle },
            { id: 'why-choose' as const, label: 'Why choose', icon: Library },
            { id: 'tour-audience' as const, label: '추천 대상', icon: Library },
            { id: 'operation' as const, label: '운영 안내', icon: Library },
            { id: 'policy' as const, label: '정책', icon: Library },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id)
              setSearch('')
              setMessage(null)
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
              tab === item.id
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="relative">
        {tab !== 'faq' && tab !== 'why-choose' && tab !== 'tour-audience' ? (
          <>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름·내용 검색…"
              className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm"
            />
          </>
        ) : null}
      </div>

      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}

      {loading && tab !== 'faq' && tab !== 'why-choose' && tab !== 'tour-audience' ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          로딩 중…
        </div>
      ) : tab === 'faq' ? (
        <FaqLibraryManagerPanel />
      ) : tab === 'why-choose' ? (
        <WhyChooseLibraryManagerPanel />
      ) : tab === 'tour-audience' ? (
        <TourAudienceLibraryManagerPanel />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-2 rounded-xl border border-border/60 bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                {tab === 'operation' ? '운영 안내' : '정책'} 목록
              </h2>
              <button
                type="button"
                onClick={() =>
                  startNewDetail(
                    tab === 'operation' ? 'pickup_drop_info' : 'cancellation_policy'
                  )
                }
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                새로 만들기
              </button>
            </div>
            <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
              {filteredDetails.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectDetail(item)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedDetailId === item.id
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {REUSABLE_DETAIL_KIND_LABELS[item.kind]}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 font-medium">{item.name}</div>
                    <ContentLibraryLocaleBadges locales={getDetailContentFilledLocales(item)} />
                  </div>
                </button>
              ))}
              {filteredDetails.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">항목이 없습니다.</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                {selectedDetailId ? '항목 편집' : '새 항목'}
              </h2>
              <AdminEditLocaleToggle
                value={editLocale}
                onChange={(next) => setEditLocale(normalizeAdminEditLocale(next))}
                groupLabel="편집 언어"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              언어를 바꿔가며 내용을 입력하면 하나의 라이브러리 항목에 모두 저장됩니다.
            </p>
            <label className="block space-y-1">
              <span className="text-xs font-medium">종류</span>
              <select
                value={detailDraft.kind}
                onChange={(e) =>
                  setDetailDraft((prev) => ({
                    ...prev,
                    kind: e.target.value as ReusableDetailKind,
                  }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              >
                {(tab === 'operation' ? OPERATION_KINDS : POLICY_KINDS).map((kind) => (
                  <option key={kind} value={kind}>
                    {REUSABLE_DETAIL_KIND_LABELS[kind]}
                  </option>
                ))}
                {selectedDetailId &&
                !kindFilter.includes(detailDraft.kind) &&
                REUSABLE_DETAIL_KINDS.includes(detailDraft.kind) ? (
                  <option value={detailDraft.kind}>
                    {REUSABLE_DETAIL_KIND_LABELS[detailDraft.kind]}
                  </option>
                ) : null}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">관리용 이름</span>
              <input
                value={detailDraft.name}
                onChange={(e) => setDetailDraft((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                placeholder="예: 그랜드캐년 공통 취소정책"
              />
            </label>
            <div className="space-y-1">
              <span className="text-xs font-medium">내용 ({localeLabel})</span>
              <LightRichEditor
                value={currentDetailBody}
                onChange={(value) =>
                  setDetailDraft((prev) => ({
                    ...prev,
                    bodyByLocale: {
                      ...prev.bodyByLocale,
                      [editLocale]: value ?? '',
                    },
                  }))
                }
                height={280}
                enableResize
              />
            </div>
            <ContentLibraryLocaleBadges
              locales={getDetailContentFilledLocales({
                content_i18n: { body: detailDraft.bodyByLocale },
              })}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveDetail()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                저장
              </button>
              {selectedDetailId ? (
                <button
                  type="button"
                  onClick={() => void deactivateDetail(selectedDetailId)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  <Trash2 className="h-4 w-4" />
                  비활성화
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
