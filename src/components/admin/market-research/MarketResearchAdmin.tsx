'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { History, Loader2, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { labelForOta, otaChoicesForBoard } from '@/lib/market-research/otaChannels'
import {
  UNMAPPED_PRODUCT_ID,
  buildOurPricingBoardColumns,
  buildPricingBoardColumns,
  competitorsForProduct,
  listingsForProduct,
  otasForProduct,
  pricingBoardRows,
  toggleAllOrItem,
} from '@/lib/market-research/pricingBoard'
import {
  arrangeBoardColumns,
  EMPTY_BOARD_LAYOUT,
  moveListingOrder,
  readBoardLayouts,
  writeBoardLayouts,
  type BoardLayoutPrefs,
} from '@/lib/market-research/boardLayout'
import type { MarketBadgeCatalogItem, MarketListing, MarketOtaPlatform } from '@/lib/market-research/types'
import { compareItemDefsFromCatalog, inclusionHasExcluded } from '@/lib/market-research/excludedItems'
import { MarketResearchCompareItemsManager } from './MarketResearchCompareItemsManager'
import { MarketResearchCompetitorManager } from './MarketResearchCompetitorManager'
import { MarketResearchDialog } from './MarketResearchDialog'
import { MarketResearchFilterChips } from './MarketResearchFilterChips'
import { MarketResearchFocusProductModal } from './MarketResearchFocusProductModal'
import { MarketResearchHistorySection } from './MarketResearchHistorySection'
import { MarketResearchListingEditor, type ListingDraft } from './MarketResearchListingEditor'
import { MarketResearchOurOfferEditor } from './MarketResearchOurOfferEditor'
import { MarketResearchPriceEntryForm } from './MarketResearchPriceEntryForm'
import { MarketResearchPricingBoard } from './MarketResearchPricingBoard'
import { MarketResearchRegisterSection } from './MarketResearchRegisterSection'
import { productLabel, type MarketResearchBundle } from './helpers'

type ModalId = 'competitor' | 'listing' | 'price' | 'products' | 'history' | 'listings' | 'compareItems' | 'ourOffer' | null

const emptyBundle: MarketResearchBundle = {
  today: '',
  competitors: [],
  listings: [],
  snapshots: [],
  alerts: [],
  products: [],
  channels: [],
  focusProducts: [],
  badges: [],
  compareItems: [],
  ourOffers: [],
  ourPrices: {},
  ourPlatformPrices: {},
}

export default function MarketResearchAdmin() {
  const params = useParams()
  const isKo = params?.locale !== 'en'
  const [bundle, setBundle] = useState<MarketResearchBundle>(emptyBundle)
  const [loading, setLoading] = useState(true)
  const [productId, setProductId] = useState('')
  const [selectedOtas, setSelectedOtas] = useState<MarketOtaPlatform[]>([])
  const [selectedCompetitorIds, setSelectedCompetitorIds] = useState<string[]>([])
  const [modal, setModal] = useState<ModalId>(null)
  const [editingListing, setEditingListing] = useState<MarketListing | null | 'new'>('new')
  const [listingCompetitorId, setListingCompetitorId] = useState<string | undefined>()
  const [priceListingId, setPriceListingId] = useState<string | undefined>()
  const [ourOfferPlatform, setOurOfferPlatform] = useState<MarketOtaPlatform | null>(null)
  const [boardLayouts, setBoardLayouts] = useState<Record<string, BoardLayoutPrefs>>({})
  const [showHiddenListings, setShowHiddenListings] = useState(false)

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

  useEffect(() => {
    setBoardLayouts(readBoardLayouts())
  }, [])

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

  const productTabs = useMemo(() => {
    const tabs = bundle.focusProducts.map((row) => {
      const product = bundle.products.find((item) => item.id === row.product_id)
      return { id: row.product_id, label: productLabel(product, isKo) || row.product_id }
    })
    if (bundle.listings.some((row) => !row.mapped_product_id)) {
      tabs.push({ id: UNMAPPED_PRODUCT_ID, label: isKo ? '미매핑' : 'Unmapped' })
    }
    return tabs
  }, [bundle.focusProducts, bundle.products, bundle.listings, isKo])

  const activeProductId = productTabs.some((tab) => tab.id === productId)
    ? productId
    : productTabs[0]?.id || ''

  const productListings = listingsForProduct(bundle.listings, activeProductId)
  const productOtas = otasForProduct(bundle.listings, activeProductId)
  const otaChoices = otaChoicesForBoard(bundle.channels, productListings, isKo)
  const productCompetitors = competitorsForProduct(
    bundle.listings,
    bundle.competitors,
    activeProductId
  )
  const otaFilter = selectedOtas.filter((platform) =>
    otaChoices.some((choice) => choice.id === platform)
  )
  const competitorFilter = selectedCompetitorIds.filter((id) =>
    productCompetitors.some((row) => row.id === id)
  )
  const activeOta = otaFilter[0] || productOtas[0] || otaChoices[0]?.id || 'getyourguide'

  const columns = useMemo(() => {
    if (!activeProductId) return []
    const compareItems = compareItemDefsFromCatalog(bundle.compareItems)
    const filter = {
      otas: otaFilter,
      competitorIds: competitorFilter,
      otaLabel: (platform: MarketOtaPlatform) => labelForOta(platform, bundle.channels, isKo),
      compareItems,
    }
    const ours =
      activeProductId === UNMAPPED_PRODUCT_ID
        ? []
        : buildOurPricingBoardColumns({
            productId: activeProductId,
            listings: bundle.listings,
            offers: bundle.ourOffers,
            overlays: bundle.ourPlatformPrices,
            otas: otaFilter,
            fallbackOtas: otaChoices.map((choice) => choice.id),
            otaLabel: filter.otaLabel,
            compareItems,
            oursLabel: isKo ? '자사' : 'Kovegas',
          })
    return arrangeBoardColumns(
      [
        ...ours,
        ...buildPricingBoardColumns(
          bundle.listings,
          bundle.competitors,
          bundle.snapshots,
          activeProductId,
          filter
        ),
      ],
      boardLayouts[activeProductId] || EMPTY_BOARD_LAYOUT
    )
  }, [
    bundle.listings,
    bundle.competitors,
    bundle.snapshots,
    bundle.ourOffers,
    bundle.ourPlatformPrices,
    bundle.compareItems,
    bundle.channels,
    activeProductId,
    otaFilter,
    competitorFilter,
    isKo,
    boardLayouts,
  ])
  const rows = useMemo(
    () => pricingBoardRows(columns, isKo, compareItemDefsFromCatalog(bundle.compareItems)),
    [columns, isKo, bundle.compareItems]
  )

  const boardPrefs = boardLayouts[activeProductId] || EMPTY_BOARD_LAYOUT
  const saveBoardLayout = (next: BoardLayoutPrefs) => {
    if (!activeProductId) return
    setBoardLayouts((prev) => {
      const layouts = { ...prev, [activeProductId]: next }
      writeBoardLayouts(layouts)
      return layouts
    })
  }
  const hiddenListingLabels = boardPrefs.hidden.flatMap((id) => {
    const listing = bundle.listings.find((row) => row.id === id)
    if (!listing) return []
    const name =
      bundle.competitors.find((row) => row.id === listing.competitor_id)?.name ||
      listing.listing_title ||
      id
    return [{ id, label: `${name} · ${labelForOta(listing.ota_platform, bundle.channels, isKo)}` }]
  })

  const closeModal = () => {
    setModal(null)
    setPriceListingId(undefined)
    setListingCompetitorId(undefined)
    setOurOfferPlatform(null)
  }

  return (
    <div className="market-research-page space-y-6 px-4 lg:px-0">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">
              {isKo ? '시장조사' : 'Market research'}
            </h1>
            <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
              {productTabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeProductId === tab.id ? 'default' : 'ghost'}
                  className="h-10 rounded-xl"
                  onClick={() => {
                    setProductId(tab.id)
                    setSelectedOtas([])
                    setSelectedCompetitorIds([])
                  }}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            <Button variant="outline" className="h-10 rounded-xl" onClick={() => setModal('products')}>
              <Plus className="mr-1 h-4 w-4" />
              {isKo ? '상품' : 'Product'}
            </Button>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setModal('competitor')}>
              {isKo ? '경쟁사' : 'Competitors'}
            </Button>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => { setEditingListing('new'); setListingCompetitorId(undefined); setModal('listing') }}>
              {isKo ? '리스팅 추가' : 'Add listing'}
            </Button>
            <Button className="h-11 rounded-xl" onClick={() => { setPriceListingId(undefined); setModal('price') }}>
              {isKo ? '오늘 가격' : 'Today’s price'}
            </Button>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setModal('listings')}>
              {isKo ? '등록 관리' : 'Manage'}
            </Button>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setModal('history')}>
              <History className="mr-1 h-4 w-4" />
              {isKo ? '이력' : 'History'}
            </Button>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => load()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {isKo ? '새로고침' : 'Refresh'}
            </Button>
            <Button
              variant="outline"
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
        <p className="max-w-2xl text-muted-foreground">
          {isKo
            ? '상품별로 경쟁사 표시가격, Lower / X 판매가, 불포함 항목, 최종 고객 결제가를 한 화면에서 비교합니다.'
            : 'Compare listed From prices, Lower / X sale prices, excluded fees, and what the customer pays.'}
        </p>
      </div>

      <div className="space-y-3">
        <MarketResearchFilterChips
          allLabel={isKo ? '전체' : 'All'}
          selected={otaFilter}
          onSelectAll={() => setSelectedOtas([])}
          onToggle={(id) =>
            setSelectedOtas(toggleAllOrItem(otaFilter, id as MarketOtaPlatform))
          }
          options={otaChoices.map((choice) => ({
            id: choice.id,
            label: choice.label,
            count: productListings.filter((row) => row.ota_platform === choice.id).length,
          }))}
        />
        {productCompetitors.length > 0 ? (
          <MarketResearchFilterChips
            allLabel={isKo ? '전체 경쟁사' : 'All competitors'}
            selected={competitorFilter}
            onSelectAll={() => setSelectedCompetitorIds([])}
            onToggle={(id) => setSelectedCompetitorIds(toggleAllOrItem(competitorFilter, id))}
            options={productCompetitors.map((row) => ({
              id: row.id,
              label: row.name,
              count: productListings.filter((listing) => listing.competitor_id === row.id).length,
            }))}
          />
        ) : null}
        {hiddenListingLabels.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-xl"
              onClick={() => setShowHiddenListings((open) => !open)}
              aria-expanded={showHiddenListings}
            >
              {isKo ? `숨긴 리스팅 ${hiddenListingLabels.length}` : `Hidden ${hiddenListingLabels.length}`}
            </Button>
            {showHiddenListings
              ? hiddenListingLabels.map((row) => (
                  <Button
                    key={row.id}
                    type="button"
                    variant="ghost"
                    className="h-9 rounded-xl"
                    onClick={() =>
                      saveBoardLayout({
                        ...boardPrefs,
                        hidden: boardPrefs.hidden.filter((id) => id !== row.id),
                      })
                    }
                  >
                    {row.label}
                    <span className="ml-1 text-xs text-muted-foreground">{isKo ? '표시' : 'Show'}</span>
                  </Button>
                ))
              : null}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {isKo ? '불러오는 중' : 'Loading'}
        </div>
      ) : (
        <MarketResearchPricingBoard
          columns={columns}
          rows={rows}
          isKo={isKo}
          favoriteIds={boardPrefs.favorites}
          onToggleFavorite={(id) => {
            const favorite = boardPrefs.favorites.includes(id)
            if (favorite) {
              saveBoardLayout({
                ...boardPrefs,
                favorites: boardPrefs.favorites.filter((item) => item !== id),
              })
              return
            }
            const visibleIds = columns
              .filter((column) => column.kind === 'competitor')
              .map((column) => column.columnId)
              .filter((item) => item !== id)
            saveBoardLayout({
              ...boardPrefs,
              favorites: [...boardPrefs.favorites, id],
              order: [id, ...visibleIds],
            })
          }}
          onMoveListing={(id, direction) => {
            const visibleIds = columns
              .filter((column) => column.kind === 'competitor')
              .map((column) => column.columnId)
            saveBoardLayout({
              ...boardPrefs,
              order: moveListingOrder(visibleIds, id, direction),
            })
          }}
          onHideListing={(id) => {
            saveBoardLayout({
              ...boardPrefs,
              hidden: boardPrefs.hidden.includes(id) ? boardPrefs.hidden : [...boardPrefs.hidden, id],
            })
          }}
          onEditListing={(row) => {
            setEditingListing(row)
            setModal('listing')
          }}
          onDeleteListing={async (id) => {
            if (!window.confirm(isKo ? '이 리스팅을 삭제할까요?' : 'Delete this listing?')) return
            await post({ action: 'delete_listing', id })
          }}
          onEnterPrice={(id) => {
            setPriceListingId(id)
            setModal('price')
          }}
          onFetchOne={async (id) => {
            const json = (await post({ action: 'fetch_one', listingId: id })) as {
              summary?: { saved?: number; failed?: number }
            }
            if ((json.summary?.saved || 0) > 0) {
              toast.success(isKo ? 'From 가격을 수집했습니다.' : 'From price saved.')
              return
            }
            toast.error(isKo ? '자동 수집이 실패했습니다. 오늘 가격에서 입력하세요.' : 'Fetch failed. Enter prices manually.')
          }}
          onManageCompareItems={() => setModal('compareItems')}
          onEditOurs={(platform) => {
            setOurOfferPlatform(platform)
            setModal('ourOffer')
          }}
        />
      )}

      <MarketResearchDialog
        open={modal === 'competitor'}
        title={isKo ? '경쟁사' : 'Competitors'}
        onClose={closeModal}
      >
        {modal === 'competitor' ? (
          <MarketResearchCompetitorManager
            competitors={bundle.competitors}
            listingCountById={Object.fromEntries(
              bundle.competitors.map((row) => [
                row.id,
                bundle.listings.filter((listing) => listing.competitor_id === row.id).length,
              ])
            )}
            isKo={isKo}
            onSave={async (input, existing) => {
              if (existing) {
                await post({ action: 'update_competitor', id: existing.id, ...input })
              } else {
                await post({ action: 'create_competitor', ...input })
              }
              toast.success(isKo ? '저장했습니다.' : 'Saved.')
            }}
            onDelete={async (id) => {
              await post({ action: 'delete_competitor', id })
              toast.success(isKo ? '삭제했습니다.' : 'Deleted.')
            }}
          />
        ) : null}
      </MarketResearchDialog>

      <MarketResearchDialog
        open={modal === 'listing'}
        title={editingListing === 'new' || !editingListing ? (isKo ? '리스팅 추가' : 'Add listing') : isKo ? '리스팅 수정' : 'Edit listing'}
        onClose={closeModal}
        wide
      >
        {modal === 'listing' ? (
          <MarketResearchListingEditor
            listing={editingListing === 'new' ? null : editingListing}
            defaultCompetitorId={listingCompetitorId || bundle.competitors[0]?.id}
            defaultProductId={activeProductId === UNMAPPED_PRODUCT_ID ? undefined : activeProductId}
            defaultOtaPlatform={activeOta}
            snapshots={bundle.snapshots}
            competitors={bundle.competitors}
            products={bundle.products}
            channels={bundle.channels}
            compareItems={compareItemDefsFromCatalog(bundle.compareItems)}
            isKo={isKo}
            onCancel={closeModal}
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
                inclusionItems: draft.inclusionItems,
              }
              const json = (
                editingListing === 'new' || !editingListing
                  ? await post({ action: 'create_listing', ...payload })
                  : await post({ action: 'update_listing', id: editingListing.id, ...payload })
              ) as { listing?: { id: string } }
              const listingId =
                (editingListing !== 'new' && editingListing?.id) || json.listing?.id
              const fromPrice = draft.fromPrice.trim() === '' ? null : Number(draft.fromPrice)
              const lowerSale = draft.lowerSale.trim() === '' ? null : Number(draft.lowerSale)
              const antelopeXSale = draft.antelopeXSale.trim() === '' ? null : Number(draft.antelopeXSale)
              if (
                listingId &&
                (fromPrice != null || lowerSale != null || antelopeXSale != null)
              ) {
                const allInclusive = !inclusionHasExcluded(draft.inclusionItems)
                const items = allInclusive
                  ? []
                  : draft.excludedItems.filter((item) => draft.inclusionItems[item.id] === 'excluded')
                await post({
                  action: 'save_today_prices',
                  listingId,
                  fromPrice,
                  lowerSale: draft.hasLower ? lowerSale : null,
                  antelopeXSale: draft.hasAntelopeX ? antelopeXSale : null,
                  lowerNotIncluded: allInclusive ? 0 : null,
                  antelopeXNotIncluded: allInclusive ? 0 : null,
                  lowerExcludedItems: items,
                  antelopeXExcludedItems: items,
                  offer: allInclusive ? 'all_inclusive' : 'sale_plus_excluded',
                  discountEnabled: draft.discountEnabled,
                  discountPercent: Number(draft.discountPercent) || 0,
                })
              }
              closeModal()
              toast.success(isKo ? '저장했습니다.' : 'Saved.')
            }}
          />
        ) : null}
      </MarketResearchDialog>

      <MarketResearchDialog
        open={modal === 'price'}
        title={isKo ? '오늘 가격' : 'Today’s price'}
        onClose={closeModal}
        wide
      >
        {modal === 'price' ? (
          <MarketResearchPriceEntryForm
            bundle={bundle}
            isKo={isKo}
            defaultListingId={priceListingId}
            onCreateBadge={async (label) => {
              const res = await fetchApiWithAuth('/api/admin/market-research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add_badge', label }),
              })
              const json = (await res.json()) as {
                ok?: boolean
                error?: string
                badge?: MarketBadgeCatalogItem
              }
              if (!res.ok || json.ok === false || !json.badge) {
                throw new Error(json.error || 'badge save failed')
              }
              const badge = json.badge
              setBundle((prev) => {
                if (prev.badges.some((row) => row.badge_id === badge.badge_id)) return prev
                return { ...prev, badges: [...prev.badges, badge] }
              })
              return badge.badge_id
            }}
            onSave={async (input) => {
              await post({ action: 'save_today_prices', ...input })
              await post({
                action: 'update_listing',
                id: input.listingId,
                inclusionItems: input.inclusionItems,
                hasAllInclusive: input.offer !== 'sale_plus_excluded',
                hasSalePlusExcluded: input.offer === 'sale_plus_excluded',
              })
              closeModal()
              toast.success(isKo ? '가격을 저장했습니다.' : 'Price saved.')
            }}
          />
        ) : null}
      </MarketResearchDialog>

      <MarketResearchDialog
        open={modal === 'products'}
        title={isKo ? '시장조사 상품' : 'Research products'}
        onClose={closeModal}
      >
        <MarketResearchFocusProductModal
          products={bundle.products}
          focusProducts={bundle.focusProducts}
          isKo={isKo}
          onAdd={async (id) => {
            await post({ action: 'add_focus_product', productId: id })
            toast.success(isKo ? '상품을 추가했습니다.' : 'Product added.')
          }}
          onDelete={async (id) => {
            await post({ action: 'delete_focus_product', productId: id })
            toast.success(isKo ? '상품 탭을 제거했습니다.' : 'Product tab removed.')
          }}
        />
      </MarketResearchDialog>

      <MarketResearchDialog
        open={modal === 'history'}
        title={isKo ? '가격 이력' : 'Price history'}
        onClose={closeModal}
        wide
      >
        {modal === 'history' ? <MarketResearchHistorySection bundle={bundle} isKo={isKo} /> : null}
      </MarketResearchDialog>

      <MarketResearchDialog
        open={modal === 'listings'}
        title={isKo ? '등록 관리' : 'Listings'}
        onClose={closeModal}
        wide
      >
        {modal === 'listings' ? (
          <MarketResearchRegisterSection
            bundle={bundle}
            isKo={isKo}
            onAddCompetitor={() => setModal('competitor')}
            onEditCompetitor={() => setModal('competitor')}
            onDeleteCompetitor={async (id) => {
              if (!window.confirm(isKo ? '이 경쟁사와 리스팅을 삭제할까요?' : 'Delete this competitor and its listings?')) return
              await post({ action: 'delete_competitor', id })
            }}
            onAddListing={(competitorId) => {
              setEditingListing('new')
              setListingCompetitorId(competitorId)
              setModal('listing')
            }}
            onEditListing={(row) => { setEditingListing(row); setModal('listing') }}
            onDeleteListing={async (id) => {
              if (!window.confirm(isKo ? '이 리스팅을 삭제할까요?' : 'Delete this listing?')) return
              await post({ action: 'delete_listing', id })
            }}
            onFetchOne={async (id) => {
              await post({ action: 'fetch_one', listingId: id })
            }}
          />
        ) : null}
      </MarketResearchDialog>

      <MarketResearchDialog
        open={modal === 'compareItems'}
        title={isKo ? '불포함 항목' : 'Not-included items'}
        onClose={closeModal}
      >
        {modal === 'compareItems' ? (
          <MarketResearchCompareItemsManager
            items={bundle.compareItems}
            isKo={isKo}
            onAdd={async (label) => {
              await post({ action: 'add_compare_item', label })
              toast.success(isKo ? '항목을 추가했습니다.' : 'Item added.')
            }}
            onDelete={async (itemId) => {
              await post({ action: 'delete_compare_item', itemId })
              toast.success(isKo ? '항목을 삭제했습니다.' : 'Item removed.')
            }}
          />
        ) : null}
      </MarketResearchDialog>

      <MarketResearchDialog
        open={modal === 'ourOffer'}
        title={isKo ? '자사 채널 설정' : 'Our channel settings'}
        wide
        onClose={closeModal}
      >
        {modal === 'ourOffer' && ourOfferPlatform && activeProductId && activeProductId !== UNMAPPED_PRODUCT_ID ? (
          <MarketResearchOurOfferEditor
            bundle={bundle}
            productId={activeProductId}
            otaPlatform={ourOfferPlatform}
            isKo={isKo}
            onCancel={closeModal}
            onSave={async (input) => {
              await post({ action: 'save_our_offer', ...input })
              closeModal()
              toast.success(isKo ? '자사 채널 설정을 저장했습니다.' : 'Our channel settings saved.')
            }}
          />
        ) : null}
      </MarketResearchDialog>
    </div>
  )
}
