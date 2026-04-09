'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Save, AlertCircle, Users, ChevronRight, ChevronDown, CheckSquare, Square, LayoutGrid, Plus } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { translateProductDetailsFields, type ProductDetailsTranslationFields } from '@/lib/translationService'
import { suggestTourDescription } from '@/lib/chatgptService'
import LightRichEditor from '@/components/LightRichEditor'
import { isProductDetailVisibleOnCustomerPage } from '@/lib/fetchProductDetailsForEmail'

interface ProductDetailsFields {
  slogan1: string
  slogan2: string
  slogan3: string
  greeting: string
  description: string
  included: string
  not_included: string
  pickup_drop_info: string
  luggage_info: string
  tour_operation_info: string
  preparation_info: string
  small_group_info: string
  companion_recruitment_info: string
  notice_info: string
  important_notes: string
  private_tour_info: string
  cancellation_policy: string
  chat_announcement: string
  tags: string[]
}

interface MultilingualProductDetails {
  [languageCode: string]: ProductDetailsFields
}

interface ProductDetailsFormData {
  useCommonDetails: boolean
  productDetails: MultilingualProductDetails
  currentLanguage: string
  // 각 필드별 공통 정보 사용 여부
  useCommonForField: {
    [languageCode: string]: {
      slogan1: boolean
      slogan2: boolean
      slogan3: boolean
      greeting: boolean
      description: boolean
      included: boolean
      not_included: boolean
      pickup_drop_info: boolean
      luggage_info: boolean
      tour_operation_info: boolean
      preparation_info: boolean
      small_group_info: boolean
      companion_recruitment_info: boolean
      notice_info: boolean
      important_notes: boolean
      private_tour_info: boolean
      cancellation_policy: boolean
      chat_announcement: boolean
      tags: boolean
    }
  }
}

interface ProductDetailsTabProps {
  productId: string
  isNewProduct: boolean
  formData: ProductDetailsFormData
  setFormData: React.Dispatch<React.SetStateAction<ProductDetailsFormData>>
}

interface Channel {
  id: string
  name: string
  type: string
}

type ProductVariantRow = {
  variant_key: string
  variant_name_ko?: string | null
  variant_name_en?: string | null
}

interface ChannelGroup {
  id: string
  displayLabel: string
  channels: Channel[]
  /** 그룹에 속한 variant만 표시·선택. 없으면 해당 채널의 모든 variant(레거시·타입별 모드). */
  variantKeysByChannel?: Record<string, string[]>
}

/** 예전 localStorage 키 — DB 로드 실패 시 1회 폴백 후 저장 성공 시 제거 */
const CHANNEL_GROUP_LAYOUT_LEGACY_LOCAL_KEY = 'tms-product-details-channel-group-layout-v1'

const SHARED_SETTINGS_KEY_PRODUCT_DETAILS_CHANNEL_GROUPS = 'product_details_channel_group_layout'

const CHANNEL_VARIANT_PAIR_SEP = '\u0001'

function pairKeyChannelVariant(channelId: string, variantKey: string): string {
  return `${channelId}${CHANNEL_VARIANT_PAIR_SEP}${variantKey}`
}

function parsePairKeyChannelVariant(pk: string): { channelId: string; variantKey: string } {
  const i = pk.indexOf(CHANNEL_VARIANT_PAIR_SEP)
  if (i <= 0) return { channelId: pk, variantKey: 'default' }
  return { channelId: pk.slice(0, i), variantKey: pk.slice(i + 1) }
}

type ChannelGroupLayout = {
  version: 1
  mode: 'by_type' | 'custom'
  customGroups: Array<{
    id: string
    label: string
    channelIds: string[]
    /** 명시적 채널·variant 쌍. 비어 있으면 channelIds만 사용(레거시). */
    members?: Array<{ channelId: string; variantKey: string }>
  }>
}

function defaultChannelGroupLayout(): ChannelGroupLayout {
  return { version: 1, mode: 'by_type', customGroups: [] }
}

function isValidChannelGroupLayout(x: unknown): x is ChannelGroupLayout {
  if (x === null || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (o.version !== 1) return false
  if (o.mode !== 'by_type' && o.mode !== 'custom') return false
  if (!Array.isArray(o.customGroups)) return false
  for (const item of o.customGroups) {
    if (!item || typeof item !== 'object') return false
    const g = item as Record<string, unknown>
    if (typeof g.id !== 'string' || typeof g.label !== 'string') return false
    if (!Array.isArray(g.channelIds) || !g.channelIds.every((id) => typeof id === 'string')) return false
    if (g.members !== undefined) {
      if (!Array.isArray(g.members)) return false
      for (const m of g.members) {
        if (!m || typeof m !== 'object') return false
        const mem = m as Record<string, unknown>
        if (typeof mem.channelId !== 'string' || typeof mem.variantKey !== 'string') return false
      }
    }
  }
  return true
}

function newCustomGroupId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `cg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getVariantRowsForChannel(
  variantsByChannel: Record<string, ProductVariantRow[]>,
  channelId: string
): ProductVariantRow[] {
  const list = variantsByChannel[channelId]
  if (list && list.length > 0) return list
  return [{ variant_key: 'default' }]
}

function computePairToGroupMap(
  customGroups: ChannelGroupLayout['customGroups'],
  allChannels: Channel[],
  variantsByChannel: Record<string, ProductVariantRow[]>
): Map<string, string> {
  const byChannelId = new Set(allChannels.map((c) => c.id))
  const assigned = new Map<string, string>()
  const hasAnyMembers = customGroups.some((g) => (g.members?.length ?? 0) > 0)

  if (hasAnyMembers) {
    for (const g of customGroups) {
      for (const m of g.members || []) {
        if (!byChannelId.has(m.channelId)) continue
        const rows = getVariantRowsForChannel(variantsByChannel, m.channelId)
        if (!rows.some((v) => v.variant_key === m.variantKey)) continue
        assigned.set(pairKeyChannelVariant(m.channelId, m.variantKey), g.id)
      }
    }
    for (const g of customGroups) {
      for (const chId of g.channelIds) {
        if (!byChannelId.has(chId)) continue
        for (const v of getVariantRowsForChannel(variantsByChannel, chId)) {
          const pk = pairKeyChannelVariant(chId, v.variant_key)
          if (!assigned.has(pk)) assigned.set(pk, g.id)
        }
      }
    }
  } else {
    for (const g of customGroups) {
      for (const chId of g.channelIds) {
        if (!byChannelId.has(chId)) continue
        for (const v of getVariantRowsForChannel(variantsByChannel, chId)) {
          assigned.set(pairKeyChannelVariant(chId, v.variant_key), g.id)
        }
      }
    }
  }
  return assigned
}

function rebuildDraftFromPairAssignments(
  draft: ChannelGroupLayout,
  pairToGroup: Map<string, string>
): ChannelGroupLayout {
  const customGroups = draft.customGroups.map((g) => ({
    ...g,
    channelIds: [] as string[],
    members: [] as Array<{ channelId: string; variantKey: string }>,
  }))
  const byId = new Map(customGroups.map((g) => [g.id, g]))
  for (const [pk, gid] of pairToGroup) {
    const g = byId.get(gid)
    if (!g) continue
    const { channelId, variantKey } = parsePairKeyChannelVariant(pk)
    g.members.push({ channelId, variantKey })
  }
  return { ...draft, customGroups }
}

function variantsForChannelInGroup(
  group: ChannelGroup,
  channelId: string,
  variantsByChannel: Record<string, ProductVariantRow[]>
): ProductVariantRow[] {
  const all = getVariantRowsForChannel(variantsByChannel, channelId)
  const filt = group.variantKeysByChannel?.[channelId]
  if (!filt) return all
  return all.filter((v) => filt.includes(v.variant_key))
}

function groupVariantPairCount(
  group: ChannelGroup,
  variantsByChannel: Record<string, ProductVariantRow[]>
): number {
  return group.channels.reduce((acc, ch) => acc + variantsForChannelInGroup(group, ch.id, variantsByChannel).length, 0)
}

function buildGroupsByType(allChannels: Channel[], selfLabel: string): ChannelGroup[] {
  const typeMap = new Map<string, Channel[]>()
  allChannels.forEach((channel) => {
    if (!typeMap.has(channel.type)) typeMap.set(channel.type, [])
    typeMap.get(channel.type)!.push(channel)
  })
  const groups: ChannelGroup[] = []
  typeMap.forEach((chs, type) => {
    groups.push({
      id: `type:${type}`,
      displayLabel: type === 'self' || type === 'SELF' ? selfLabel : type,
      channels: chs,
    })
  })
  return groups
}

function computeChannelGroupsFromLayout(
  allChannels: Channel[],
  layout: ChannelGroupLayout,
  selfLabel: string,
  variantsByChannel: Record<string, ProductVariantRow[]>
): ChannelGroup[] {
  if (layout.mode !== 'custom' || layout.customGroups.length === 0) {
    return buildGroupsByType(allChannels, selfLabel)
  }
  const byId = new Map(allChannels.map((c) => [c.id, c]))
  const pairToGroup = computePairToGroupMap(layout.customGroups, allChannels, variantsByChannel)

  const groupPairBuckets = new Map<string, Map<string, Set<string>>>()
  for (const g of layout.customGroups) {
    groupPairBuckets.set(g.id, new Map())
  }

  for (const ch of allChannels) {
    for (const v of getVariantRowsForChannel(variantsByChannel, ch.id)) {
      const pk = pairKeyChannelVariant(ch.id, v.variant_key)
      const gid = pairToGroup.get(pk)
      if (!gid) continue
      const bucket = groupPairBuckets.get(gid)
      if (!bucket) continue
      if (!bucket.has(ch.id)) bucket.set(ch.id, new Set())
      bucket.get(ch.id)!.add(v.variant_key)
    }
  }

  const out: ChannelGroup[] = []
  for (const g of layout.customGroups) {
    const bucket = groupPairBuckets.get(g.id)
    const variantKeysByChannel: Record<string, string[]> = {}
    const chs: Channel[] = []
    if (bucket) {
      for (const ch of allChannels) {
        const set = bucket.get(ch.id)
        if (set && set.size > 0) {
          const chObj = byId.get(ch.id)
          if (chObj) {
            chs.push(chObj)
            variantKeysByChannel[ch.id] = Array.from(set)
          }
        }
      }
    }
    out.push({
      id: g.id,
      displayLabel: g.label.trim() || '이름 없음',
      channels: chs,
      variantKeysByChannel,
    })
  }

  const assignedPairs = new Set(pairToGroup.keys())
  const unassignedBucket = new Map<string, Set<string>>()
  for (const ch of allChannels) {
    for (const v of getVariantRowsForChannel(variantsByChannel, ch.id)) {
      const pk = pairKeyChannelVariant(ch.id, v.variant_key)
      if (!assignedPairs.has(pk)) {
        if (!unassignedBucket.has(ch.id)) unassignedBucket.set(ch.id, new Set())
        unassignedBucket.get(ch.id)!.add(v.variant_key)
      }
    }
  }
  if (unassignedBucket.size > 0) {
    const chs: Channel[] = []
    const variantKeysByChannel: Record<string, string[]> = {}
    for (const ch of allChannels) {
      const set = unassignedBucket.get(ch.id)
      if (set && set.size > 0) {
        const chObj = byId.get(ch.id)
        if (chObj) {
          chs.push(chObj)
          variantKeysByChannel[ch.id] = Array.from(set)
        }
      }
    }
    if (chs.length > 0) {
      out.push({
        id: '__unassigned__',
        displayLabel: '미배정 채널',
        channels: chs,
        variantKeysByChannel,
      })
    }
  }
  return out
}

function seedCustomGroupsFromByType(
  allChannels: Channel[],
  selfLabel: string
): ChannelGroupLayout['customGroups'] {
  return buildGroupsByType(allChannels, selfLabel).map((g) => ({
    id: newCustomGroupId(),
    label: g.displayLabel,
    channelIds: g.channels.map((c) => c.id),
  }))
}

function cloneCustomGroupEntry(
  g: ChannelGroupLayout['customGroups'][number]
): ChannelGroupLayout['customGroups'][number] {
  if (g.members) {
    return {
      ...g,
      channelIds: [...g.channelIds],
      members: g.members.map((m) => ({ ...m })),
    }
  }
  return {
    ...g,
    channelIds: [...g.channelIds],
  }
}

function findDraftGroupIdForPair(
  draft: ChannelGroupLayout,
  channelId: string,
  variantKey: string,
  allChannels: Channel[],
  variantsByChannel: Record<string, ProductVariantRow[]>
): string | '__unassigned__' {
  const map = computePairToGroupMap(draft.customGroups, allChannels, variantsByChannel)
  return map.get(pairKeyChannelVariant(channelId, variantKey)) ?? '__unassigned__'
}

export default function ProductDetailsTab({
  productId,
  isNewProduct,
  formData,
  setFormData
}: ProductDetailsTabProps) {
  const t = useTranslations('products.detailsTab')
  const tDetails = useTranslations('products.detailsPage')

  const getCopyFieldLabel = (field: string | null) => {
    if (!field) return ''
    if (field === 'slogan') return t('slogan')
    if (field === 'included_not_included') return t('includedNotIncluded')
    if (field === 'description') return tDetails('description')
    if (field === 'pickup_drop_info') return t('pickupDropInfo')
    if (field === 'luggage_info') return t('luggageInfo')
    if (field === 'tour_operation_info') return t('tourOperationInfo')
    if (field === 'preparation_info') return t('preparationInfo')
    if (field === 'small_group_info') return t('smallGroupInfo')
    if (field === 'notice_info') return t('noticeInfo')
    if (field === 'private_tour_info') return t('privateTourInfo')
    if (field === 'cancellation_policy') return t('cancellationPolicy')
    if (field === 'chat_announcement') return t('chatAnnouncement')
    if (field === 'greeting') return t('greeting')
    if (field === 'companion_recruitment_info') return t('companionRecruitmentInfo')
    if (field === 'important_notes') return t('importantNotes')
    return field
  }

  const [saving, setSaving] = useState(false)
  const [saveMessageType, setSaveMessageType] = useState<'success' | 'error' | null>(null)
  const [saveMessage, setSaveMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [availableLanguages] = useState(['ko', 'en', 'ja', 'zh'])
  const [translating, setTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestionError, setSuggestionError] = useState<string | null>(null)
  // const [loadingCommon, setLoadingCommon] = useState(false)

  // 채널 관련 상태
  const [channels, setChannels] = useState<Channel[]>([])
  const [groupLayout, setGroupLayout] = useState<ChannelGroupLayout>(defaultChannelGroupLayout)
  const [channelGroupEditorOpen, setChannelGroupEditorOpen] = useState(false)
  const [groupLayoutDraft, setGroupLayoutDraft] = useState<ChannelGroupLayout>(defaultChannelGroupLayout)
  const [savingChannelGroupLayout, setSavingChannelGroupLayout] = useState(false)
  /** 채널별 선택된 variant_key 목록 (다중 선택 가능) */
  const [selectedChannelVariants, setSelectedChannelVariants] = useState<Record<string, string[]>>({})
  const selectedChannelVariantsRef = useRef<Record<string, string[]>>({})
  selectedChannelVariantsRef.current = selectedChannelVariants
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [loadingChannelData, setLoadingChannelData] = useState(false)
  const [_copyFromChannel, _setCopyFromChannel] = useState<string | null>(null)
  const [_channelPricingStats, setChannelPricingStats] = useState<Record<string, Record<string, number>>>({})
  
  // 채널별 데이터 완성도 상태
  const [channelCompletionStats, setChannelCompletionStats] = useState<Record<string, {
    completed: number;
    total: number;
    percentage: number;
    missingFields: string[];
  }>>({})
  
  // 완성도 필터 상태
  const [completionFilter, setCompletionFilter] = useState<'all' | 'incomplete' | 'empty'>('all')
  
  // 복사 모달 상태
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [copyFieldName, setCopyFieldName] = useState<string | null>(null)
  /** 복사 모달: 채널(실제 id) → variant_key → 선택 여부 (편집 중인 채널은 모달에 안 뜸) */
  const [copyTargetSelections, setCopyTargetSelections] = useState<Record<string, Record<string, boolean>>>({})
  const [copySourceLanguage, setCopySourceLanguage] = useState<string>('ko')
  const [previewEditModalOpen, setPreviewEditModalOpen] = useState(false)
  const [previewEditingField, setPreviewEditingField] = useState<keyof ProductDetailsFields | null>(null)
  const [importFieldModalOpen, setImportFieldModalOpen] = useState(false)
  const [importSourceChannelId, setImportSourceChannelId] = useState<string>('')
  const [importSourceLanguage, setImportSourceLanguage] = useState<string>('ko')
  const [importChannelStats, setImportChannelStats] = useState<Record<string, { plainLen: number; hasContent: boolean }>>({})
  const [importStatsLoading, setImportStatsLoading] = useState(false)
  const [importingField, setImportingField] = useState(false)
  const [sectionTitleOverridesByLanguage, setSectionTitleOverridesByLanguage] = useState<Record<string, Partial<Record<keyof ProductDetailsFields, string>>>>({})
  /** 언어별 고객 상품 페이지 섹션 숨김 (해당 필드만 false 로 저장, 없으면 표시) */
  const [customerPageVisibilityByLanguage, setCustomerPageVisibilityByLanguage] = useState<
    Record<string, Partial<Record<keyof ProductDetailsFields, boolean>>>
  >({})

  const [productVariantsByChannel, setProductVariantsByChannel] = useState<Record<string, ProductVariantRow[]>>({})

  const supabase = createClientSupabase()
  const { user, loading: authLoading } = useAuth()

  const selectedPairCount = useMemo(
    () => Object.values(selectedChannelVariants).reduce((sum, arr) => sum + (arr?.length ?? 0), 0),
    [selectedChannelVariants]
  )

  const selectedPairsForDisplay = useMemo(() => {
    const out: { channelId: string; variantKey: string }[] = []
    for (const [channelId, vks] of Object.entries(selectedChannelVariants)) {
      for (const vk of vks || []) {
        out.push({ channelId, variantKey: vk })
      }
    }
    return out
  }, [selectedChannelVariants])

  /** Import/복사 등 단일 variant가 필요할 때: 해당 채널에서 첫 번째로 선택된 variant */
  const getPrimaryVariantForChannel = (channelId: string): string => {
    const arr = selectedChannelVariants[channelId]
    if (arr && arr.length > 0) return arr[0]
    return 'default'
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await (supabase as any)
        .from('shared_settings')
        .select('setting_value')
        .eq('setting_key', SHARED_SETTINGS_KEY_PRODUCT_DETAILS_CHANNEL_GROUPS)
        .maybeSingle()

      if (cancelled) return

      if (!error && data?.setting_value != null && isValidChannelGroupLayout(data.setting_value)) {
        setGroupLayout(data.setting_value)
        return
      }

      try {
        const raw = localStorage.getItem(CHANNEL_GROUP_LAYOUT_LEGACY_LOCAL_KEY)
        if (raw) {
          const parsed: unknown = JSON.parse(raw)
          if (isValidChannelGroupLayout(parsed)) setGroupLayout(parsed)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const persistGroupLayout = useCallback(
    async (layout: ChannelGroupLayout): Promise<boolean> => {
      setSavingChannelGroupLayout(true)
      try {
        const payload: Record<string, unknown> = {
          setting_key: SHARED_SETTINGS_KEY_PRODUCT_DETAILS_CHANNEL_GROUPS,
          setting_value: layout,
        }
        if (user?.id) payload.updated_by = user.id

        const { error } = await (supabase as any).from('shared_settings').upsert(payload, { onConflict: 'setting_key' })

        if (error) {
          const msg = error.message || ''
          const denied =
            msg.toLowerCase().includes('permission') ||
            msg.toLowerCase().includes('policy') ||
            (error as { code?: string }).code === '42501'
          setSaveMessage(
            denied
              ? '채널 그룹 설정은 관리자(super/admin)만 저장할 수 있습니다.'
              : `채널 그룹 설정 저장 실패: ${msg}`
          )
          setSaveMessageType('error')
          setTimeout(() => {
            setSaveMessage('')
            setSaveMessageType(null)
          }, 5000)
          return false
        }

        setGroupLayout(layout)
        try {
          localStorage.removeItem(CHANNEL_GROUP_LAYOUT_LEGACY_LOCAL_KEY)
        } catch {
          /* */
        }
        return true
      } finally {
        setSavingChannelGroupLayout(false)
      }
    },
    [supabase, user?.id]
  )

  const selfGroupLabelForLayout = t('selfGroupLabel')
  const channelGroups = useMemo(
    () => computeChannelGroupsFromLayout(channels, groupLayout, selfGroupLabelForLayout, productVariantsByChannel),
    [channels, groupLayout, selfGroupLabelForLayout, productVariantsByChannel]
  )

  useEffect(() => {
    setExpandedGroups((prev) => {
      let changed = false
      const next = { ...prev }
      for (const g of channelGroups) {
        if (!(g.id in next)) {
          next[g.id] = false
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [channelGroups])

  const openChannelGroupEditor = useCallback(() => {
    const selfLabel = t('selfGroupLabel')
    let draft: ChannelGroupLayout = {
      ...groupLayout,
      customGroups: groupLayout.customGroups.map((g) => cloneCustomGroupEntry(g)),
    }
    if (draft.mode === 'custom' && draft.customGroups.length === 0 && channels.length > 0) {
      draft = {
        ...draft,
        customGroups: seedCustomGroupsFromByType(channels, selfLabel),
      }
    }
    setGroupLayoutDraft(draft)
    setChannelGroupEditorOpen(true)
  }, [channels, groupLayout, t])

  const assignPairInDraft = useCallback(
    (channelId: string, variantKey: string, targetGroupId: string | '__unassigned__') => {
      setGroupLayoutDraft((prev) => {
        if (prev.mode !== 'custom') return prev
        const map = computePairToGroupMap(prev.customGroups, channels, productVariantsByChannel)
        const pk = pairKeyChannelVariant(channelId, variantKey)
        if (targetGroupId === '__unassigned__') map.delete(pk)
        else map.set(pk, targetGroupId)
        return rebuildDraftFromPairAssignments(prev, map)
      })
    },
    [channels, productVariantsByChannel]
  )

  /** 빈 그룹 한 줄 추가(사용자 정의 모드로 전환). 목록이 비어 있으면 타입별 시드 후 추가 */
  const addAnotherCustomGroup = useCallback(() => {
    const selfLabel = t('selfGroupLabel')
    setGroupLayoutDraft((d) => {
      let cgs = d.customGroups.map((g) => cloneCustomGroupEntry(g))
      if (cgs.length === 0 && channels.length > 0) {
        cgs = seedCustomGroupsFromByType(channels, selfLabel)
      }
      const n = cgs.length + 1
      return {
        ...d,
        mode: 'custom',
        customGroups: [
          ...cgs,
          { id: newCustomGroupId(), label: `새 그룹 ${n}`, channelIds: [] },
        ],
      }
    })
  }, [channels, t])

  const decodeHtmlEntities = (value: string): string => {
    if (!value) return ''
    if (typeof window === 'undefined') {
      return value
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
    }
    const textarea = document.createElement('textarea')
    textarea.innerHTML = value
    return textarea.value
  }

  /** Import 미리보기용: HTML 제거 후 글자 수 */
  const plainTextLenForImport = (raw: string): number => {
    if (!raw) return 0
    return raw.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().length
  }

  const rowFieldValueToString = (row: Record<string, unknown> | undefined, field: keyof ProductDetailsFields): string => {
    if (!row) return ''
    const v = row[field as string]
    if (v == null) return ''
    if (Array.isArray(v)) return v.filter(Boolean).join(', ')
    return String(v)
  }

  const langLabel = (code: string) => {
    if (code === 'ko') return 'KO · 한국어'
    if (code === 'en') return 'EN · English'
    if (code === 'ja') return 'JA · 日本語'
    if (code === 'zh') return 'ZH · 中文'
    return code.toUpperCase()
  }

  const defaultSectionTitles: Record<keyof ProductDetailsFields, string> = {
    slogan1: '🧭 Slogan',
    slogan2: '🧭 Slogan 2',
    slogan3: '🧭 Slogan 3',
    greeting: '👋 인사말',
    description: '📝 Description',
    included: '✔ Included',
    not_included: '✘ Not Included',
    pickup_drop_info: '🚐 Pickup / Drop-off',
    luggage_info: '🧳 Luggage Info',
    tour_operation_info: '🚌 Tour Operation Info',
    preparation_info: '🎒 What to Bring',
    small_group_info: '👥 Small Group Info',
    companion_recruitment_info: '🤝 동행모집 안내',
    notice_info: '💵 Payment Notice',
    important_notes: '⚠️ IMPORTANT NOTES',
    private_tour_info: '🔒 Private Tour Info',
    cancellation_policy: '📋 Cancellation Policy',
    chat_announcement: '💬 Chat Announcement',
    tags: '🏷 Tags'
  }

  const getCurrentSectionTitles = (): Partial<Record<keyof ProductDetailsFields, string>> => {
    const currentLang = formData.currentLanguage || 'ko'
    return sectionTitleOverridesByLanguage[currentLang] || {}
  }

  const getSectionTitle = (field: keyof ProductDetailsFields): string => {
    const currentTitles = getCurrentSectionTitles()
    const custom = currentTitles[field]?.trim()
    return custom || defaultSectionTitles[field]
  }

  const visibilityRowToPartial = (
    raw: unknown
  ): Partial<Record<keyof ProductDetailsFields, boolean>> => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const out: Partial<Record<keyof ProductDetailsFields, boolean>> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (
        v === false &&
        Object.prototype.hasOwnProperty.call(defaultSectionTitles, k)
      ) {
        out[k as keyof ProductDetailsFields] = false
      }
    }
    return out
  }

  const getCustomerPageVisibilityForSave = (): Record<string, boolean> => {
    const currentLang = formData.currentLanguage || 'ko'
    const vis = customerPageVisibilityByLanguage[currentLang] || {}
    const out: Record<string, boolean> = {}
    for (const k of Object.keys(vis) as (keyof ProductDetailsFields)[]) {
      if (vis[k] === false) out[k] = false
    }
    return out
  }

  const isCustomerPageFieldVisible = (field: keyof ProductDetailsFields): boolean =>
    isProductDetailVisibleOnCustomerPage(
      customerPageVisibilityByLanguage[formData.currentLanguage || 'ko'] ?? null,
      field
    )

  // 로딩 상태는 부모 컴포넌트에서 관리
  useEffect(() => {
    setLoading(false)
  }, [])

  // 채널 목록 로드
  const loadChannels = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, type')
        .order('type, name')

      if (error) throw error
      
      const channelsData = (data || []) as Channel[]
      
      // 중복 제거: 같은 ID를 가진 채널이 있으면 첫 번째 것만 사용
      const uniqueChannelsById = new Map<string, Channel>()
      channelsData.forEach(channel => {
        if (!uniqueChannelsById.has(channel.id)) {
          uniqueChannelsById.set(channel.id, channel)
        } else {
          // 중복된 ID 발견 시 로그
          console.warn(`중복된 채널 ID 발견: ${channel.id} (${channel.name})`)
        }
      })
      
      // 같은 이름을 가진 채널도 확인 (디버깅용)
      const channelsByName = new Map<string, Channel[]>()
      Array.from(uniqueChannelsById.values()).forEach(channel => {
        if (!channelsByName.has(channel.name)) {
          channelsByName.set(channel.name, [])
        }
        channelsByName.get(channel.name)!.push(channel)
      })
      
      // 같은 이름을 가진 채널이 여러 개인 경우 로그
      channelsByName.forEach((channels, name) => {
        if (channels.length > 1) {
          console.warn(`같은 이름을 가진 채널이 ${channels.length}개 있습니다: ${name}`, 
            channels.map(c => ({ id: c.id, name: c.name, type: c.type })))
        }
      })
      
      const deduplicatedChannels = Array.from(uniqueChannelsById.values())
      setChannels(deduplicatedChannels)
      
    } catch (error) {
      console.error('채널 목록 로드 오류:', error)
    }
  }, [supabase])

  // 채널별 가격 통계 로드 함수
  const loadChannelPricingStats = useCallback(async () => {
    if (!productId) return;

    try {
      // 모든 채널의 동적 가격 데이터 가져오기 (channels 테이블과 JOIN)
      // JOIN이 실패할 수 있으므로 left join 사용
      let { data, error } = await supabase
        .from('dynamic_pricing')
        .select(`
          channel_id,
          date,
          channels(id, name)
        `)
        .eq('product_id', productId);

      // JOIN이 실패하면 채널 정보 없이 시도
      if (error) {
        console.warn('채널 JOIN 실패, 채널 정보 없이 재시도:', error);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('dynamic_pricing')
          .select('channel_id, date')
          .eq('product_id', productId);
        
        if (fallbackError) {
          console.error('채널별 가격 통계 로드 오류:', fallbackError);
          return;
        }
        data = fallbackData?.map((row: { channel_id: string | null; date: string }) => ({ ...row, channels: null })) ?? null;
      }

      // 날짜 정규화 함수 (YYYY-MM-DD 형식으로 변환)
      const normalizeDate = (dateStr: string | null | undefined): string | null => {
        if (!dateStr) return null;
        
        const str = String(dateStr).trim();
        // 이미 YYYY-MM-DD 형식인지 확인
        if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return str;
        }
        
        // 날짜 문자열에서 YYYY-MM-DD 추출
        const dateMatch = str.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
        if (dateMatch) {
          const year = dateMatch[1];
          const month = String(parseInt(dateMatch[2], 10)).padStart(2, '0');
          const day = String(parseInt(dateMatch[3], 10)).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        
        // Date 객체로 파싱 시도
        try {
          const date = new Date(str);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
        } catch (e) {
          // 파싱 실패
        }
        
        return null;
      };

      // 채널별로 그룹화하고 연도별 날짜 수 계산
      // channel_id와 channel name 모두로 매칭 가능하도록 저장
      const statsById: Record<string, Record<string, Set<string>>> = {};
      const statsByName: Record<string, Record<string, Set<string>>> = {};
      
      if (data) {
        data.forEach((item: any) => {
          const channelId = item.channel_id;
          const channelName = item.channels?.name;
          const normalizedDate = normalizeDate(item.date);
          
          if (!normalizedDate) {
            // 날짜가 유효하지 않으면 건너뛰기
            return;
          }
          
          const year = normalizedDate.split('-')[0];

          // channel_id로 매칭
          if (channelId) {
            if (!statsById[channelId]) {
              statsById[channelId] = {};
            }
            if (!statsById[channelId][year]) {
              statsById[channelId][year] = new Set();
            }
            statsById[channelId][year].add(normalizedDate);
          }

          // channel name으로도 매칭 (같은 이름의 다른 ID 채널을 위해)
          if (channelName) {
            if (!statsByName[channelName]) {
              statsByName[channelName] = {};
            }
            if (!statsByName[channelName][year]) {
              statsByName[channelName][year] = new Set();
            }
            statsByName[channelName][year].add(normalizedDate);
          }
        });
      }

      // Set을 개수로 변환
      const formattedStatsById: Record<string, Record<string, number>> = {};
      Object.keys(statsById).forEach(channelId => {
        formattedStatsById[channelId] = {};
        Object.keys(statsById[channelId]).forEach(year => {
          formattedStatsById[channelId][year] = statsById[channelId][year].size;
        });
      });

      const formattedStatsByName: Record<string, Record<string, number>> = {};
      Object.keys(statsByName).forEach(channelName => {
        formattedStatsByName[channelName] = {};
        Object.keys(statsByName[channelName]).forEach(year => {
          formattedStatsByName[channelName][year] = statsByName[channelName][year].size;
        });
      });

      // 통계를 ID와 이름 모두로 저장
      const allStats: Record<string, Record<string, number>> = {
        ...formattedStatsById,
        // 이름으로도 접근 가능하도록 추가 (같은 이름의 채널이 여러 개일 경우)
        ...formattedStatsByName
      };

      // 디버깅: 통계 데이터 확인
      console.log('채널별 가격 통계 로드 결과:', {
        totalRecords: data?.length || 0,
        uniqueChannelIds: Object.keys(formattedStatsById),
        uniqueChannelNames: Object.keys(formattedStatsByName),
        statsById: formattedStatsById,
        statsByName: formattedStatsByName
      });

      setChannelPricingStats(allStats);
    } catch (error) {
      console.error('채널별 가격 통계 로드 오류:', error);
    }
  }, [productId, supabase]);

  // 선택된 채널·variant 쌍의 세부 정보 로드 (같은 stored channel에 여러 variant면 각각 조회 후 병합)
  const loadSelectedChannelData = useCallback(async (overrideSelected?: Record<string, string[]>) => {
    const sel = overrideSelected ?? selectedChannelVariants
    const selectedIds = Object.keys(sel).filter((id) => (sel[id]?.length ?? 0) > 0)
    if (selectedIds.length === 0) {
      return
    }

    setLoadingChannelData(true)
    try {
      const queries: { channel_id: string; variant_key: string }[] = []

      for (const channelId of selectedIds) {
        const channel = channels.find((c) => c.id === channelId)
        const vks = sel[channelId] || []
        const isSelf = channel?.type === 'self' || channel?.type === 'SELF'
        for (const vk of vks) {
          queries.push({
            channel_id: isSelf ? 'SELF_GROUP' : channelId,
            variant_key: vk
          })
        }
      }

      const seen = new Set<string>()
      const uniqueQueries = queries.filter((q) => {
        const k = `${q.channel_id}\t${q.variant_key}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })

      if (uniqueQueries.length === 0) {
        setLoadingChannelData(false)
        return
      }

      let allData: any[] = []

      for (const { channel_id: channelId, variant_key: variantKey } of uniqueQueries) {
        const { data: channelData, error: channelError } = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', productId)
          .eq('channel_id', channelId)
          .eq('variant_key', variantKey) as {
            data: Array<{
              channel_id: string | null
              language_code: string | null
              variant_key?: string | null
              slogan1: string | null
              slogan2: string | null
              slogan3: string | null
              greeting: string | null
              description: string | null
              included: string | null
              not_included: string | null
              pickup_drop_info: string | null
              luggage_info: string | null
              tour_operation_info: string | null
              preparation_info: string | null
              small_group_info: string | null
              companion_recruitment_info: string | null
              notice_info: string | null
              important_notes: string | null
              private_tour_info: string | null
              cancellation_policy: string | null
              chat_announcement: string | null
              tags: string[] | null
              section_titles?: Record<string, string> | null
              customer_page_visibility?: unknown
            }> | null
            error: unknown
          }
        
        if (channelError) {
          console.error(`채널 ${channelId} 데이터 로드 오류:`, channelError)
          continue
        }
        
        if (channelData) {
          allData = [...allData, ...channelData]
        }
      }

      const data = allData.length > 0 ? allData : null

      console.log('선택된 채널 데이터 로드됨:', data)

      // 채널별 데이터를 formData에 반영
      if (data && data.length > 0) {
        const multilingualDetails: Record<string, ProductDetailsFields> = {}
        const loadedTitlesByLanguage: Record<string, Partial<Record<keyof ProductDetailsFields, string>>> = {}
        const loadedCustomerPageVisibilityByLanguage: Record<
          string,
          Partial<Record<keyof ProductDetailsFields, boolean>>
        > = {}

        // 각 언어별로 모든 채널의 데이터를 병합
        // 첫 번째 채널의 데이터를 기본으로 하고, 비어있는 필드는 다른 채널의 데이터로 채움
        data.forEach((item) => {
          const langCode = item.language_code || 'ko'
          if (!loadedTitlesByLanguage[langCode] && item.section_titles && typeof item.section_titles === 'object') {
            loadedTitlesByLanguage[langCode] = item.section_titles as Partial<Record<keyof ProductDetailsFields, string>>
          }
          if (
            !loadedCustomerPageVisibilityByLanguage[langCode] &&
            item.customer_page_visibility
          ) {
            loadedCustomerPageVisibilityByLanguage[langCode] = visibilityRowToPartial(
              item.customer_page_visibility
            )
          }
          if (!multilingualDetails[langCode]) {
            // 첫 번째 채널의 데이터로 초기화
            multilingualDetails[langCode] = {
              slogan1: item.slogan1 ?? '',
              slogan2: item.slogan2 ?? '',
              slogan3: item.slogan3 ?? '',
              greeting: item.greeting ?? '',
              description: item.description ?? '',
              included: item.included ?? '',
              not_included: item.not_included ?? '',
              pickup_drop_info: item.pickup_drop_info ?? '',
              luggage_info: item.luggage_info ?? '',
              tour_operation_info: item.tour_operation_info ?? '',
              preparation_info: item.preparation_info ?? '',
              small_group_info: item.small_group_info ?? '',
              companion_recruitment_info: item.companion_recruitment_info ?? '',
              notice_info: item.notice_info ?? '',
              important_notes: item.important_notes ?? '',
              private_tour_info: item.private_tour_info ?? '',
              cancellation_policy: item.cancellation_policy ?? '',
              chat_announcement: item.chat_announcement ?? '',
              tags: item.tags ?? []
            }
          } else {
            // 이미 있는 경우, 비어있는 필드를 현재 채널의 데이터로 채움
            const existing = multilingualDetails[langCode]
            const hasValue = (value: string | null | undefined) => value && value.trim() !== ''
            
            multilingualDetails[langCode] = {
              slogan1: hasValue(existing.slogan1) ? existing.slogan1 : (item.slogan1 ?? ''),
              slogan2: hasValue(existing.slogan2) ? existing.slogan2 : (item.slogan2 ?? ''),
              slogan3: hasValue(existing.slogan3) ? existing.slogan3 : (item.slogan3 ?? ''),
              greeting: hasValue(existing.greeting) ? existing.greeting : (item.greeting ?? ''),
              description: hasValue(existing.description) ? existing.description : (item.description ?? ''),
              included: hasValue(existing.included) ? existing.included : (item.included ?? ''),
              not_included: hasValue(existing.not_included) ? existing.not_included : (item.not_included ?? ''),
              pickup_drop_info: hasValue(existing.pickup_drop_info) ? existing.pickup_drop_info : (item.pickup_drop_info ?? ''),
              luggage_info: hasValue(existing.luggage_info) ? existing.luggage_info : (item.luggage_info ?? ''),
              tour_operation_info: hasValue(existing.tour_operation_info) ? existing.tour_operation_info : (item.tour_operation_info ?? ''),
              preparation_info: hasValue(existing.preparation_info) ? existing.preparation_info : (item.preparation_info ?? ''),
              small_group_info: hasValue(existing.small_group_info) ? existing.small_group_info : (item.small_group_info ?? ''),
              companion_recruitment_info: hasValue(existing.companion_recruitment_info) ? existing.companion_recruitment_info : (item.companion_recruitment_info ?? ''),
              notice_info: hasValue(existing.notice_info) ? existing.notice_info : (item.notice_info ?? ''),
              important_notes: hasValue(existing.important_notes) ? existing.important_notes : (item.important_notes ?? ''),
              private_tour_info: hasValue(existing.private_tour_info) ? existing.private_tour_info : (item.private_tour_info ?? ''),
              cancellation_policy: hasValue(existing.cancellation_policy) ? existing.cancellation_policy : (item.cancellation_policy ?? ''),
              chat_announcement: hasValue(existing.chat_announcement) ? existing.chat_announcement : (item.chat_announcement ?? ''),
              tags: existing.tags.length > 0 ? existing.tags : (item.tags ?? [])
            }
          }
        })
        
        console.log('채널별 데이터 병합 결과:', multilingualDetails)

        // 기본 한국어 데이터가 없으면 빈 데이터 추가
        if (!multilingualDetails.ko) {
          multilingualDetails.ko = {
            slogan1: '',
            slogan2: '',
            slogan3: '',
            greeting: '',
            description: '',
            included: '',
            not_included: '',
            pickup_drop_info: '',
            luggage_info: '',
            tour_operation_info: '',
            preparation_info: '',
            small_group_info: '',
            companion_recruitment_info: '',
            notice_info: '',
            important_notes: '',
            private_tour_info: '',
            cancellation_policy: '',
            chat_announcement: '',
            tags: []
          }
        }

        console.log('채널별 데이터를 formData에 반영:', multilingualDetails)
        setSectionTitleOverridesByLanguage(prev => ({
          ...prev,
          ...loadedTitlesByLanguage
        }))
        setCustomerPageVisibilityByLanguage((prev) => ({
          ...prev,
          ...loadedCustomerPageVisibilityByLanguage,
        }))
        // 채널에서 온 언어만 덮어쓰고, 나머지 언어(en 등)는 기존 formData·글로벌 로드 값 유지
        // (전체 치환 시 채널 행에 없는 언어가 사라져 영문 편집/저장이 깨짐)
        setFormData(prev => {
          const mergedProductDetails: Record<string, ProductDetailsFields> = {
            ...prev.productDetails
          }
          for (const [lang, details] of Object.entries(multilingualDetails)) {
            mergedProductDetails[lang] = details
          }

          if (JSON.stringify(prev.productDetails) === JSON.stringify(mergedProductDetails)) {
            return prev
          }

          return {
            ...prev,
            productDetails: mergedProductDetails
          }
        })
      }
    } catch (error) {
      console.error('선택된 채널 데이터 로드 오류:', error)
    } finally {
      setLoadingChannelData(false)
    }
  }, [selectedChannelVariants, productId, supabase, setFormData, channels])

  // 상품에 연결된 채널별 variant 목록 — channel_products를 product_id 기준으로 한 번에 조회
  // (선택된 채널만 개별 조회하면 비동기 타이밍에 드롭다운이 [{ default }] 폴백만 보이는 문제가 있었음)
  useEffect(() => {
    if (isNewProduct || !productId) {
      setProductVariantsByChannel({})
      return
    }

    let cancelled = false

    const loadChannelVariants = async () => {
      try {
        const { data, error } = await supabase
          .from('channel_products')
          .select('channel_id, variant_key, variant_name_ko, variant_name_en')
          .eq('product_id', productId)
          .eq('is_active', true)
          .order('channel_id', { ascending: true })
          .order('variant_key', { ascending: true })

        if (error) {
          console.error('상품 채널 variant 로드 실패:', error)
          return
        }

        const variantsByChannel: Record<string, Array<{
          variant_key: string
          variant_name_ko?: string | null
          variant_name_en?: string | null
        }>> = {}

        for (const row of data || []) {
          const r = row as {
            channel_id?: string | null
            variant_key?: string | null
            variant_name_ko?: string | null
            variant_name_en?: string | null
          }
          const cid = r.channel_id
          if (!cid) continue
          if (!variantsByChannel[cid]) variantsByChannel[cid] = []
          variantsByChannel[cid].push({
            variant_key: r.variant_key || 'default',
            variant_name_ko: r.variant_name_ko ?? null,
            variant_name_en: r.variant_name_en ?? null
          })
        }

        if (!cancelled) {
          setProductVariantsByChannel(variantsByChannel)
        }
      } catch (error) {
        console.error('Variant 목록 로드 중 오류:', error)
      }
    }

    loadChannelVariants()
    return () => {
      cancelled = true
    }
  }, [productId, isNewProduct, supabase])

  // channel_products 목록이 바뀌면 선택 중인 variant_key 중 무효한 것 제거
  useEffect(() => {
    setSelectedChannelVariants((prev) => {
      let next = { ...prev }
      let changed = false
      for (const channelId of Object.keys(next)) {
        const list = productVariantsByChannel[channelId]
        const validKeys = new Set(
          (list && list.length > 0 ? list : [{ variant_key: 'default' }]).map((v) => v.variant_key)
        )
        const filtered = (next[channelId] || []).filter((vk) => validKeys.has(vk))
        if (filtered.length !== (next[channelId]?.length ?? 0)) {
          changed = true
          if (filtered.length === 0) delete next[channelId]
          else next[channelId] = filtered
        }
      }
      return changed ? next : prev
    })
  }, [productVariantsByChannel])

  const toggleChannelVariant = (channelId: string, variantKey: string) => {
    setSelectedChannelVariants((prev) => {
      const cur = new Set(prev[channelId] || [])
      if (cur.has(variantKey)) cur.delete(variantKey)
      else cur.add(variantKey)
      const arr = Array.from(cur).sort()
      const next = { ...prev }
      if (arr.length === 0) delete next[channelId]
      else next[channelId] = arr
      return next
    })
  }

  // 그룹 전체: 이 그룹에 속한 채널·variant만 선택 ↔ 해제
  const toggleGroupSelection = (groupId: string) => {
    const group = channelGroups.find((g) => g.id === groupId)
    if (!group) return

    const allSelected = group.channels.every((channel) => {
      const variantsInGroup = variantsForChannelInGroup(group, channel.id, productVariantsByChannel)
      const sel = selectedChannelVariants[channel.id] || []
      return (
        variantsInGroup.length > 0 &&
        variantsInGroup.every((v) => sel.includes(v.variant_key))
      )
    })

    setSelectedChannelVariants((prev) => {
      const next = { ...prev }
      group.channels.forEach((channel) => {
        const variantsInGroup = variantsForChannelInGroup(group, channel.id, productVariantsByChannel)
        const keys = variantsInGroup.map((v) => v.variant_key)
        if (allSelected) {
          const remaining = (next[channel.id] || []).filter((vk) => !keys.includes(vk))
          if (remaining.length === 0) delete next[channel.id]
          else next[channel.id] = remaining
        } else {
          const cur = new Set(next[channel.id] || [])
          keys.forEach((k) => cur.add(k))
          next[channel.id] = Array.from(cur).sort()
        }
      })
      return next
    })
  }

  // 그룹 확장/축소 토글
  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }))
  }

  // 특정 필드만 복사하는 함수 (대상은 실제 채널 id + variant_key, 저장 시 self는 SELF_GROUP으로 매핑)
  const copyFieldToChannels = async (
    fieldName: string,
    targetPairs: { channelId: string; variantKey: string }[]
  ) => {
    if (!fieldName || targetPairs.length === 0) return

    try {
      const hasSelection = Object.values(selectedChannelVariants).some((arr) => (arr?.length ?? 0) > 0)
      if (!hasSelection) {
        setSaveMessage(t('msgSelectChannelsToCopy'))
        setSaveMessageType('error')
        setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
        return
      }

      // 복사 모달에서 고른 언어의 필드 값 (해당 language_code 행에 덮어씀)
      const copyLang = copySourceLanguage || formData.currentLanguage || 'ko'
      const currentDetails = getDetailsForLanguage(copyLang)
      
      // 복사할 필드 목록 결정
      const fieldsToCopy: string[] = []
      if (fieldName === 'slogan') {
        fieldsToCopy.push('slogan1', 'slogan2', 'slogan3')
      } else if (fieldName === 'included_not_included') {
        fieldsToCopy.push('included', 'not_included')
      } else {
        fieldsToCopy.push(fieldName)
      }

      const rawTargets: { storedChannelId: string; variantKey: string }[] = []
      for (const { channelId, variantKey } of targetPairs) {
        const channel = channels.find((c) => c.id === channelId)
        if (!channel) continue
        const isSelf = channel.type === 'self' || channel.type === 'SELF'
        rawTargets.push({
          storedChannelId: isSelf ? 'SELF_GROUP' : channelId,
          variantKey
        })
      }

      const seen = new Set<string>()
      const saveTargets = rawTargets.filter((t) => {
        const k = `${t.storedChannelId}\t${t.variantKey}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })

      if (saveTargets.length === 0) return

      const copyPromises = saveTargets.map(async ({ storedChannelId: groupChannelId, variantKey: targetVariantKey }) => {
        const existingResult = await supabase
          .from('product_details_multilingual')
          .select('id')
          .eq('product_id', productId)
          .eq('channel_id', groupChannelId)
          .eq('language_code', copyLang)
          .eq('variant_key', targetVariantKey)
          .maybeSingle() as { data: { id: string } | null; error: { code?: string } | null }

        if (existingResult.error && existingResult.error.code !== 'PGRST116') {
          throw existingResult.error
        }

        const existingData = existingResult.data

        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString()
        }
        
        fieldsToCopy.forEach((field) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          updateData[field] = (currentDetails as any)[field]
        })

        if (existingData) {
          const { error: updateError } = await supabase
            .from('product_details_multilingual')
            .update(updateData)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .eq('id', (existingData as any).id)

          if (updateError) throw updateError
        } else {
          const insertData: Record<string, unknown> = {
            product_id: productId,
            channel_id: groupChannelId,
            language_code: copyLang,
            variant_key: targetVariantKey
          }
          fieldsToCopy.forEach((field) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            insertData[field] = (currentDetails as any)[field]
          })
          const { error: insertError } = await (supabase as any)
            .from('product_details_multilingual')
            .insert([insertData])

          if (insertError) throw insertError
        }
      })

      await Promise.all(copyPromises)
      loadSelectedChannelData()
      setSaveMessage(t('msgCopyToChannelsSuccess', { count: saveTargets.length }))
      setSaveMessageType('success')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
      setCopyModalOpen(false)
      setCopyTargetSelections({})
    } catch (error) {
      console.error('필드 복사 오류:', error)
      setSaveMessage(`${t('msgCopyError')}: ${error instanceof Error ? error.message : ''}`)
      setSaveMessageType('error')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 5000)
    }
  }

  // 복사 모달 열기
  const openCopyModal = (fieldName: string) => {
    setCopyFieldName(fieldName)
    setCopySourceLanguage(formData.currentLanguage || 'ko')
    const allChannelIds = channels.map((c) => c.id)
    const init: Record<string, Record<string, boolean>> = {}
    allChannelIds.forEach((id) => {
      if ((selectedChannelVariants[id]?.length ?? 0) === 0) {
        const variants = productVariantsByChannel[id] || [{ variant_key: 'default' }]
        const perVariant: Record<string, boolean> = {}
        variants.forEach((v) => {
          perVariant[v.variant_key] = false
        })
        init[id] = perVariant
      }
    })
    setCopyTargetSelections(init)
    setCopyModalOpen(true)
  }

  // 채널 간 복사
  // 미사용 - 추후 채널 간 복사 기능용
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _copyChannelData = async (fromChannelId: string, toChannelIds: string[]) => {
    if (!fromChannelId || toChannelIds.length === 0) return

    try {
      // fromChannelId가 'SELF_GROUP'인 경우 실제 channel_id로 변환
      const actualFromChannelId = fromChannelId === 'SELF_GROUP' ? 'SELF_GROUP' : fromChannelId
      
      // 복사 소스의 variant_key 가져오기
      const sourceVariantKey = actualFromChannelId === 'SELF_GROUP'
        ? getPrimaryVariantForChannel(
            Object.keys(selectedChannelVariants).find((id) => {
              const ch = channels.find((c) => c.id === id)
              return ch?.type === 'self' || ch?.type === 'SELF'
            }) || ''
          )
        : getPrimaryVariantForChannel(actualFromChannelId)
      
      const { data: sourceData, error: fetchError } = await supabase
        .from('product_details_multilingual')
        .select('*')
        .eq('product_id', productId)
        .eq('channel_id', actualFromChannelId)
        .eq('variant_key', sourceVariantKey)

      if (fetchError) throw fetchError

      if (sourceData && sourceData.length > 0) {
        // 복사 대상 채널들을 그룹화
        const toChannelsData = toChannelIds.map(id => {
          const channel = channels.find(c => c.id === id)
          return { id, type: channel?.type || 'unknown' }
        })
        const selfTargets = toChannelsData.filter(c => c.type === 'self' || c.type === 'SELF')
        const otaTargets = toChannelsData.filter(c => c.type !== 'self' && c.type !== 'SELF')

        // 저장할 채널 그룹 정의
        const channelGroupsToSave: Array<{ channelIds: string[], channelId: string }> = []

        // self 채널들은 하나의 그룹으로 처리
        if (selfTargets.length > 0) {
          channelGroupsToSave.push({
            channelIds: selfTargets.map(c => c.id),
            channelId: 'SELF_GROUP'
          })
        }

        // OTA 채널들은 각각 개별적으로 저장
        otaTargets.forEach(channel => {
          channelGroupsToSave.push({
            channelIds: [channel.id],
            channelId: channel.id
          })
        })

        const copyPromises = channelGroupsToSave.map(async (group) => {
          // 복사 대상의 variant_key 가져오기
          const targetVariantKey = group.channelIds.length === 1
            ? getPrimaryVariantForChannel(group.channelIds[0])
            : 'default'
          
          for (const sourceItem of sourceData as Array<{
            language_code: string
            variant_key?: string | null
            slogan1: string | null
            slogan2: string | null
            slogan3: string | null
            greeting: string | null
            description: string | null
            included: string | null
            not_included: string | null
            pickup_drop_info: string | null
            luggage_info: string | null
            tour_operation_info: string | null
            preparation_info: string | null
            small_group_info: string | null
            companion_recruitment_info: string | null
            notice_info: string | null
            important_notes: string | null
            private_tour_info: string | null
            cancellation_policy: string | null
            chat_announcement: string | null
            tags: string[] | null
          }>) {
            const copyData = {
              product_id: productId,
              channel_id: group.channelId, // self 채널은 'SELF_GROUP', OTA는 개별 channel_id
              language_code: sourceItem.language_code,
              variant_key: targetVariantKey, // variant_key 추가
              slogan1: sourceItem.slogan1,
              slogan2: sourceItem.slogan2,
              slogan3: sourceItem.slogan3,
              greeting: sourceItem.greeting,
              description: sourceItem.description,
              included: sourceItem.included,
              not_included: sourceItem.not_included,
              pickup_drop_info: sourceItem.pickup_drop_info,
              luggage_info: sourceItem.luggage_info,
              tour_operation_info: sourceItem.tour_operation_info,
              preparation_info: sourceItem.preparation_info,
              small_group_info: sourceItem.small_group_info,
              companion_recruitment_info: sourceItem.companion_recruitment_info,
              notice_info: sourceItem.notice_info,
              important_notes: sourceItem.important_notes,
              private_tour_info: sourceItem.private_tour_info,
              cancellation_policy: sourceItem.cancellation_policy,
              chat_announcement: sourceItem.chat_announcement,
              tags: sourceItem.tags
            }

            // 기존 데이터 확인
            const { data: existingData, error: selectError } = await supabase
              .from('product_details_multilingual')
              .select('id')
              .eq('product_id', productId)
              .eq('channel_id', group.channelId)
              .eq('language_code', sourceItem.language_code)
              .eq('variant_key', targetVariantKey)
              .maybeSingle()

            if (selectError && selectError.code !== 'PGRST116') {
              console.error(`채널 그룹 ${group.channelId} 데이터 확인 오류:`, selectError)
              throw selectError
            }

            if (existingData) {
              // 업데이트
              const { error: updateError } = await supabase
                .from('product_details_multilingual')
                .update({
                  ...copyData,
                  updated_at: new Date().toISOString()
                })
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .eq('id', (existingData as any).id)

              if (updateError) {
                console.error(`채널 그룹 ${group.channelId} 복사 오류:`, updateError)
                throw new Error(`채널 그룹 ${group.channelId} 복사 실패: ${updateError.message}`)
              }
            } else {
              // 삽입
              const { error: insertError } = await supabase
                .from('product_details_multilingual')
                .insert([copyData])

              if (insertError) {
                console.error(`채널 그룹 ${group.channelId} 복사 오류:`, insertError)
                throw new Error(`채널 그룹 ${group.channelId} 복사 실패: ${insertError.message}`)
              }
            }
          }
        })

        await Promise.all(copyPromises)
        
        // 복사 후 데이터 새로고침
        loadSelectedChannelData()
        
        setSaveMessage(t('msgCopyDataSuccess', { count: toChannelIds.length }))
        setSaveMessageType('success')
        setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
      }
    } catch (error) {
      console.error('채널 데이터 복사 오류:', error)
      
      let errorMessage = ''
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = String((error as { message?: string }).message)
        } else if ('error' in error) {
          errorMessage = String((error as { error?: unknown }).error)
        }
      }
      
      setSaveMessage(`${t('msgChannelCopyError')}: ${errorMessage || ''}`)
      setSaveMessageType('error')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 5000)
    }
  }

  // 선택된 채널·variant 쌍마다 세부 정보 저장 (self는 SELF_GROUP+variant별로 중복 제거)
  const saveSelectedChannelsDetails = async () => {
    if (selectedPairCount === 0) {
      setSaveMessage(t('msgSelectChannelsToSave'))
      setSaveMessageType('error')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
      return
    }

    setSaving(true)
    setSaveMessage('')
    setSaveMessageType(null)

    try {
      const currentLang = formData.currentLanguage || 'ko'
      const currentDetails = getCurrentLanguageDetails()

      const rawTargets: { storedChannelId: string; variantKey: string }[] = []
      for (const channelId of Object.keys(selectedChannelVariants)) {
        const vks = selectedChannelVariants[channelId] || []
        if (vks.length === 0) continue
        const channel = channels.find((c) => c.id === channelId)
        if (!channel) continue
        const isSelf = channel.type === 'self' || channel.type === 'SELF'
        for (const vk of vks) {
          rawTargets.push({
            storedChannelId: isSelf ? 'SELF_GROUP' : channelId,
            variantKey: vk
          })
        }
      }

      const seen = new Set<string>()
      const saveTargets = rawTargets.filter((t) => {
        const k = `${t.storedChannelId}\t${t.variantKey}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })

      const savePromises = saveTargets.map(async ({ storedChannelId: groupChannelId, variantKey: groupVariantKey }) => {
        // 빈 문자열을 null로 변환하는 헬퍼 함수
        // HTML 태그만 있는 빈 문자열도 처리
        const toNullIfEmpty = (value: string | null | undefined): string | null => {
          if (value === null || value === undefined) return null
          if (typeof value !== 'string') return null
          
          // HTML 태그 제거 후 trim
          const textContent = value.replace(/<[^>]*>/g, '').trim()
          if (textContent === '') return null
          
          return value
        }

        const detailsData = {
          product_id: productId,
          channel_id: groupChannelId, // self 채널은 'SELF_GROUP', OTA는 개별 channel_id
          language_code: currentLang,
          variant_key: groupVariantKey,
          slogan1: toNullIfEmpty(currentDetails.slogan1),
          slogan2: toNullIfEmpty(currentDetails.slogan2),
          slogan3: toNullIfEmpty(currentDetails.slogan3),
          greeting: toNullIfEmpty(currentDetails.greeting),
          description: toNullIfEmpty(currentDetails.description),
          included: toNullIfEmpty(currentDetails.included),
          not_included: toNullIfEmpty(currentDetails.not_included),
          pickup_drop_info: toNullIfEmpty(currentDetails.pickup_drop_info),
          luggage_info: toNullIfEmpty(currentDetails.luggage_info),
          tour_operation_info: toNullIfEmpty(currentDetails.tour_operation_info),
          preparation_info: toNullIfEmpty(currentDetails.preparation_info),
          small_group_info: toNullIfEmpty(currentDetails.small_group_info),
          companion_recruitment_info: toNullIfEmpty(currentDetails.companion_recruitment_info),
          notice_info: toNullIfEmpty(currentDetails.notice_info),
          important_notes: toNullIfEmpty(currentDetails.important_notes),
          private_tour_info: toNullIfEmpty(currentDetails.private_tour_info),
          cancellation_policy: toNullIfEmpty(currentDetails.cancellation_policy),
          chat_announcement: toNullIfEmpty(currentDetails.chat_announcement),
          tags: currentDetails.tags ?? null,
          section_titles: getCurrentSectionTitles(),
          customer_page_visibility: getCustomerPageVisibilityForSave(),
        }
        
        const channelIdLabel =
          groupChannelId === 'SELF_GROUP'
            ? `self 채널 그룹 · variant ${groupVariantKey}`
            : `${groupChannelId} · variant ${groupVariantKey}`

        console.log(`채널 그룹 ${channelIdLabel} 저장할 상세 정보:`, {
          channelId: groupChannelId,
          variant_key: groupVariantKey,
          private_tour_info: detailsData.private_tour_info,
          private_tour_info_type: typeof detailsData.private_tour_info,
          private_tour_info_length: detailsData.private_tour_info?.length,
          chat_announcement: detailsData.chat_announcement,
          chat_announcement_type: typeof detailsData.chat_announcement,
          chat_announcement_length: detailsData.chat_announcement?.length,
          original_private_tour_info: currentDetails.private_tour_info,
          original_private_tour_info_length: currentDetails.private_tour_info?.length,
          original_chat_announcement: currentDetails.chat_announcement,
          original_chat_announcement_length: currentDetails.chat_announcement?.length,
          formData_private_tour_info: formData.productDetails?.[currentLang]?.private_tour_info,
          formData_private_tour_info_length: formData.productDetails?.[currentLang]?.private_tour_info?.length,
          formData_chat_announcement: formData.productDetails?.[currentLang]?.chat_announcement,
          formData_chat_announcement_length: formData.productDetails?.[currentLang]?.chat_announcement?.length,
          allFields: detailsData
        })
        
        // 기존 데이터 확인 (product_id, channel_id, language_code, variant_key 조합으로)
        const { data: existingData, error: selectError } = await supabase
          .from('product_details_multilingual')
          .select('id')
          .eq('product_id', productId)
          .eq('channel_id', groupChannelId)
          .eq('language_code', currentLang)
          .eq('variant_key', groupVariantKey)
          .maybeSingle()

        if (selectError && selectError.code !== 'PGRST116') {
          console.error(`채널 그룹 ${channelIdLabel} 데이터 확인 오류:`, selectError)
          throw selectError
        }

        if (existingData) {
          // 업데이트
          const { error: updateError } = await supabase
            .from('product_details_multilingual')
            .update({
              ...detailsData,
              updated_at: new Date().toISOString()
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .eq('id', (existingData as any).id)
          
          if (updateError) {
            console.error(`채널 그룹 ${channelIdLabel} 업데이트 오류:`, updateError)
            throw new Error(`채널 그룹 ${channelIdLabel} 업데이트 실패: ${updateError.message}`)
          } else {
            // 업데이트 후 실제 저장된 값 확인
            const { data: savedData, error: verifyError } = await supabase
              .from('product_details_multilingual')
              .select('private_tour_info, chat_announcement')
              .eq('product_id', productId)
              .eq('channel_id', groupChannelId)
              .eq('language_code', currentLang)
              .eq('variant_key', groupVariantKey)
              .maybeSingle() as { data: { private_tour_info: string | null; chat_announcement: string | null } | null; error: unknown }
            
            if (!verifyError && savedData) {
              console.log(`채널 그룹 ${channelIdLabel} 저장 후 확인:`, {
                private_tour_info: savedData.private_tour_info,
                private_tour_info_length: savedData.private_tour_info?.length,
                chat_announcement: savedData.chat_announcement,
                chat_announcement_length: savedData.chat_announcement?.length
              })
            }
          }
        } else {
          // 이제 unique constraint가 (product_id, language_code, channel_id)로 업데이트되었으므로
          // 직접 insert를 시도하고, 중복 오류가 발생하면 업데이트
          const { error: insertError } = await supabase
            .from('product_details_multilingual')
            .insert([detailsData])
          
          if (insertError) {
            // 중복 키 오류인 경우 (23505) - 이미 같은 (product_id, language_code, channel_id) 조합이 존재
            if (insertError.code === '23505') {
              // 기존 레코드를 찾아 업데이트
              const { data: existingRecord, error: findError } = await supabase
                .from('product_details_multilingual')
                .select('id')
                .eq('product_id', productId)
                .eq('language_code', currentLang)
                .eq('channel_id', groupChannelId)
                .eq('variant_key', groupVariantKey)
                .maybeSingle()

              if (findError && findError.code !== 'PGRST116') {
                console.error(`채널 그룹 ${channelIdLabel} 생성 오류 (중복 키 후 재확인 실패):`, findError)
                throw new Error(`채널 그룹 ${channelIdLabel} 생성 실패: ${insertError.message}`)
              }

              if (existingRecord) {
                const { error: updateError } = await supabase
                  .from('product_details_multilingual')
                  .update({
                    ...detailsData,
                    updated_at: new Date().toISOString()
                  })
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .eq('id', (existingRecord as any).id)

                if (updateError) {
                  console.error(`채널 그룹 ${channelIdLabel} 업데이트 오류:`, updateError)
                  throw new Error(`채널 그룹 ${channelIdLabel} 업데이트 실패: ${updateError.message}`)
                } else {
                  // 업데이트 후 실제 저장된 값 확인
                  const { data: savedData, error: verifyError } = await supabase
                    .from('product_details_multilingual')
                    .select('private_tour_info, chat_announcement')
                    .eq('product_id', productId)
                    .eq('channel_id', groupChannelId)
                    .eq('language_code', currentLang)
                    .eq('variant_key', groupVariantKey)
                    .maybeSingle() as { data: { private_tour_info: string | null; chat_announcement: string | null } | null; error: unknown }
                  
                  if (!verifyError && savedData) {
                    console.log(`채널 그룹 ${channelIdLabel} 저장 후 확인 (중복키 처리):`, {
                      private_tour_info: savedData.private_tour_info,
                      private_tour_info_length: savedData.private_tour_info?.length,
                      chat_announcement: savedData.chat_announcement,
                      chat_announcement_length: savedData.chat_announcement?.length
                    })
                  }
                }
              } else {
                console.error(`채널 그룹 ${channelIdLabel} 생성 오류 (레코드를 찾을 수 없음):`, insertError)
                throw new Error(`채널 그룹 ${channelIdLabel} 생성 실패: ${insertError.message}`)
              }
            } else {
              console.error(`채널 그룹 ${channelIdLabel} 생성 오류:`, insertError)
              throw new Error(`채널 그룹 ${channelIdLabel} 생성 실패: ${insertError.message}`)
            }
          }
        }
      })

      await Promise.all(savePromises)

      setSaveMessage(`${saveTargets.length}개 채널·variant 행에 세부 정보가 저장되었습니다!`)
      setTimeout(() => setSaveMessage(''), 3000)
      
      // 저장 후 데이터 새로고침
      loadSelectedChannelData()
      // 완성도 통계도 새로고침
      loadChannelCompletionStats()
    } catch (error) {
      console.error('선택된 채널 세부 정보 저장 오류:', error)
      
      // 에러 메시지 생성
      let errorMessage = '알 수 없는 오류'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object') {
        // Supabase 에러 객체인 경우
        if ('message' in error) {
          errorMessage = String(error.message)
        } else if ('error' in error) {
          errorMessage = String(error.error)
        }
      }
      
      setSaveMessage(`채널별 세부 정보 저장 중 오류가 발생했습니다: ${errorMessage}`)
      setTimeout(() => setSaveMessage(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  const resolveStoredChannelId = (channelId: string): string => {
    const channel = channels.find(c => c.id === channelId)
    return (channel?.type === 'self' || channel?.type === 'SELF') ? 'SELF_GROUP' : channelId
  }

  // Import 모달: 소스 언어·채널별로 해당 섹션 필드 존재 여부·글자 수(태그 제외 순문자 기준)
  useEffect(() => {
    if (!importFieldModalOpen || !previewEditingField || !productId || isNewProduct || channels.length === 0) {
      return
    }

    const field = previewEditingField
    let cancelled = false
    setImportStatsLoading(true)

    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('product_details_multilingual')
          .select(`channel_id, variant_key, ${String(field)}`)
          .eq('product_id', productId)
          .eq('language_code', importSourceLanguage)

        if (cancelled) return
        if (error) {
          console.error('Import 소스 통계 로드 실패:', error)
          setImportChannelStats({})
          return
        }

        const rows = (data || []) as Array<Record<string, unknown>>
        const stats: Record<string, { plainLen: number; hasContent: boolean }> = {}
        for (const ch of channels) {
          const sid = resolveStoredChannelId(ch.id)
          const vk = (selectedChannelVariants[ch.id]?.[0]) || 'default'
          const row = rows.find(
            (r) => String(r.channel_id) === sid && String(r.variant_key || 'default') === vk
          )
          const raw = rowFieldValueToString(row, field)
          const plainLen = plainTextLenForImport(raw)
          stats[ch.id] = { plainLen, hasContent: plainLen > 0 }
        }
        setImportChannelStats(stats)
      } finally {
        if (!cancelled) setImportStatsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    importFieldModalOpen,
    previewEditingField,
    importSourceLanguage,
    productId,
    isNewProduct,
    supabase,
    channels,
    selectedChannelVariants
  ])

  const importSectionFromChannel = async () => {
    if (!previewEditingField || !importSourceChannelId) {
      setSaveMessage('가져올 채널을 선택해주세요.')
      setSaveMessageType('error')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 2500)
      return
    }

    const targetLang = formData.currentLanguage || 'ko'
    const sourceStoredChannelId = resolveStoredChannelId(importSourceChannelId)
    const sourceVariantKey = getPrimaryVariantForChannel(importSourceChannelId)

    setImportingField(true)
    try {
      const { data, error } = await supabase
        .from('product_details_multilingual')
        .select(previewEditingField)
        .eq('product_id', productId)
        .eq('channel_id', sourceStoredChannelId)
        .eq('language_code', importSourceLanguage)
        .eq('variant_key', sourceVariantKey)
        .maybeSingle() as { data: Record<string, string | null> | null; error: { message?: string; code?: string } | null }

      if (error && error.code !== 'PGRST116') {
        throw new Error(error.message || '채널 데이터 조회 실패')
      }
      if (!data) {
        throw new Error('선택한 채널/variant·언어에 해당 섹션 데이터가 없습니다.')
      }

      const incoming = rowFieldValueToString(data as Record<string, unknown>, previewEditingField)
      if (plainTextLenForImport(incoming) === 0) {
        throw new Error('가져올 텍스트가 비어 있습니다.')
      }
      handleInputChange(previewEditingField, incoming)
      setImportFieldModalOpen(false)
      const cross = importSourceLanguage !== targetLang
      setSaveMessage(
        cross
          ? `[${importSourceLanguage.toUpperCase()}] → [${targetLang.toUpperCase()}] 섹션 내용을 가져왔습니다. 저장 버튼을 눌러 반영하세요.`
          : '섹션 내용을 가져왔습니다. 저장 버튼을 눌러 반영하세요.'
      )
      setSaveMessageType('success')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
    } catch (error) {
      setSaveMessage(`가져오기 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
      setSaveMessageType('error')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3500)
    } finally {
      setImportingField(false)
    }
  }

  // 상품 세부정보 로드 함수
  const loadProductDetails = useCallback(async () => {
    if (isNewProduct) return

    try {
      let detailsData: Array<{
        channel_id: string | null
        language_code: string | null
        slogan1: string | null
        slogan2: string | null
        slogan3: string | null
        greeting: string | null
        description: string | null
        included: string | null
        not_included: string | null
        pickup_drop_info: string | null
        luggage_info: string | null
        tour_operation_info: string | null
        preparation_info: string | null
        small_group_info: string | null
        companion_recruitment_info: string | null
        notice_info: string | null
        important_notes: string | null
        private_tour_info: string | null
        cancellation_policy: string | null
        chat_announcement: string | null
        tags: string[] | null
        section_titles?: Record<string, string> | null
        customer_page_visibility?: unknown
      }> | null = null
      let detailsError: { code?: string } | null = null

        // 채널별 product_details_multilingual — channel_id NULL 행을 언어별 기본으로 두고 병합
        const { data: allData, error: allError } = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', productId) as { 
            data: Array<{
              channel_id: string | null
              language_code: string | null
              slogan1: string | null
              slogan2: string | null
              slogan3: string | null
              greeting: string | null
              description: string | null
              included: string | null
              not_included: string | null
              pickup_drop_info: string | null
              luggage_info: string | null
              tour_operation_info: string | null
              preparation_info: string | null
              small_group_info: string | null
              companion_recruitment_info: string | null
              notice_info: string | null
              important_notes: string | null
              private_tour_info: string | null
              cancellation_policy: string | null
              chat_announcement: string | null
              tags: string[] | null
              section_titles?: Record<string, string> | null
              customer_page_visibility?: unknown
            }> | null
            error: unknown
          }
        
        if (allError) {
          console.error('데이터 로드 오류:', allError)
          detailsData = null
          detailsError = allError
        } else if (allData && allData.length > 0) {
          console.log('로드된 모든 데이터:', allData)
          // 각 항목의 channel_id 확인
          allData.forEach((item, index) => {
            console.log(`데이터 ${index}: language_code=${item.language_code}, channel_id=${item.channel_id}, channel_id === null: ${item.channel_id === null}`)
          })
          
          // 각 언어별로 데이터를 병합하여 사용
          // channel_id가 NULL인 데이터를 기본으로 하고, 채널별 데이터에서 비어있는 필드를 채워넣음
          const languageMap = new Map<string, typeof allData[0]>()
          
          // 먼저 channel_id가 NULL인 데이터를 언어별로 저장 (기본 데이터)
          allData.forEach(item => {
            if ((item.channel_id === null || item.channel_id === undefined) && item.language_code) {
              const lang = item.language_code
              if (!languageMap.has(lang)) {
                languageMap.set(lang, item)
              }
            }
          })
          
          // 채널별 데이터에서 비어있는 필드를 채워넣음
          allData.forEach(item => {
            if (item.language_code) {
              const lang = item.language_code
              const existing = languageMap.get(lang)
              
              if (!existing) {
                // 기본 데이터가 없으면 채널별 데이터를 사용
                languageMap.set(lang, item)
              } else {
                // 기본 데이터가 있으면, 비어있는 필드를 채널별 데이터로 채움
                // 특히 private_tour_info 같은 필드가 비어있으면 채널별 데이터 사용
                const needsMerge = (
                  (!existing.private_tour_info || existing.private_tour_info.trim() === '') &&
                  item.private_tour_info && item.private_tour_info.trim() !== ''
                ) || (
                  (!existing.chat_announcement || existing.chat_announcement.trim() === '') &&
                  item.chat_announcement && item.chat_announcement.trim() !== ''
                )
                
                if (needsMerge) {
                  // 병합: 기존 데이터를 유지하되, 비어있는 필드는 채널별 데이터로 채움
                  languageMap.set(lang, {
                    ...existing,
                    private_tour_info: existing.private_tour_info && existing.private_tour_info.trim() !== '' 
                      ? existing.private_tour_info 
                      : (item.private_tour_info || existing.private_tour_info),
                    chat_announcement: existing.chat_announcement && existing.chat_announcement.trim() !== ''
                      ? existing.chat_announcement
                      : (item.chat_announcement || existing.chat_announcement)
                  } as typeof allData[0])
                }
              }
            }
          })
          
          // Map을 배열로 변환
          detailsData = Array.from(languageMap.values())
          console.log('언어별로 선택된 데이터:', detailsData)
          console.log('사용할 데이터 길이:', detailsData?.length)
          detailsData.forEach((item, idx) => {
            console.log(`[${idx}] language_code: ${item.language_code}, channel_id: ${item.channel_id}, private_tour_info: ${item.private_tour_info ? item.private_tour_info.substring(0, 50) + '...' : '(empty)'}`)
          })
          detailsError = null
        } else {
          console.log('데이터가 없습니다.')
          detailsData = null
          detailsError = null
        }

      if (detailsError && detailsError.code !== 'PGRST116') { // PGRST116은 데이터가 없을 때 발생
        throw detailsError
      }

      // 다국어 데이터를 언어별로 매핑
      const multilingualDetails: Record<string, ProductDetailsFields> = {}
      const loadedTitlesByLanguage: Record<string, Partial<Record<keyof ProductDetailsFields, string>>> = {}
      const loadedCustomerPageVisibilityByLanguage: Record<
        string,
        Partial<Record<keyof ProductDetailsFields, boolean>>
      > = {}

      console.log('매핑 전 detailsData:', detailsData)
      console.log('매핑 전 detailsData 타입:', Array.isArray(detailsData) ? '배열' : typeof detailsData)
      console.log('매핑 전 detailsData 길이:', Array.isArray(detailsData) ? detailsData.length : 'N/A')
      
      if (Array.isArray(detailsData) && detailsData.length > 0) {
        // 여러 언어 데이터가 있는 경우
        console.log('배열 순회 시작, 항목 수:', detailsData.length)
        detailsData.forEach((item, index) => {
          const langCode = item.language_code || 'ko'
          console.log(`[${index}] 언어 ${langCode} 데이터 매핑:`, item)
          console.log(`[${index}] item.channel_id:`, item.channel_id)
          console.log(`[${index}] item.language_code:`, item.language_code)
          if (item.section_titles && typeof item.section_titles === 'object') {
            loadedTitlesByLanguage[langCode] = item.section_titles as Partial<Record<keyof ProductDetailsFields, string>>
          }
          if (item.customer_page_visibility) {
            loadedCustomerPageVisibilityByLanguage[langCode] = visibilityRowToPartial(
              item.customer_page_visibility
            )
          }
          multilingualDetails[langCode] = {
            slogan1: item.slogan1 ?? '',
            slogan2: item.slogan2 ?? '',
            slogan3: item.slogan3 ?? '',
            greeting: item.greeting ?? '',
            description: item.description ?? '',
            included: item.included ?? '',
            not_included: item.not_included ?? '',
            pickup_drop_info: item.pickup_drop_info ?? '',
            luggage_info: item.luggage_info ?? '',
            tour_operation_info: item.tour_operation_info ?? '',
            preparation_info: item.preparation_info ?? '',
            small_group_info: item.small_group_info ?? '',
            companion_recruitment_info: item.companion_recruitment_info ?? '',
            notice_info: item.notice_info ?? '',
            important_notes: item.important_notes ?? '',
            private_tour_info: item.private_tour_info ?? '',
            cancellation_policy: item.cancellation_policy ?? '',
            chat_announcement: item.chat_announcement ?? '',
            tags: item.tags ?? []
          }
        })
      } else if (detailsData && !Array.isArray(detailsData)) {
        // 단일 언어 데이터가 있는 경우
        console.log('단일 언어 데이터:', detailsData)
        const item = detailsData as {
          language_code: string | null
          slogan1: string | null
          slogan2: string | null
          slogan3: string | null
          greeting: string | null
          description: string | null
          included: string | null
          not_included: string | null
          pickup_drop_info: string | null
          luggage_info: string | null
          tour_operation_info: string | null
          preparation_info: string | null
          small_group_info: string | null
          companion_recruitment_info: string | null
          notice_info: string | null
          important_notes: string | null
          private_tour_info: string | null
          cancellation_policy: string | null
          chat_announcement: string | null
          tags: string[] | null
          section_titles?: Record<string, string> | null
          customer_page_visibility?: unknown
        }
        const langCode = item.language_code || 'ko'
        if (item.section_titles && typeof item.section_titles === 'object') {
          loadedTitlesByLanguage[langCode] = item.section_titles as Partial<Record<keyof ProductDetailsFields, string>>
        }
        if (item.customer_page_visibility) {
          loadedCustomerPageVisibilityByLanguage[langCode] = visibilityRowToPartial(
            item.customer_page_visibility
          )
        }
        multilingualDetails[langCode] = {
          slogan1: item.slogan1 ?? '',
          slogan2: item.slogan2 ?? '',
          slogan3: item.slogan3 ?? '',
          greeting: item.greeting ?? '',
          description: item.description ?? '',
          included: item.included ?? '',
          not_included: item.not_included ?? '',
          pickup_drop_info: item.pickup_drop_info ?? '',
          luggage_info: item.luggage_info ?? '',
          tour_operation_info: item.tour_operation_info ?? '',
          preparation_info: item.preparation_info ?? '',
          small_group_info: item.small_group_info ?? '',
          companion_recruitment_info: item.companion_recruitment_info ?? '',
          notice_info: item.notice_info ?? '',
          important_notes: item.important_notes ?? '',
          private_tour_info: item.private_tour_info ?? '',
          cancellation_policy: item.cancellation_policy ?? '',
          chat_announcement: item.chat_announcement ?? '',
          tags: item.tags ?? []
        }
      }
      
      console.log('매핑 후 multilingualDetails:', multilingualDetails)

      // 기본 한국어 데이터가 없으면 빈 데이터 추가
      if (!multilingualDetails.ko) {
        multilingualDetails.ko = {
          slogan1: '',
          slogan2: '',
          slogan3: '',
          greeting: '',
          description: '',
          included: '',
          not_included: '',
          pickup_drop_info: '',
          luggage_info: '',
          tour_operation_info: '',
          preparation_info: '',
          small_group_info: '',
          companion_recruitment_info: '',
          notice_info: '',
          important_notes: '',
          private_tour_info: '',
          cancellation_policy: '',
          chat_announcement: '',
          tags: []
        }
      }

      // formData 업데이트
      console.log('formData 업데이트 전 multilingualDetails:', multilingualDetails)
      console.log('multilingualDetails.ko:', multilingualDetails.ko)
      console.log('multilingualDetails.en:', multilingualDetails.en)
      
      setFormData(prev => {
        const hasChannelSelection = Object.values(selectedChannelVariantsRef.current).some(
          (arr) => (arr?.length ?? 0) > 0
        )

        let nextProductDetails: Record<string, ProductDetailsFields>
        if (hasChannelSelection) {
          nextProductDetails = { ...prev.productDetails }
          for (const [lang, details] of Object.entries(multilingualDetails)) {
            const existing = prev.productDetails?.[lang]
            nextProductDetails[lang] = existing ? { ...details, ...existing } : details
          }
        } else {
          nextProductDetails = multilingualDetails
        }

        const currentLang = prev.currentLanguage || 'ko'
        const currentDetails = prev.productDetails?.[currentLang]
        const newDetails = nextProductDetails[currentLang]

        if (
          currentDetails &&
          newDetails &&
          JSON.stringify(currentDetails) === JSON.stringify(newDetails) &&
          JSON.stringify(prev.productDetails) === JSON.stringify(nextProductDetails) &&
          prev.useCommonDetails === false
        ) {
          return prev
        }

        return {
          ...prev,
          productDetails: nextProductDetails,
          useCommonDetails: false
        }
      })
      setSectionTitleOverridesByLanguage(prev => ({
        ...prev,
        ...loadedTitlesByLanguage
      }))
      setCustomerPageVisibilityByLanguage((prev) => ({
        ...prev,
        ...loadedCustomerPageVisibilityByLanguage,
      }))

      console.log('상품 세부정보 로드 완료:', multilingualDetails)
    } catch (error) {
      console.error('상품 세부정보 로드 오류:', error)
    }
  }, [productId, isNewProduct, supabase, setFormData])

  // 초기 로드 (한 번만 실행)
  useEffect(() => {
    loadChannels()
    if (!isNewProduct) {
      loadProductDetails()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 의존성 배열을 비워서 한 번만 실행

  // 채널별 데이터 완성도 계산 함수
  const loadChannelCompletionStats = useCallback(async () => {
    if (isNewProduct || !productId || channels.length === 0) {
      setChannelCompletionStats({})
      return
    }

    try {
      // 현재 선택된 언어 사용
      const currentLang = formData.currentLanguage || 'ko'

      const completionStats: Record<string, {
        completed: number;
        total: number;
        percentage: number;
        missingFields: string[];
      }> = {}

      // 필수 필드 목록
      const requiredFields = [
        'slogan1', 'slogan2', 'slogan3',
        'greeting',
        'description',
        'included', 'not_included',
        'pickup_drop_info',
        'luggage_info',
        'tour_operation_info',
        'preparation_info',
        'small_group_info',
        'companion_recruitment_info',
        'notice_info',
        'important_notes',
        'private_tour_info',
        'cancellation_policy',
        'chat_announcement'
      ]

      // 각 채널별로 완성도 계산
      for (const channel of channels) {
        const channelId = channel.type === 'self' || channel.type === 'SELF' 
          ? 'SELF_GROUP' 
          : channel.id

        // 해당 채널의 모든 variant 데이터 가져오기 (현재 선택된 언어 기준)
        const { data: channelData, error } = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', productId)
          .eq('channel_id', channelId)
          .eq('language_code', currentLang) // 현재 선택된 언어 기준으로 계산

        if (error && error.code !== 'PGRST116') {
          console.error(`채널 ${channel.id} 완성도 계산 오류:`, error)
          continue
        }

        // 모든 variant의 데이터를 병합하여 확인
        const allVariantsData = channelData || []
        
        // 각 variant별로 완성도 계산하고, 가장 높은 완성도를 채널 완성도로 사용
        let maxCompleted = 0
        let maxTotal = requiredFields.length
        let maxMissingFields: string[] = []

        if (allVariantsData.length === 0) {
          // 데이터가 전혀 없는 경우
          completionStats[channel.id] = {
            completed: 0,
            total: maxTotal,
            percentage: 0,
            missingFields: requiredFields
          }
        } else {
          // 각 variant별로 완성도 계산
          const variantCompletions = allVariantsData.map((variantData: any) => {
            let completed = 0
            const missing: string[] = []

            requiredFields.forEach(field => {
              const value = variantData[field]
              const hasValue = value !== null && value !== undefined && 
                              (typeof value === 'string' ? value.trim() !== '' : true)
              
              if (hasValue) {
                completed++
              } else {
                missing.push(field)
              }
            })

            return { completed, missing }
          })

          // 가장 높은 완성도 찾기
          const bestCompletion = variantCompletions.reduce((best, current) => 
            current.completed > best.completed ? current : best
          , { completed: 0, missing: requiredFields })

          maxCompleted = bestCompletion.completed
          maxMissingFields = bestCompletion.missing
        }

        completionStats[channel.id] = {
          completed: maxCompleted,
          total: maxTotal,
          percentage: Math.round((maxCompleted / maxTotal) * 100),
          missingFields: maxMissingFields
        }
      }

      setChannelCompletionStats(completionStats)
    } catch (error) {
      console.error('채널별 완성도 계산 오류:', error)
      setChannelCompletionStats({})
    }
  }, [productId, channels, isNewProduct, supabase, formData.currentLanguage])

  // 채널 목록이 로드된 후 통계 로드
  useEffect(() => {
    if (channels.length > 0 && !isNewProduct && productId) {
      loadChannelPricingStats()
      loadChannelCompletionStats()
    }
  }, [channels.length, isNewProduct, productId, loadChannelPricingStats, loadChannelCompletionStats])

  // 채널·variant 선택 변경 시 데이터 로드
  useEffect(() => {
    const hasSelection = Object.values(selectedChannelVariants).some((arr) => (arr?.length ?? 0) > 0)
    if (!hasSelection) {
      loadProductDetails()
    } else {
      loadSelectedChannelData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannelVariants])

  const getDetailsForLanguage = (lang: string): ProductDetailsFields => {
    const existingDetails = formData.productDetails?.[lang] || {}
    return {
      slogan1: existingDetails.slogan1 ?? '',
      slogan2: existingDetails.slogan2 ?? '',
      slogan3: existingDetails.slogan3 ?? '',
      greeting: existingDetails.greeting ?? '',
      description: existingDetails.description ?? '',
      included: existingDetails.included ?? '',
      not_included: existingDetails.not_included ?? '',
      pickup_drop_info: existingDetails.pickup_drop_info ?? '',
      luggage_info: existingDetails.luggage_info ?? '',
      tour_operation_info: existingDetails.tour_operation_info ?? '',
      preparation_info: existingDetails.preparation_info ?? '',
      small_group_info: existingDetails.small_group_info ?? '',
      companion_recruitment_info: existingDetails.companion_recruitment_info ?? '',
      notice_info: existingDetails.notice_info ?? '',
      important_notes: existingDetails.important_notes ?? '',
      private_tour_info: existingDetails.private_tour_info ?? '',
      cancellation_policy: existingDetails.cancellation_policy ?? '',
      chat_announcement: existingDetails.chat_announcement ?? '',
      tags: existingDetails.tags ?? []
    }
  }

  // 현재 언어의 상세 정보 가져오기
  const getCurrentLanguageDetails = (): ProductDetailsFields => {
    const currentLang = formData.currentLanguage || 'ko'
    const details = getDetailsForLanguage(currentLang)

    // 디버깅: 현재 언어의 상세 정보 확인
    const existingDetails = formData.productDetails?.[currentLang] || {}
    console.log('=== ProductDetailsTab Debug ===')
    console.log('currentLang:', currentLang)
    console.log('formData.productDetails:', formData.productDetails)
    console.log('formData.productDetails[currentLang]:', formData.productDetails?.[currentLang])
    console.log('existingDetails.private_tour_info:', existingDetails.private_tour_info, 'type:', typeof existingDetails.private_tour_info, 'hasField:', 'private_tour_info' in existingDetails)
    console.log('existingDetails.chat_announcement:', existingDetails.chat_announcement, 'type:', typeof existingDetails.chat_announcement, 'hasField:', 'chat_announcement' in existingDetails)
    console.log('details.private_tour_info:', details.private_tour_info, 'length:', details.private_tour_info?.length)
    console.log('details.chat_announcement:', details.chat_announcement, 'length:', details.chat_announcement?.length)

    return details
  }

  // 언어 변경 핸들러
  const handleLanguageChange = (newLanguage: string) => {
    setFormData(prev => ({
      ...prev,
      currentLanguage: newLanguage
    }))
  }

  const getValue = (field: keyof ProductDetailsFields, forceChannelData = false) => {
    const currentDetails = getCurrentLanguageDetails()
    const hasSelectedChannels = selectedPairCount > 0

    if (forceChannelData || hasSelectedChannels) {
      return currentDetails[field] ?? ''
    }

    return currentDetails[field] ?? ''
  }

  const handleInputChange = (field: keyof ProductDetailsFields, value: string) => {
    const currentLang = formData.currentLanguage || 'ko'
    console.log(`handleInputChange 호출: field=${field}, value=`, value?.substring(0, 100), `length=${value?.length}, type=${typeof value}`)
    console.log(`handleInputChange 이전 formData:`, {
      before: formData.productDetails?.[currentLang]?.[field],
      beforeType: typeof formData.productDetails?.[currentLang]?.[field]
    })
    
    setFormData((prev) => {
      const updated = {
        ...prev,
        productDetails: {
          ...prev.productDetails,
          [currentLang]: {
            ...prev.productDetails?.[currentLang],
            [field]: value
          }
        }
      }
      console.log(`handleInputChange 후 formData 업데이트:`, {
        field,
        newValue: updated.productDetails[currentLang]?.[field],
        newValueType: typeof updated.productDetails[currentLang]?.[field],
        newValueLength: updated.productDetails[currentLang]?.[field]?.length,
        fullProductDetails: updated.productDetails[currentLang]
      })
      return updated
    })
  }

  // const handleUseCommonChange = (field: keyof ProductDetailsFields, useCommon: boolean) => {
  //   const currentLang = formData.currentLanguage || 'ko'
  //   setFormData((prev) => {
  //     const currentUseCommonForField = prev.useCommonForField?.[currentLang] || {
  //       slogan1: false,
  //       slogan2: false,
  //       slogan3: false,
  //       description: false,
  //       included: false,
  //       not_included: false,
  //       pickup_drop_info: false,
  //       luggage_info: false,
  //       tour_operation_info: false,
  //       preparation_info: false,
  //       small_group_info: false,
  //       companion_info: false,
  //       exclusive_booking_info: false,
  //       cancellation_policy: false,
  //       chat_announcement: false,
  //       tags: false
  //     }
      
  //     const newUseCommonForField = {
  //       ...currentUseCommonForField,
  //       [field]: useCommon
  //     }
      
  //     // 모든 필드가 공통 사용인지 확인
  //     const allFieldsUseCommon = Object.values(newUseCommonForField).every(value => value === true)
      
  //     return {
  //       ...prev,
  //       useCommonForField: {
  //         ...prev.useCommonForField,
  //         [currentLang]: newUseCommonForField
  //       },
  //       // 모든 필드가 공통 사용이면 전체 공통 사용으로 설정
  //       useCommonDetails: allFieldsUseCommon
  //     }
  //   })
  // }


  // 번역 함수
  const translateCurrentLanguageDetails = async () => {
    const currentLang = formData.currentLanguage || 'ko'
    
    // 한국어가 아닌 경우 번역하지 않음
    if (currentLang !== 'ko') {
      setTranslationError(t('msgKoreanOnlyTranslate'))
      return
    }

    setTranslating(true)
    setTranslationError(null)

    try {
      const currentDetails = getCurrentLanguageDetails()
      
      // 번역할 필드들 수집
      const fieldsToTranslate: ProductDetailsTranslationFields = {
        slogan1: currentDetails.slogan1,
        slogan2: currentDetails.slogan2,
        slogan3: currentDetails.slogan3,
        greeting: currentDetails.greeting,
        description: currentDetails.description,
        included: currentDetails.included,
        not_included: currentDetails.not_included,
        pickup_drop_info: currentDetails.pickup_drop_info,
        luggage_info: currentDetails.luggage_info,
        tour_operation_info: currentDetails.tour_operation_info,
        preparation_info: currentDetails.preparation_info,
        small_group_info: currentDetails.small_group_info,
        companion_recruitment_info: currentDetails.companion_recruitment_info,
        notice_info: currentDetails.notice_info,
        important_notes: currentDetails.important_notes,
        private_tour_info: currentDetails.private_tour_info,
        cancellation_policy: currentDetails.cancellation_policy,
        chat_announcement: currentDetails.chat_announcement
      }

      // 번역 실행
      const result = await translateProductDetailsFields(fieldsToTranslate)

      if (result.success && result.translatedFields) {
        // 영어 언어가 없으면 생성
        if (!formData.productDetails.en) {
          setFormData(prev => ({
            ...prev,
            productDetails: {
              ...prev.productDetails,
              en: {
                slogan1: '',
                slogan2: '',
                slogan3: '',
                greeting: '',
                description: '',
                included: '',
                not_included: '',
                pickup_drop_info: '',
                luggage_info: '',
                tour_operation_info: '',
                preparation_info: '',
                small_group_info: '',
                companion_recruitment_info: '',
                notice_info: '',
                important_notes: '',
                private_tour_info: '',
                cancellation_policy: '',
                chat_announcement: '',
                tags: []
              }
            }
          }))
        }

        // 번역된 내용을 영어 필드에 적용
        setFormData(prev => {
          if (!result.translatedFields) return prev
          return {
            ...prev,
            productDetails: {
              ...prev.productDetails,
              en: {
                ...prev.productDetails.en,
                ...result.translatedFields
              }
            }
          }
        })

        setSaveMessage(t('msgTranslateSuccess'))
        setSaveMessageType('success')
        setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
      } else {
        setTranslationError(result.error || t('msgTranslateFailed'))
      }
    } catch (error) {
      console.error('번역 오류:', error)
      setTranslationError(`${t('msgTranslateError')}: ${error instanceof Error ? error.message : ''}`)
    } finally {
      setTranslating(false)
    }
  }

  // ChatGPT 추천 함수
  const suggestDescription = async () => {
    setSuggesting(true)
    setSuggestionError(null)

    try {
      const productTitle = `투어 상품 (ID: ${productId})`
      const suggestedDescription = await suggestTourDescription(productTitle)
      
      // 현재 언어에 따라 적절한 필드에 적용
      const currentLang = formData.currentLanguage || 'ko'
      if (currentLang === 'ko') {
        setFormData(prev => ({
          ...prev,
          productDetails: {
            ...prev.productDetails,
            ko: {
              ...prev.productDetails.ko,
              description: suggestedDescription
            }
          }
        }))
      } else {
        setFormData(prev => ({
          ...prev,
          productDetails: {
            ...prev.productDetails,
            [currentLang]: {
              ...prev.productDetails[currentLang as keyof typeof prev.productDetails],
              description: suggestedDescription
            }
          }
        }))
      }

      setSaveMessage(t('msgSuggestSuccess'))
      setSaveMessageType('success')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
    } catch (error) {
      console.error('ChatGPT 추천 오류:', error)
      setSuggestionError(error instanceof Error ? error.message : t('msgTranslateError'))
    } finally {
      setSuggesting(false)
    }
  }

  const handleSave = async (e?: React.MouseEvent) => {
    // 이벤트 전파 방지
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (isNewProduct) {
      setSaveMessage(t('msgNewProductUseFullSave'))
      setSaveMessageType('error')
      return
    }

    // AuthContext를 통한 인증 확인
    if (authLoading) {
      setSaveMessage(t('msgAuthChecking'))
      setSaveMessageType(null)
      return
    }

    if (!user) {
      setSaveMessage(t('msgLoginRequired'))
      setSaveMessageType('error')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 5000)
      return
    }

    setSaving(true)
    setSaveMessage('')

    try {
      // 메인 페이지와 동일한 방식으로 저장
      console.log('product_details 저장 시작')
      console.log('AuthContext 사용자:', { email: user.email, id: user.id })
      
      // 각 언어별로 저장
      const currentLang = formData.currentLanguage || 'ko'
      const currentDetails = getCurrentLanguageDetails()
      
      const { data: existingDetails, error: selectDetailsError } = await supabase
        .from('product_details_multilingual')
        .select('id')
        .eq('product_id', productId)
        .eq('language_code', currentLang)
        .is('channel_id', null) // channel_id가 NULL인 경우만 조회
        .eq('variant_key', 'default') // variant_key가 'default'인 경우만 조회
        .maybeSingle() as { data: { id: string } | null, error: unknown }

      if (selectDetailsError) {
        console.error('product_details 존재 여부 확인 오류:', selectDetailsError)
        throw new Error(`상품 세부정보 조회 실패: ${String(selectDetailsError)}`)
      }

      // 빈 문자열을 null로 변환하는 헬퍼 함수
      // HTML 태그만 있는 빈 문자열도 처리
      const toNullIfEmpty = (value: string | null | undefined): string | null => {
        if (value === null || value === undefined) return null
        if (typeof value !== 'string') return null
        
        // HTML 태그 제거 후 trim
        const textContent = value.replace(/<[^>]*>/g, '').trim()
        if (textContent === '') return null
        
        return value
      }
      
      const detailsData = {
        product_id: productId,
        channel_id: null, // 채널 선택 없이 저장할 때는 NULL로 설정
        language_code: currentLang,
        variant_key: 'default', // 채널 선택 없이 저장할 때는 default variant 사용
        slogan1: toNullIfEmpty(currentDetails.slogan1),
        slogan2: toNullIfEmpty(currentDetails.slogan2),
        slogan3: toNullIfEmpty(currentDetails.slogan3),
        greeting: toNullIfEmpty(currentDetails.greeting),
        description: toNullIfEmpty(currentDetails.description),
        included: toNullIfEmpty(currentDetails.included),
        not_included: toNullIfEmpty(currentDetails.not_included),
        pickup_drop_info: toNullIfEmpty(currentDetails.pickup_drop_info),
        luggage_info: toNullIfEmpty(currentDetails.luggage_info),
        tour_operation_info: toNullIfEmpty(currentDetails.tour_operation_info),
        preparation_info: toNullIfEmpty(currentDetails.preparation_info),
        small_group_info: toNullIfEmpty(currentDetails.small_group_info),
        companion_recruitment_info: toNullIfEmpty(currentDetails.companion_recruitment_info),
        notice_info: toNullIfEmpty(currentDetails.notice_info),
        important_notes: toNullIfEmpty(currentDetails.important_notes),
        private_tour_info: toNullIfEmpty(currentDetails.private_tour_info),
        cancellation_policy: toNullIfEmpty(currentDetails.cancellation_policy),
        chat_announcement: toNullIfEmpty(currentDetails.chat_announcement),
        tags: currentDetails.tags ?? null,
        section_titles: getCurrentSectionTitles(),
        customer_page_visibility: getCustomerPageVisibilityForSave(),
      }
      
      console.log('저장할 상세 정보:', {
        private_tour_info: detailsData.private_tour_info,
        private_tour_info_type: typeof detailsData.private_tour_info,
        private_tour_info_length: detailsData.private_tour_info?.length,
        original_private_tour_info: currentDetails.private_tour_info,
        original_type: typeof currentDetails.private_tour_info,
        original_length: currentDetails.private_tour_info?.length,
        formData_productDetails: formData.productDetails?.[currentLang]?.private_tour_info,
        formData_type: typeof formData.productDetails?.[currentLang]?.private_tour_info,
        formData_length: formData.productDetails?.[currentLang]?.private_tour_info?.length,
        allFields: detailsData
      })

      if (existingDetails) {
        // 업데이트
        const { error: detailsError } = await supabase
          .from('product_details_multilingual')
          .update({
            ...detailsData,
            updated_at: new Date().toISOString()
          })
          .eq('product_id', productId)
          .eq('language_code', currentLang)
          .is('channel_id', null) // channel_id가 NULL인 경우만 업데이트
          .eq('variant_key', 'default') // variant_key가 'default'인 경우만 업데이트

        if (detailsError) {
          console.error('product_details 업데이트 오류:', detailsError)
          throw new Error(`상품 세부정보 업데이트 실패: ${detailsError.message}`)
        }
        console.log('product_details 업데이트 완료')
        
        // 업데이트 후 실제 저장된 값 확인
        const { data: savedData, error: verifyError } = await supabase
          .from('product_details_multilingual')
          .select('private_tour_info, chat_announcement')
          .eq('product_id', productId)
          .eq('language_code', currentLang)
          .is('channel_id', null)
          .eq('variant_key', 'default')
          .maybeSingle() as { data: { private_tour_info: string | null; chat_announcement: string | null } | null; error: unknown }
        
        if (!verifyError && savedData) {
          console.log('일반 세부정보 저장 후 확인:', {
            private_tour_info: savedData.private_tour_info,
            private_tour_info_length: savedData.private_tour_info?.length,
            chat_announcement: savedData.chat_announcement,
            chat_announcement_length: savedData.chat_announcement?.length
          })
        }
      } else {
        // 새로 생성
        const { error: detailsError } = await supabase
          .from('product_details_multilingual')
          .insert([detailsData])

        if (detailsError) {
          console.error('product_details 생성 오류:', detailsError)
          throw new Error(`상품 세부정보 생성 실패: ${detailsError.message}`)
        }
        console.log('product_details 생성 완료')
        
        // 저장 후 실제 저장된 값 확인
        const { data: savedData, error: verifyError } = await supabase
          .from('product_details_multilingual')
          .select('private_tour_info, chat_announcement')
          .eq('product_id', productId)
          .eq('language_code', currentLang)
          .is('channel_id', null)
          .eq('variant_key', 'default')
          .maybeSingle() as { data: { private_tour_info: string | null; chat_announcement: string | null } | null; error: unknown }
        
        if (!verifyError && savedData) {
          console.log('일반 세부정보 저장 후 확인 (신규 생성):', {
            private_tour_info: savedData.private_tour_info,
            private_tour_info_length: savedData.private_tour_info?.length,
            chat_announcement: savedData.chat_announcement,
            chat_announcement_length: savedData.chat_announcement?.length
          })
        }
      }

      setSaveMessage(t('msgDetailsSaveSuccess'))
      setSaveMessageType('success')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
    } catch (error: unknown) {
      const e = error as { message?: string; status?: string | number; code?: string }
      const errorMessage = e?.message || ''
      const status = e?.status ?? e?.code ?? 'unknown'
      console.error('상품 세부정보 저장 오류:', { status, error: e })
      setSaveMessage(`${t('msgDetailsSaveError')} [${String(status)}] ${errorMessage}`)
      setSaveMessageType('error')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 5000)
    } finally {
      setSaving(false)
    }
  }

  /** 미리보기 편집·Import 모달 등에서 DB 저장 (채널 선택 시 채널·variant 행, 없으면 공통 행) */
  const saveDetailsFromModal = async () => {
    if (isNewProduct) {
      setSaveMessage(t('msgNewProductUseFullSave'))
      setSaveMessageType('error')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 5000)
      return
    }
    if (authLoading) {
      setSaveMessage(t('msgAuthChecking'))
      setSaveMessageType(null)
      return
    }
    if (!user) {
      setSaveMessage(t('msgLoginRequired'))
      setSaveMessageType('error')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 5000)
      return
    }
    if (selectedPairCount > 0) {
      await saveSelectedChannelsDetails()
    } else {
      await handleSave()
    }
  }

  // 채널 간 전체 복사는 현재 미사용
  void _copyChannelData

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-700" />
            <h3 className="text-base font-semibold text-gray-900">고객 노출 내용 편집기</h3>
            <span className="text-xs text-gray-500">채널 / Variant 기준</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
              {availableLanguages.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleLanguageChange(lang)}
                  className={`px-2 py-1 text-xs rounded ${
                    (formData.currentLanguage || 'ko') === lang
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {lang === 'ko' ? 'KO' : lang.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={translateCurrentLanguageDetails}
              disabled={translating || (formData.currentLanguage || 'ko') !== 'ko'}
              className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {translating ? '번역 중...' : 'KO→다국어 번역'}
            </button>
            <button
              type="button"
              onClick={suggestDescription}
              disabled={suggesting}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {suggesting ? '생성 중...' : 'AI 설명 추천'}
            </button>
            <button
              onClick={() => loadSelectedChannelData()}
              disabled={loadingChannelData}
              className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
            >
              {loadingChannelData ? '새로고침 중...' : '새로고침'}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-600">
          예약 확인·출발 확정 이메일은 &quot;저장&quot;된 동일 채널·variant 행을
          사용합니다. 예약 관리 이메일 미리보기에서 수정한 내용도 이곳과 같은 DB
          필드에 반영됩니다.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-3 border border-gray-200 rounded-lg p-3 space-y-4 max-h-[78vh] overflow-y-auto">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-sm font-semibold text-gray-900">채널 선택</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{selectedPairCount}개 쌍 선택</span>
                  <button
                    type="button"
                    onClick={openChannelGroupEditor}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    title="그룹 구성은 DB에 저장되어 모든 사용자에게 동일하게 보입니다"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    채널 그룹 설정
                  </button>
                </div>
              </div>
              {groupLayout.mode === 'custom' && (
                <p className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-2 py-1">
                  사용자 정의 그룹 적용 중 · DB(shared_settings)에 저장된 값이 모든 사용자에게 동일하게 표시됩니다
                </p>
              )}
              <div className="flex gap-1">
                <button onClick={() => setCompletionFilter('all')} className={`px-2 py-1 text-xs rounded ${completionFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{t('filterAll')}</button>
                <button onClick={() => setCompletionFilter('incomplete')} className={`px-2 py-1 text-xs rounded ${completionFilter === 'incomplete' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{t('filterIncomplete')}</button>
                <button onClick={() => setCompletionFilter('empty')} className={`px-2 py-1 text-xs rounded ${completionFilter === 'empty' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{t('filterEmpty')}</button>
              </div>
            </div>

            <div className="space-y-2">
              {channelGroups.map((group) => {
                const allSelected = group.channels.every((channel) => {
                  const variantsInGroup = variantsForChannelInGroup(group, channel.id, productVariantsByChannel)
                  const sel = selectedChannelVariants[channel.id] || []
                  return (
                    variantsInGroup.length > 0 &&
                    variantsInGroup.every((v) => sel.includes(v.variant_key))
                  )
                })
                const someSelected =
                  group.channels.some((channel) => {
                    const variantsInGroup = variantsForChannelInGroup(group, channel.id, productVariantsByChannel)
                    const sel = selectedChannelVariants[channel.id] || []
                    return variantsInGroup.some((v) => sel.includes(v.variant_key))
                  }) && !allSelected
                const pairCnt = groupVariantPairCount(group, productVariantsByChannel)
                return (
                  <div key={group.id} className="border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between p-2 bg-gray-50">
                      <button
                        type="button"
                        className="flex items-center gap-1 text-sm font-medium text-gray-800"
                        onClick={() => toggleGroupExpansion(group.id)}
                      >
                        {expandedGroups[group.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span>{group.displayLabel}</span>
                        <span className="text-xs text-gray-500">({pairCnt})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleGroupSelection(group.id)}
                        className="p-1 rounded hover:bg-gray-200"
                      >
                        {allSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : someSelected ? <div className="h-4 w-4 rounded border-2 border-blue-600 bg-blue-100" /> : <Square className="h-4 w-4 text-gray-400" />}
                      </button>
                    </div>
                    {expandedGroups[group.id] && (
                      <div className="p-2 space-y-2">
                        {group.channels.map((channel) => {
                          const completion = channelCompletionStats[channel.id]
                          const percent = completion?.percentage ?? 0
                          if (completionFilter === 'empty' && percent > 0) return null
                          if (completionFilter === 'incomplete' && percent === 100) return null
                          const sel = selectedChannelVariants[channel.id] || []
                          const hasAny = sel.length > 0
                          const variants = variantsForChannelInGroup(group, channel.id, productVariantsByChannel)
                          if (variants.length === 0) return null
                          return (
                            <div
                              key={channel.id}
                              className={`rounded border p-2 ${hasAny ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-sm font-medium text-gray-800">{channel.name}</span>
                                {completion && (
                                  <span className="ml-auto text-[11px] text-gray-500">
                                    {completion.completed}/{completion.total}
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1.5 pl-0.5">
                                {variants.map((variant) => {
                                  const checked = sel.includes(variant.variant_key)
                                  return (
                                    <label
                                      key={`${channel.id}-${variant.variant_key}`}
                                      className="flex items-center gap-2 cursor-pointer text-xs text-gray-700"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleChannelVariant(channel.id, variant.variant_key)}
                                        className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded"
                                      />
                                      <span>
                                        {variant.variant_name_ko || variant.variant_name_en || variant.variant_key}
                                        <span className="text-gray-400 ml-1">({variant.variant_key})</span>
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="xl:col-span-9 border border-gray-200 rounded-lg p-4 space-y-4 max-h-[78vh] overflow-y-auto">
            {selectedPairCount === 0 ? (
              <div className="h-full min-h-[320px] flex items-center justify-center text-gray-500 text-sm">
                왼쪽에서 채널·variant 쌍을 선택하면 고객에게 보여질 내용을 바로 편집할 수 있습니다.
              </div>
            ) : (
              <>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-700 mb-2">현재 편집 대상 (선택된 채널·variant — 내용은 병합 표시)</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedPairsForDisplay.map(({ channelId, variantKey }) => {
                      const channel = channels.find((c) => c.id === channelId)
                      const variantName = (productVariantsByChannel[channelId] || []).find(
                        (v) => v.variant_key === variantKey
                      )
                      return (
                        <span
                          key={`${channelId}-${variantKey}`}
                          className="inline-flex items-center rounded-full bg-slate-200 text-slate-800 px-2.5 py-1 text-xs"
                        >
                          {channel?.name || channelId} · {variantName?.variant_name_ko || variantName?.variant_name_en || variantKey}
                        </span>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">고객에게 보이는 미리보기</h4>
                  <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-indigo-900">핵심 안내 편집</p>
                    </div>
                    <p className="mt-1 text-[11px] text-indigo-700">
                      아래 카드(섹션)를 클릭해 고객 노출 내용을 바로 수정하세요.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-sm">
                    {[
                      { key: 'slogan1' as keyof ProductDetailsFields },
                      { key: 'greeting' as keyof ProductDetailsFields },
                      { key: 'description' as keyof ProductDetailsFields },
                      { key: 'included' as keyof ProductDetailsFields },
                      { key: 'not_included' as keyof ProductDetailsFields },
                      { key: 'companion_recruitment_info' as keyof ProductDetailsFields },
                      { key: 'notice_info' as keyof ProductDetailsFields },
                      { key: 'important_notes' as keyof ProductDetailsFields },
                      { key: 'pickup_drop_info' as keyof ProductDetailsFields },
                      { key: 'preparation_info' as keyof ProductDetailsFields },
                      { key: 'cancellation_policy' as keyof ProductDetailsFields }
                    ].map((section) => {
                      const raw = String(getValue(section.key, true) || '')
                      const plain = decodeHtmlEntities(raw.replace(/<[^>]*>/g, '')).trim()
                      return (
                        <button
                          key={section.key}
                          type="button"
                          onClick={() => {
                            setPreviewEditingField(section.key)
                            setPreviewEditModalOpen(true)
                          }}
                          className="text-left border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <span className="font-semibold text-gray-900">{getSectionTitle(section.key)}</span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              {!isCustomerPageFieldVisible(section.key) && (
                                <span className="text-[10px] font-medium text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                                  고객 페이지 미노출
                                </span>
                              )}
                              <span className="text-[11px] text-blue-600">클릭해서 수정</span>
                            </span>
                          </div>
                          <div className="text-gray-700 whitespace-pre-wrap text-xs leading-5 max-h-24 overflow-hidden">
                            {plain || '내용 없음'}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-200">
                  <button
                    onClick={saveSelectedChannelsDetails}
                    disabled={saving || selectedPairCount === 0}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? t('saveLoading') : t('saveSelectedChannels')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 번역 오류 메시지 */}
      {translationError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{translationError}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                type="button"
                onClick={() => setTranslationError(null)}
                className="inline-flex text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ChatGPT 추천 오류 메시지 */}
      {suggestionError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{suggestionError}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                type="button"
                onClick={() => setSuggestionError(null)}
                className="inline-flex text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 저장 버튼 및 메시지 - 채널별 세부정보 관리 섹션이 없을 때만 표시 */}
      {selectedPairCount === 0 && (
        <div className="flex justify-between items-center">
          <div></div>
          <div className="flex items-center space-x-4">
            {saveMessage && (
              <div className={`flex items-center text-sm ${
                saveMessageType === 'success' ? 'text-green-600' : 'text-red-600'
              }`}>
                <AlertCircle className="h-4 w-4 mr-1" />
                {saveMessage}
              </div>
            )}
            <button
              type="button"
              onClick={(e) => handleSave(e)}
              disabled={saving || isNewProduct}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? t('saveLoading') : t('save')}
            </button>
          </div>
        </div>
      )}
      
      {/* 채널 선택 시 메시지만 표시하는 영역 */}
      {selectedPairCount > 0 && (
        <div className="flex justify-between items-center">
          <div></div>
          <div className="flex items-center space-x-4">
            {saveMessage && (
              <div className={`flex items-center text-sm ${
                saveMessageType === 'success' ? 'text-green-600' : 'text-red-600'
              }`}>
                <AlertCircle className="h-4 w-4 mr-1" />
                {saveMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {previewEditModalOpen && previewEditingField && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                {getSectionTitle(previewEditingField)}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setPreviewEditModalOpen(false)
                  setPreviewEditingField(null)
                }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => previewEditingField && openCopyModal(previewEditingField)}
                className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Duplicate to channels
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportSourceLanguage(formData.currentLanguage || 'ko')
                  setImportFieldModalOpen(true)
                }}
                className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Import from another channel
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1">섹션 제목</label>
                <input
                  type="text"
                  value={getCurrentSectionTitles()[previewEditingField] ?? ''}
                  onChange={(e) => {
                    const currentLang = formData.currentLanguage || 'ko'
                    setSectionTitleOverridesByLanguage(prev => ({
                      ...prev,
                      [currentLang]: {
                        ...(prev[currentLang] || {}),
                        [previewEditingField]: e.target.value
                      }
                    }))
                  }}
                  placeholder={defaultSectionTitles[previewEditingField]}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  비워두면 기본 제목을 사용합니다.
                </p>
              </div>
              <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-gray-200 bg-slate-50 px-3 py-2.5 mb-4">
                <input
                  type="checkbox"
                  checked={isCustomerPageFieldVisible(previewEditingField)}
                  onChange={(e) => {
                    const currentLang = formData.currentLanguage || 'ko'
                    setCustomerPageVisibilityByLanguage((prev) => {
                      const cur = { ...(prev[currentLang] || {}) }
                      if (e.target.checked) delete cur[previewEditingField]
                      else cur[previewEditingField] = false
                      return { ...prev, [currentLang]: cur }
                    })
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-800 leading-snug">
                  <span className="font-medium">고객 상품 페이지에 표시</span>
                  <span className="block text-[11px] text-gray-500 mt-0.5 font-normal">
                    끄면 공개 상품 페이지에서 이 섹션만 숨깁니다.
                  </span>
                </span>
              </label>
              <LightRichEditor
                value={String(getValue(previewEditingField, true) || '')}
                onChange={(value) => handleInputChange(previewEditingField, value || '')}
                height={300}
                placeholder="고객에게 보여질 내용을 입력하세요"
                enableResize={true}
              />
            </div>
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPreviewEditModalOpen(false)
                  setPreviewEditingField(null)
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => void saveDetailsFromModal()}
                disabled={saving || isNewProduct}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? t('saveLoading') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {importFieldModalOpen && previewEditingField && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold text-gray-900">섹션 가져오기 (Import)</h3>
              <button
                type="button"
                onClick={() => setImportFieldModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto flex-1">
              <p className="text-xs text-gray-600">
                소스 채널·언어에 저장된 동일 섹션을 불러와,{' '}
                <span className="font-medium text-gray-800">현재 편집 언어({langLabel(formData.currentLanguage || 'ko')})</span>
                로 붙여넣습니다. 다른 언어에서 가져오면 번역 없이 그대로 복사됩니다.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">소스 언어 (가져올 DB 데이터)</label>
                <select
                  value={importSourceLanguage}
                  onChange={(e) => setImportSourceLanguage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  {availableLanguages.map((lang) => (
                    <option key={lang} value={lang}>
                      {langLabel(lang)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-700">소스 채널</label>
                  {importStatsLoading && (
                    <span className="text-[11px] text-gray-400">불러오는 중…</span>
                  )}
                </div>
                <div className="border border-gray-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-gray-100">
                  {channels.map((channel) => {
                    const st = importChannelStats[channel.id]
                    const pv = getPrimaryVariantForChannel(channel.id)
                    const variantLabel =
                      (productVariantsByChannel[channel.id] || []).find((v) => v.variant_key === pv)
                        ?.variant_name_ko ||
                      (productVariantsByChannel[channel.id] || []).find((v) => v.variant_key === pv)
                        ?.variant_name_en ||
                      pv
                    const badge =
                      st === undefined ? (
                        <span className="text-[11px] text-gray-400">확인 중…</span>
                      ) : st.hasContent ? (
                        <span className="text-[11px] text-emerald-700 tabular-nums">
                          내용 있음 · 순문자 약 {st.plainLen.toLocaleString()}자
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-700">내용 없음</span>
                      )
                    return (
                      <label
                        key={channel.id}
                        className={`flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 ${
                          importSourceChannelId === channel.id ? 'bg-emerald-50' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="importSourceChannel"
                          checked={importSourceChannelId === channel.id}
                          onChange={() => setImportSourceChannelId(channel.id)}
                          className="mt-0.5 h-4 w-4 text-emerald-600 border-gray-300"
                        />
                        <span className="flex-1 min-w-0 text-sm text-gray-800">
                          <span className="font-medium">{channel.name}</span>
                          <span className="text-gray-500 text-xs"> · {variantLabel}</span>
                          <span className="block text-[11px] text-gray-600 mt-0.5">{badge}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setImportFieldModalOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void saveDetailsFromModal()}
                disabled={saving || isNewProduct}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {saving ? t('saveLoading') : t('save')}
              </button>
              <button
                type="button"
                onClick={importSectionFromChannel}
                disabled={
                  importingField ||
                  importStatsLoading ||
                  !importSourceChannelId ||
                  !importChannelStats[importSourceChannelId]?.hasContent
                }
                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 text-sm"
              >
                {importingField ? '가져오는 중...' : '가져오기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {channelGroupEditorOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[55] p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <h3 className="text-base font-semibold text-gray-900">채널 그룹 설정</h3>
              <button
                type="button"
                onClick={() => setChannelGroupEditorOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                그룹 이름과 어떤 채널을 묶을지 정한 뒤 저장하면, 고객 노출 편집기 왼쪽 목록·복사 모달에{' '}
                <span className="font-medium text-gray-800">모든 사용자에게 동일하게</span> 반영됩니다. 값은 DB의{' '}
                <code className="text-[11px] bg-gray-100 px-1 rounded">shared_settings</code> 테이블(
                <code className="text-[11px] bg-gray-100 px-1 rounded">product_details_channel_group_layout</code>)에
                저장됩니다. 저장은 <span className="font-medium text-gray-800">관리자(super/admin)</span>만 가능합니다.
              </p>
              <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50 gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setGroupLayoutDraft((d) => ({
                      ...d,
                      mode: 'by_type',
                    }))
                  }
                  className={`flex-1 py-2 px-2 text-xs font-medium rounded-md transition-colors ${
                    groupLayoutDraft.mode === 'by_type'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  채널 타입별 (기본)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const selfLabel = t('selfGroupLabel')
                    setGroupLayoutDraft((d) => ({
                      ...d,
                      mode: 'custom',
                      customGroups:
                        d.customGroups.length > 0
                          ? d.customGroups.map((g) => cloneCustomGroupEntry(g))
                          : channels.length > 0
                            ? seedCustomGroupsFromByType(channels, selfLabel)
                            : [],
                    }))
                  }}
                  className={`flex-1 py-2 px-2 text-xs font-medium rounded-md transition-colors ${
                    groupLayoutDraft.mode === 'custom'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  사용자 정의 그룹
                </button>
              </div>

              {groupLayoutDraft.mode === 'custom' && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const selfLabel = t('selfGroupLabel')
                        setGroupLayoutDraft((d) => ({
                          ...d,
                          mode: 'custom',
                          customGroups: seedCustomGroupsFromByType(channels, selfLabel),
                        }))
                      }}
                      className="px-3 py-1.5 text-xs rounded-md border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                    >
                      DB 타입 기준으로 다시 채우기
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-gray-700">그룹 목록</p>
                      <button
                        type="button"
                        onClick={addAnotherCustomGroup}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        그룹 추가
                      </button>
                    </div>
                    {groupLayoutDraft.customGroups.map((g, idx) => (
                      <div key={g.id} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50/80">
                        <span className="text-[11px] text-gray-400 w-5 shrink-0">{idx + 1}</span>
                        <input
                          type="text"
                          value={g.label}
                          onChange={(e) => {
                            const v = e.target.value
                            setGroupLayoutDraft((d) => ({
                              ...d,
                              customGroups: d.customGroups.map((cg) =>
                                cg.id === g.id ? { ...cg, label: v } : cg
                              ),
                            }))
                          }}
                          className="flex-1 min-w-0 text-sm border border-gray-300 rounded px-2 py-1"
                          placeholder="그룹 이름"
                        />
                        <button
                          type="button"
                          disabled={groupLayoutDraft.customGroups.length <= 1}
                          onClick={() =>
                            setGroupLayoutDraft((d) => {
                              if (d.customGroups.length <= 1) return d
                              return {
                                ...d,
                                customGroups: d.customGroups.filter((cg) => cg.id !== g.id),
                              }
                            })
                          }
                          className="shrink-0 text-xs text-red-600 hover:text-red-800 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addAnotherCustomGroup}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-blue-700 border border-dashed border-blue-200 rounded-lg bg-blue-50/50 hover:bg-blue-50"
                    >
                      <Plus className="h-4 w-4" />
                      그룹 더 추가
                    </button>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-2">채널·variant별 소속 그룹</p>
                    <p className="text-[11px] text-gray-500 mb-2">
                      현재 상품에 연결된 variant 기준으로 행이 나뉩니다. 한 채널의 variant를 서로 다른 그룹에 둘 수 있습니다.
                    </p>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                        {channels.flatMap((ch) => {
                          const rows = productVariantsByChannel[ch.id]?.length
                            ? productVariantsByChannel[ch.id]!
                            : [{ variant_key: 'default' as const }]
                          return rows.map((variant) => (
                            <div
                              key={`${ch.id}-${variant.variant_key}`}
                              className="px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-white"
                            >
                              <div className="flex-1 min-w-0 text-sm">
                                <span className="font-medium text-gray-800">{ch.name}</span>
                                <span className="text-gray-400 text-xs ml-1">({ch.type})</span>
                                <span className="block text-xs text-gray-600 mt-0.5">
                                  {variant.variant_name_ko ||
                                    variant.variant_name_en ||
                                    variant.variant_key}
                                  <span className="text-gray-400 ml-1">({variant.variant_key})</span>
                                </span>
                              </div>

                              <select
                                className="text-xs border border-gray-300 rounded px-2 py-1.5 sm:w-44 w-full shrink-0"
                                value={findDraftGroupIdForPair(
                                  groupLayoutDraft,
                                  ch.id,
                                  variant.variant_key,
                                  channels,
                                  productVariantsByChannel
                                )}
                                onChange={(e) =>
                                  assignPairInDraft(
                                    ch.id,
                                    variant.variant_key,
                                    e.target.value as string | '__unassigned__'
                                  )
                                }
                              >
                                <option value="__unassigned__">미배정</option>
                                {groupLayoutDraft.customGroups.map((cg) => (
                                  <option key={cg.id} value={cg.id}>
                                    {cg.label.trim() || '이름 없음'}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))
                        })}
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1.5">
                      미배정 쌍은 편집기에서 &quot;미배정 채널&quot; 그룹으로 따로 표시됩니다.
                    </p>
                  </div>
                </>
              )}

              {groupLayoutDraft.mode === 'by_type' && (
                <div className="space-y-2 text-xs text-gray-500 border border-dashed border-gray-200 rounded-lg px-3 py-3">
                  <p>
                    지금은 DB의 채널 타입(OTA, partner, self 등)으로만 묶어서 보여 줍니다. 그룹을 더 나누거나
                    이름을 바꾸려면 아래에서 바로 그룹을 추가할 수 있습니다.
                  </p>
                  <button
                    type="button"
                    onClick={addAnotherCustomGroup}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    사용자 정의로 전환하고 그룹 추가
                  </button>
                  <p className="text-[11px] text-gray-400">
                    (기존 타입별 구성을 먼저 불러온 뒤, 빈 그룹이 하나 더 생깁니다. 목록만 원하면 위 탭에서
                    &quot;사용자 정의 그룹&quot;을 눌러도 됩니다.)
                  </p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setChannelGroupEditorOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
              <button
                type="button"
                disabled={savingChannelGroupLayout}
                onClick={() => {
                  void (async () => {
                    if (groupLayoutDraft.mode === 'custom') {
                      if (groupLayoutDraft.customGroups.length === 0) {
                        setSaveMessage('사용자 정의 모드에서는 그룹이 최소 1개 필요합니다.')
                        setSaveMessageType('error')
                        setTimeout(() => {
                          setSaveMessage('')
                          setSaveMessageType(null)
                        }, 4000)
                        return
                      }
                    }
                    const ok = await persistGroupLayout({ ...groupLayoutDraft, version: 1 })
                    if (!ok) return
                    setChannelGroupEditorOpen(false)
                    setSaveMessage('채널 그룹 설정을 저장했습니다.')
                    setSaveMessageType('success')
                    setTimeout(() => {
                      setSaveMessage('')
                      setSaveMessageType(null)
                    }, 3000)
                  })()
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingChannelGroupLayout ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 복사 모달 */}
      {copyModalOpen && copyFieldName && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {getCopyFieldLabel(copyFieldName)} - {t('copyToChannels')}
              </h3>
              <button
                onClick={() => {
                  setCopyModalOpen(false)
                  setCopyTargetSelections({})
                  setCopyFieldName(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">
              {t('copyModalIntro')}
            </p>
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
              {t('copyModalLanguageHint')}
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('copyModalSourceLanguage')}</label>
              <select
                value={copySourceLanguage}
                onChange={(e) => setCopySourceLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {availableLanguages.map((lang) => (
                  <option key={lang} value={lang}>
                    {langLabel(lang)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
              {channelGroups.map((group) => (
                <div key={group.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="font-medium text-gray-900 mb-2">
                    {group.displayLabel}
                  </div>
                  <div className="space-y-2">
                    {group.channels.map((channel) => {
                      const isSelected = (selectedChannelVariants[channel.id]?.length ?? 0) > 0
                      if (isSelected) return null
                      const variantMap = copyTargetSelections[channel.id]
                      if (!variantMap || Object.keys(variantMap).length === 0) return null
                      const variants = variantsForChannelInGroup(group, channel.id, productVariantsByChannel)
                      if (variants.length === 0) return null
                      return (
                        <div
                          key={channel.id}
                          className="rounded border border-gray-100 bg-gray-50/50 p-2"
                        >
                          <div className="text-sm font-medium text-gray-800 mb-1.5">{channel.name}</div>
                          <div className="space-y-1 pl-0.5">
                            {variants.map((variant) => {
                              const checked = variantMap[variant.variant_key] ?? false
                              return (
                                <label
                                  key={`${channel.id}-${variant.variant_key}`}
                                  className="flex items-center gap-2 cursor-pointer hover:bg-white/80 p-1 rounded text-xs text-gray-700"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      setCopyTargetSelections((prev) => ({
                                        ...prev,
                                        [channel.id]: {
                                          ...(prev[channel.id] || {}),
                                          [variant.variant_key]: e.target.checked
                                        }
                                      }))
                                    }}
                                    className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <span>
                                    {variant.variant_name_ko || variant.variant_name_en || variant.variant_key}
                                    <span className="text-gray-400 ml-1">({variant.variant_key})</span>
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setCopyModalOpen(false)
                  setCopyTargetSelections({})
                  setCopyFieldName(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => {
                  const pairs: { channelId: string; variantKey: string }[] = []
                  for (const [channelId, variantMap] of Object.entries(copyTargetSelections)) {
                    for (const [variantKey, on] of Object.entries(variantMap)) {
                      if (on) pairs.push({ channelId, variantKey })
                    }
                  }
                  if (pairs.length === 0) {
                    setSaveMessage(t('msgSelectChannelsToCopy'))
                    setSaveMessageType('error')
                    setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
                    return
                  }
                  void copyFieldToChannels(copyFieldName, pairs)
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                {t('copyExecute')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
