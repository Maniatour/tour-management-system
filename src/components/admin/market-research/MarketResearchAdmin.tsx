'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import type { MarketCompetitor, MarketListing } from '@/lib/market-research/types'
import { MarketResearchRegisterSection } from './MarketResearchRegisterSection'
import { MarketResearchOtaCompareSection } from './MarketResearchOtaCompareSection'
import { MarketResearchCompetitorCompareSection } from './MarketResearchCompetitorCompareSection'
import { MarketResearchHistorySection } from './MarketResearchHistorySection'
import { MarketResearchPriceEntryForm } from './MarketResearchPriceEntryForm'
import { MarketResearchCompetitorEditor } from './MarketResearchCompetitorEditor'
import { MarketResearchListingEditor, type ListingDraft } from './MarketResearchListingEditor'
import type { MarketResearchBundle } from './helpers'

type TabId = 'register' | 'ota' | 'competitor' | 'history' | 'entry'

const emptyBundle: MarketResearchBundle = {
  today: '',
  competitors: [],
  listings: [],
  snapshots: [],
  alerts: [],
  products: [],
  channels: [],
  ourPrices: {},
}

export default function MarketResearchAdmin() {
  const params = useParams()
  const isKo = params?.locale !== 'en'
  const [bundle, setBundle] = useState<MarketResearchBundle>(emptyBundle)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('register')
  const [editingCompetitor, setEditingCompetitor] = useState<MarketCompetitor | null | 'new'>(null)
  const [editingListing, setEditingListing] = useState<MarketListing | null | 'new'>(null)
  const [newListingCompetitorId, setNewListingCompetitorId] = useState<string | undefined>()

  const load = useCallback(async () => {
    const res = await fetchApiWithAuth('/api/admin/market-research')
    const json = (await res.json()) as MarketResearchBundle & { ok?: boolean; error?: string }
    if (!res.ok || json.ok === false) throw new Error(json.error || 'load failed')
    setBundle(json)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load()
      .catch((err) => toast.error(err instanceof Error ? err.message : 'load failed'))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [load])

  const post = async (body: Record<string, unknown>) => {
    const res = await fetchApiWithAuth('/api/admin/market-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await res.json()) as { ok?: boolean; error?: string }
    if (!res.ok || json.ok === false) throw new Error(json.error || 'save failed')
    await load()
    return json
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'register', label: isKo ? '등록' : 'Setup' },
    { id: 'ota', label: isKo ? 'OTA별 비교' : 'By OTA' },
    { id: 'competitor', label: isKo ? '경쟁사별 비교' : 'By competitor' },
    { id: 'history', label: isKo ? '이력' : 'History' },
    { id: 'entry', label: isKo ? '오늘 가격' : 'Enter price' },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">
            {isKo ? '시장조사' : 'Market research'}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {isKo
              ? '경쟁사 OTA 리스팅 기준가를 Lower / Antelope X, 전체포함가와 판매가+불포함으로 기록하고 자사 가격과 비교합니다.'
              : 'Track competitor OTA from-prices by canyon and inclusive vs sale-plus-excluded, then compare with ours.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {isKo ? '새로고침' : 'Refresh'}
          </Button>
          <Button
            className="h-11 rounded-xl"
            onClick={async () => {
              try {
                await post({ action: 'fetch' })
                toast.success(isKo ? '수집을 실행했습니다.' : 'Fetch started.')
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'fetch failed')
              }
            }}
          >
            {isKo ? '전체 수집' : 'Fetch all'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? 'default' : 'outline'}
            className="h-11 rounded-xl"
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {isKo ? '불러오는 중' : 'Loading'}
        </div>
      ) : (
        <>
          {editingCompetitor !== null && (
            <MarketResearchCompetitorEditor
              competitor={editingCompetitor === 'new' ? null : editingCompetitor}
              isKo={isKo}
              onCancel={() => setEditingCompetitor(null)}
              onSave={async (input) => {
                if (editingCompetitor === 'new') {
                  await post({ action: 'create_competitor', ...input })
                } else {
                  await post({ action: 'update_competitor', id: editingCompetitor.id, ...input })
                }
                setEditingCompetitor(null)
                toast.success(isKo ? '저장했습니다.' : 'Saved.')
              }}
            />
          )}
          {editingListing !== null && (
            <MarketResearchListingEditor
              listing={editingListing === 'new' ? null : editingListing}
              defaultCompetitorId={newListingCompetitorId}
              competitors={bundle.competitors}
              products={bundle.products}
              channels={bundle.channels}
              isKo={isKo}
              onCancel={() => setEditingListing(null)}
              onSave={async (draft: ListingDraft) => {
                const payload = {
                  competitorId: draft.competitorId,
                  otaPlatform: draft.otaPlatform,
                  listingUrl: draft.listingUrl,
                  listingTitle: draft.listingTitle,
                  mappedProductId: draft.mappedProductId || null,
                  mappedChannelId: draft.mappedChannelId || null,
                  hasLower: draft.hasLower,
                  hasAntelopeX: draft.hasAntelopeX,
                  hasAllInclusive: draft.hasAllInclusive,
                  hasSalePlusExcluded: draft.hasSalePlusExcluded,
                  watchEnabled: draft.watchEnabled,
                  durationNote: draft.durationNote,
                  pickupNote: draft.pickupNote,
                  groupSizeNote: draft.groupSizeNote,
                  cancellationNote: draft.cancellationNote,
                  languageNote: draft.languageNote,
                  itineraryNote: draft.itineraryNote,
                  diffNotes: draft.diffNotes,
                }
                if (editingListing === 'new') {
                  await post({ action: 'create_listing', ...payload })
                } else {
                  await post({ action: 'update_listing', id: editingListing.id, ...payload })
                }
                setEditingListing(null)
                toast.success(isKo ? '저장했습니다.' : 'Saved.')
              }}
            />
          )}
          {tab === 'register' && (
            <MarketResearchRegisterSection
              bundle={bundle}
              isKo={isKo}
              onAddCompetitor={() => setEditingCompetitor('new')}
              onEditCompetitor={setEditingCompetitor}
              onDeleteCompetitor={async (id) => {
                if (!window.confirm(isKo ? '이 경쟁사와 리스팅을 삭제할까요?' : 'Delete this competitor and its listings?')) return
                await post({ action: 'delete_competitor', id })
              }}
              onAddListing={(competitorId) => {
                setNewListingCompetitorId(competitorId)
                setEditingListing('new')
              }}
              onEditListing={setEditingListing}
              onDeleteListing={async (id) => {
                if (!window.confirm(isKo ? '이 리스팅을 삭제할까요?' : 'Delete this listing?')) return
                await post({ action: 'delete_listing', id })
              }}
              onFetchOne={async (id) => {
                await post({ action: 'fetch_one', listingId: id })
                toast.success(isKo ? '수집을 실행했습니다.' : 'Fetched.')
              }}
            />
          )}
          {tab === 'ota' && <MarketResearchOtaCompareSection bundle={bundle} isKo={isKo} />}
          {tab === 'competitor' && <MarketResearchCompetitorCompareSection bundle={bundle} isKo={isKo} />}
          {tab === 'history' && <MarketResearchHistorySection bundle={bundle} isKo={isKo} />}
          {tab === 'entry' && (
            <MarketResearchPriceEntryForm
              bundle={bundle}
              isKo={isKo}
              onSave={async (input) => {
                await post({ action: 'save_snapshot', ...input })
                toast.success(isKo ? '가격을 저장했습니다.' : 'Price saved.')
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
