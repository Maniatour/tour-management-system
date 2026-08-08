'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Hash,
  Loader2,
  Search,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import AdminPageHubManualButton from '@/components/admin/AdminPageHubManualButton'
import ProductCodeBuilderConfigPanel from '@/components/admin/ProductCodeBuilderConfigPanel'
import ProductCodeBuilderRows from '@/components/admin/ProductCodeBuilderRows'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import {
  createDefaultProductCodeBuilderConfig,
  fetchProductCodeBuilderConfig,
  flattenConfigSegments,
  getBuilderGroupOrder,
  saveProductCodeBuilderConfig,
  type ProductCodeBuilderConfigStored,
} from '@/lib/productCodeBuilderConfig'
import {
  builderRowsToCode,
  decodeProductCode,
  decodeToBuilderRows,
  normalizeProductCode,
  PRODUCT_CODE_MANUAL_SLUG,
  productCodeManualDocument,
  productCodeManualTitles,
  suggestProductCodeBuilderRows,
  validateProductCode,
  type ProductCodeBuilderRow,
} from '@/lib/productCodeSystem'

type Product = Database['public']['Tables']['products']['Row']

type ProductCodeManagementModalProps = {
  isOpen: boolean
  onClose: () => void
  products: Product[]
  onUpdate: (productId: string, productCode: string | null) => void
  locale: string
  initialProductId?: string | null
}

type ModalTab = 'products' | 'settings'

function productDisplayName(product: Product, locale: string): string {
  if (locale === 'en') return product.name_en || product.name || product.name_ko || product.id
  return product.name_ko || product.name || product.name_en || product.id
}

export default function ProductCodeManagementModal({
  isOpen,
  onClose,
  products,
  onUpdate,
  locale,
  initialProductId = null,
}: ProductCodeManagementModalProps) {
  const t = useTranslations('products.productCode')
  const isEn = locale === 'en'
  const { operatorId } = useOperatorOptional()

  const [activeTab, setActiveTab] = useState<ModalTab>('products')
  const [search, setSearch] = useState('')
  const [missingOnly, setMissingOnly] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftCode, setDraftCode] = useState('')
  const [builderRows, setBuilderRows] = useState<ProductCodeBuilderRow[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showManual, setShowManual] = useState(false)

  const [builderConfig, setBuilderConfig] = useState<ProductCodeBuilderConfigStored>(
    createDefaultProductCodeBuilderConfig()
  )
  const [savedBuilderConfig, setSavedBuilderConfig] = useState<ProductCodeBuilderConfigStored>(
    createDefaultProductCodeBuilderConfig()
  )
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)

  const runtimeSegments = useMemo(() => flattenConfigSegments(builderConfig), [builderConfig])
  const builderGroupOrder = useMemo(() => getBuilderGroupOrder(builderConfig), [builderConfig])
  const configDirty = useMemo(
    () => JSON.stringify(builderConfig) !== JSON.stringify(savedBuilderConfig),
    [builderConfig, savedBuilderConfig]
  )

  const resetEditor = useCallback(() => {
    setEditingId(null)
    setDraftCode('')
    setSaveError(null)
    setBuilderRows([])
  }, [])

  const loadBuilderConfig = useCallback(async () => {
    setConfigLoading(true)
    setConfigError(null)
    try {
      const config = await fetchProductCodeBuilderConfig(supabase, resolveOperatorId(operatorId))
      setBuilderConfig(config)
      setSavedBuilderConfig(config)
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : String(e))
    } finally {
      setConfigLoading(false)
    }
  }, [operatorId])

  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      setMissingOnly(false)
      resetEditor()
      setShowManual(false)
      setActiveTab('products')
      return
    }
    void loadBuilderConfig()
    if (initialProductId) {
      setEditingId(initialProductId)
    }
  }, [isOpen, initialProductId, resetEditor, loadBuilderConfig])

  const editingProduct = useMemo(
    () => products.find((p) => p.id === editingId) ?? null,
    [products, editingId]
  )

  useEffect(() => {
    if (!editingProduct) return
    const existing = normalizeProductCode(editingProduct.product_code)
    if (existing) {
      setDraftCode(existing)
      setBuilderRows(decodeToBuilderRows(existing, runtimeSegments))
    } else {
      const rows = suggestProductCodeBuilderRows(editingProduct, builderGroupOrder, builderConfig)
      setDraftCode(builderRowsToCode(rows))
      setBuilderRows(rows)
    }
    setSaveError(null)
  }, [editingProduct, runtimeSegments, builderGroupOrder, builderConfig])

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...products]
      .filter((p) => {
        if (missingOnly && normalizeProductCode(p.product_code)) return false
        if (!q) return true
        const name = productDisplayName(p, locale).toLowerCase()
        const code = normalizeProductCode(p.product_code).toLowerCase()
        return (
          name.includes(q) ||
          code.includes(q) ||
          (p.category ?? '').toLowerCase().includes(q) ||
          (p.sub_category ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => productDisplayName(a, locale).localeCompare(productDisplayName(b, locale), 'ko'))
  }, [products, search, missingOnly, locale])

  const stats = useMemo(() => {
    const withCode = products.filter((p) => normalizeProductCode(p.product_code)).length
    return { total: products.length, withCode, missing: products.length - withCode }
  }, [products])

  const validation = useMemo(
    () => validateProductCode(draftCode, products, editingId ?? undefined),
    [draftCode, products, editingId]
  )

  const decodedParts = useMemo(
    () => decodeProductCode(draftCode, runtimeSegments),
    [draftCode, runtimeSegments]
  )

  const applyBuilder = () => {
    setDraftCode(builderRowsToCode(builderRows))
  }

  const applySuggestion = () => {
    if (!editingProduct) return
    const rows = suggestProductCodeBuilderRows(editingProduct, builderGroupOrder, builderConfig)
    setDraftCode(builderRowsToCode(rows))
    setBuilderRows(rows)
  }

  const openEditor = (productId: string) => {
    setActiveTab('products')
    setEditingId(productId)
    setSaveError(null)
  }

  const handleSave = async () => {
    if (!editingId || !validation.valid) return
    setSaving(true)
    setSaveError(null)
    try {
      const { error } = await supabase
        .from('products')
        .update({ product_code: validation.normalized })
        .eq('id', editingId)
        .eq('operator_id', resolveOperatorId(operatorId))

      if (error) {
        if (error.code === '23505') {
          setSaveError(isEn ? 'This code is already in use.' : '이미 사용 중인 코드입니다.')
        } else {
          setSaveError(error.message)
        }
        return
      }

      onUpdate(editingId, validation.normalized)
      resetEditor()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleClearCode = async () => {
    if (!editingId) return
    if (!window.confirm(isEn ? 'Remove product code?' : '상품 코드를 삭제하시겠습니까?')) return
    setSaving(true)
    setSaveError(null)
    try {
      const { error } = await supabase
        .from('products')
        .update({ product_code: null })
        .eq('id', editingId)
        .eq('operator_id', resolveOperatorId(operatorId))

      if (error) {
        setSaveError(error.message)
        return
      }
      onUpdate(editingId, null)
      resetEditor()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBuilderConfig = async () => {
    setConfigSaving(true)
    setConfigError(null)
    try {
      const { error } = await saveProductCodeBuilderConfig(
        supabase,
        resolveOperatorId(operatorId),
        builderConfig
      )
      if (error) {
        setConfigError(error)
        return
      }
      setSavedBuilderConfig(builderConfig)
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : String(e))
    } finally {
      setConfigSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[min(92vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Hash className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
              <AdminPageHubManualButton
                slug={PRODUCT_CODE_MANUAL_SLUG}
                fallbackDoc={productCodeManualDocument}
                fallbackTitle={productCodeManualTitles}
                storageKey="product-code-manual-modal-v1"
                className="scale-90 origin-left"
              />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('stats', { total: stats.total, withCode: stats.withCode, missing: stats.missing })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-border px-4">
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'products'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('tabProducts')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings2 className="h-4 w-4" />
            {t('tabBuilderSettings')}
            {configDirty ? <span className="h-2 w-2 rounded-full bg-amber-500" /> : null}
          </button>
        </div>

        {activeTab === 'settings' ? (
          configLoading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('builderConfig.loading')}
            </div>
          ) : (
            <>
              {configError ? (
                <p className="mx-4 mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {configError}
                </p>
              ) : null}
              <ProductCodeBuilderConfigPanel
                config={builderConfig}
                onChange={setBuilderConfig}
                onSave={handleSaveBuilderConfig}
                onResetDefaults={() => setBuilderConfig(createDefaultProductCodeBuilderConfig())}
                saving={configSaving}
                locale={locale}
                dirty={configDirty}
              />
            </>
          )
        ) : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className={`flex min-h-0 flex-col border-border ${editingId ? 'lg:w-[42%] lg:border-r' : 'flex-1'}`}>
              <div className="shrink-0 space-y-3 border-b border-border p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    className="pl-9"
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={missingOnly}
                    onChange={(e) => setMissingOnly(e.target.checked)}
                    className="rounded border-border"
                  />
                  {t('missingOnly')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowManual((v) => !v)}
                  className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted"
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                  <span className="flex-1">{t('quickGuide')}</span>
                  {showManual ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                {showManual ? (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground space-y-2">
                    <p>{t('quickGuideBody')}</p>
                    <p className="font-medium text-foreground">{t('quickGuideBase')}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        { code: 'M', len: '1' },
                        { code: 'T', len: '1' },
                        { code: 'LV', len: '2' },
                        { code: 'GCT', len: '3' },
                        { code: '1N', len: '2' },
                      ].map(({ code, len }) => (
                        <span
                          key={code}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground"
                        >
                          {code}
                          <span className="font-sans font-normal text-muted-foreground">({len})</span>
                        </span>
                      ))}
                      <span className="text-[10px] font-medium text-muted-foreground">= 9</span>
                    </div>
                    <p className="text-[11px]">{t('quickGuideOptional')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['+LV', '+GUIDE', '+SUNRISE'].map((code) => (
                        <span
                          key={code}
                          className="rounded-md border border-dashed border-border/80 bg-background/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px]">{t('quickGuideExample')}</p>
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {filteredProducts.map((product) => {
                      const code = normalizeProductCode(product.product_code)
                      const isActive = editingId === product.id
                      return (
                        <li
                          key={product.id}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                            isActive ? 'bg-primary/5' : 'hover:bg-muted/40'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {productDisplayName(product, locale)}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {[product.category, product.sub_category].filter(Boolean).join(' · ') || '—'}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            {code ? (
                              <span className="inline-block rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                                {code}
                              </span>
                            ) : (
                              <span className="text-xs text-amber-600 font-medium">{t('noCode')}</span>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={isActive ? 'default' : 'outline'}
                            onClick={() => openEditor(product.id)}
                            className="shrink-0 h-8 text-xs"
                          >
                            {t('editButton')}
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>

            {editingId && editingProduct ? (
              <div className="flex min-h-0 flex-1 flex-col border-t border-border lg:border-t-0">
                <div className="shrink-0 border-b border-border px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('editing')}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                    {productDisplayName(editingProduct, locale)}
                  </p>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                  <div className="space-y-2">
                    <Label htmlFor="product-code-input">{t('codeLabel')}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="product-code-input"
                        value={draftCode}
                        onChange={(e) => setDraftCode(e.target.value.toUpperCase())}
                        placeholder="MDGC1D"
                        className="font-mono text-base tracking-wide"
                      />
                      <Button type="button" variant="outline" size="icon" onClick={applySuggestion} title={t('suggest')}>
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    </div>
                    {!validation.valid && draftCode.trim() ? (
                      <p className="flex items-start gap-1.5 text-xs text-destructive">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {isEn ? validation.errorEn : validation.errorKo}
                      </p>
                    ) : validation.valid && draftCode.trim() ? (
                      <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                        <Check className="h-3.5 w-3.5" />
                        {t('validCode')}
                      </p>
                    ) : null}
                  </div>

                  {decodedParts.length > 0 ? (
                    <div className="rounded-xl border border-border bg-muted/20 p-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">{t('decodeLabel')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {decodedParts.map((part, i) => (
                          <span
                            key={`${part.code}-${i}`}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${
                              part.known
                                ? 'border-border bg-background text-foreground'
                                : 'border-amber-300 bg-amber-50 text-amber-800'
                            }`}
                          >
                            <span className="font-mono font-bold">{part.code}</span>
                            <span className="text-muted-foreground">
                              {isEn ? part.labelEn : part.labelKo}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-border p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{t('builderTitle')}</p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setActiveTab('settings')}
                          className="text-xs"
                        >
                          <Settings2 className="mr-1 h-3.5 w-3.5" />
                          {t('openBuilderSettings')}
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={applyBuilder}>
                          {t('applyBuilder')}
                        </Button>
                      </div>
                    </div>
                    <ProductCodeBuilderRows
                      rows={builderRows}
                      onChange={setBuilderRows}
                      config={builderConfig}
                      locale={locale}
                    />
                  </div>

                  {saveError ? (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {saveError}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void handleClearCode()}
                    disabled={saving || !normalizeProductCode(editingProduct.product_code)}
                  >
                    {t('clearCode')}
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={resetEditor} disabled={saving}>
                      {t('cancelEdit')}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving || !validation.valid}
                    >
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {t('save')}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hidden flex-1 items-center justify-center border-t border-border p-8 text-center lg:flex">
                <div className="max-w-xs space-y-2">
                  <Hash className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">{t('selectProduct')}</p>
                  <p className="text-xs text-muted-foreground">{t('selectProductHint')}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
