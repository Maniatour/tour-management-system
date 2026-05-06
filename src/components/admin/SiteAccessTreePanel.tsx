'use client'

import Link from 'next/link'
import React, { useCallback, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { isAdminNavVisible, type AdminNavAccessContext } from '@/lib/admin-site-registry'
import {
  buildSiteAccessGroups,
  buildSiteAccessTree,
  computeCrudForNode,
  isAdminSidebarMenuColumnRelevant,
  personaCrudFromRoleCrud,
  resolveMenuVisibility,
  type CrudCell,
  type SiteAccessNode,
} from '@/lib/admin-site-access-tree'
import {
  mergePersonaCrudWithPatches,
  type SiteAccessCrudPatch,
  type SiteAccessPatchMap,
  upsertSiteAccessMatrixPatch,
} from '@/lib/site-access-matrix-overrides'
import {
  canEditSiteAccessMatrixClient,
  resolveSiteAccessPersona,
  SITE_ACCESS_PERSONAS,
  type SiteAccessPersona,
} from '@/lib/site-access-persona'
import { useSiteAccessMatrixPatchContext } from '@/contexts/SiteAccessMatrixPatchContext'
import { supabase } from '@/lib/supabase'

const CRUD_TABLE_COLSPAN = 4 + SITE_ACCESS_PERSONAS.length * 4

const CRUD_KEYS: (keyof CrudCell)[] = ['read', 'write', 'update', 'delete']

function triValue(patch: SiteAccessCrudPatch, k: keyof CrudCell): 'inherit' | 'grant' | 'deny' {
  if (patch[k] === undefined) return 'inherit'
  return patch[k] ? 'grant' : 'deny'
}

function mergedAdminLinkShown(
  node: SiteAccessNode,
  navCtx: AdminNavAccessContext,
  patchMap: SiteAccessPatchMap
): { sidebarColumn: boolean; treeHintHidden: boolean } {
  const vis = resolveMenuVisibility(node)
  const baseNav = vis ? isAdminNavVisible(vis, navCtx) : true
  if (node.kind === 'cluster' || !isAdminSidebarMenuColumnRelevant(node)) {
    return { sidebarColumn: true, treeHintHidden: false }
  }
  const persona = resolveSiteAccessPersona({
    userRole: navCtx.userRole,
    userPosition: navCtx.userPosition ?? null,
    isSuper: navCtx.isSuper,
    authUserEmail: navCtx.authUserEmail,
  })
  const baseCrud = personaCrudFromRoleCrud(node, computeCrudForNode(node))
  const merged = mergePersonaCrudWithPatches(baseCrud, node.id, patchMap)
  const readOk = !persona || merged[persona].read
  const effective = baseNav && readOk
  return { sidebarColumn: effective, treeHintHidden: !effective }
}

function kindBadgeClass(kind: SiteAccessNode['kind']): string {
  switch (kind) {
    case 'cluster':
      return 'bg-slate-100 text-slate-800 border-slate-200'
    case 'page':
      return 'bg-blue-50 text-blue-800 border-blue-200'
    case 'tab':
      return 'bg-violet-50 text-violet-800 border-violet-200'
    case 'modal':
      return 'bg-amber-50 text-amber-900 border-amber-200'
    case 'virtual':
      return 'bg-gray-100 text-gray-700 border-gray-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

function resolveNodeLabel(
  node: SiteAccessNode,
  t: ReturnType<typeof useTranslations<'siteDirectory'>>,
  tSidebar: (key: string) => string,
  tCommon: (key: string) => string
): string {
  const L = node.label
  if (L.type === 'sidebar') return tSidebar(L.key)
  if (L.type === 'common') return tCommon(L.key)
  return t(L.key as Parameters<typeof t>[0])
}

function formatHref(locale: string, node: SiteAccessNode): string | null {
  if (node.localePath !== undefined) {
    const lp = node.localePath
    if (lp.includes('[') || lp.includes('…')) return null
    const q = node.query ? `?${node.query}` : ''
    const base = lp === '' ? `/${locale}` : `/${locale}/${lp.replace(/^\//, '')}`
    return `${base}${q}`
  }
  if (!node.adminPath) return null
  if (node.adminPath.includes('[') || node.adminPath.includes('…')) return null
  const q = node.query ? `?${node.query}` : ''
  return `/${locale}/admin/${node.adminPath.replace(/^\//, '')}${q}`
}

function displayPath(locale: string, node: SiteAccessNode): string {
  if (node.localePath !== undefined) {
    const q = node.query ? `?${node.query}` : ''
    if (node.localePath === '') return `/${locale}${q}`
    return `/${locale}/${node.localePath.replace(/^\//, '')}${q}`
  }
  if (!node.adminPath) return '—'
  const q = node.query ? `?${node.query}` : ''
  return `/${locale}/admin/${node.adminPath.replace(/^\//, '')}${q}`
}

function CrudFourCells({ cell }: { cell: CrudCell }) {
  return (
    <>
      {CRUD_KEYS.map((k, i) => (
        <td
          key={k}
          className={`border-b border-gray-100 bg-white px-0.5 py-1.5 text-center text-[11px] tabular-nums text-gray-800 ${
            i === 0 ? 'border-l border-gray-200' : ''
          }`}
        >
          {cell[k] ? '✓' : '—'}
        </td>
      ))}
    </>
  )
}

function PersonaCrudEditCells({
  mergedCell,
  patch,
  saving,
  t,
  onTriChange,
}: {
  mergedCell: CrudCell
  patch: SiteAccessCrudPatch
  saving: boolean
  t: ReturnType<typeof useTranslations<'siteDirectory'>>
  onTriChange: (key: keyof CrudCell, tri: 'inherit' | 'grant' | 'deny') => void
}) {
  return (
    <>
      {CRUD_KEYS.map((k, i) => (
        <td
          key={k}
          className={`border-b border-gray-100 bg-white px-0.5 py-0.5 ${
            i === 0 ? 'border-l border-gray-200' : ''
          }`}
        >
          <select
            disabled={saving}
            className="w-full max-w-[3.25rem] rounded border border-amber-200 bg-amber-50/40 py-0.5 text-[10px] text-gray-900"
            value={triValue(patch, k)}
            title={mergedCell[k] ? '✓' : '—'}
            onChange={(e) => {
              const v = e.target.value as 'inherit' | 'grant' | 'deny'
              onTriChange(k, v)
            }}
          >
            <option value="inherit">{t('triInherit')}</option>
            <option value="grant">{t('triGrant')}</option>
            <option value="deny">{t('triDeny')}</option>
          </select>
        </td>
      ))}
    </>
  )
}

type SiteAccessTreePanelProps = {
  navCtx: AdminNavAccessContext
}

export default function SiteAccessTreePanel({ navCtx }: SiteAccessTreePanelProps) {
  const locale = useLocale()
  const t = useTranslations('siteDirectory')
  const tSidebar = useTranslations('sidebar')
  const tCommon = useTranslations('common')
  const tree = useMemo(() => buildSiteAccessTree(), [])
  const groups = useMemo(() => buildSiteAccessGroups(tree), [tree])
  const { patchMap, loading: patchesLoading, error: patchError, refetch } = useSiteAccessMatrixPatchContext()

  const [open, setOpen] = useState<Record<string, boolean>>(() => ({
    root: true,
    'cluster-header': true,
    'cluster-sidebar': true,
  }))
  const [editMode, setEditMode] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const canEdit = canEditSiteAccessMatrixClient({
    userRole: navCtx.userRole,
    userPosition: navCtx.userPosition ?? null,
    isSuper: navCtx.isSuper,
    authUserEmail: navCtx.authUserEmail,
  })

  const toggle = useCallback((id: string) => {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const persistTri = useCallback(
    async (nodeId: string, persona: SiteAccessPersona, key: keyof CrudCell, tri: 'inherit' | 'grant' | 'deny') => {
      const sk = `${nodeId}::${persona}::${key}`
      setSavingKey(sk)
      try {
        const existing = patchMap.get(nodeId)?.get(persona) ?? {}
        const next: SiteAccessCrudPatch = { ...existing }
        if (tri === 'inherit') delete next[key]
        else next[key] = tri === 'grant'
        const { error } = await upsertSiteAccessMatrixPatch(supabase, nodeId, persona, next)
        if (!error) await refetch()
      } finally {
        setSavingKey(null)
      }
    },
    [patchMap, refetch]
  )

  const renderNode = (node: SiteAccessNode, depth: number) => {
    const hasChildren = Boolean(node.children?.length)
    const expanded = open[node.id] ?? depth < 1
    const label = resolveNodeLabel(node, t, tSidebar, tCommon)
    const { treeHintHidden } = mergedAdminLinkShown(node, navCtx, patchMap)
    const href = formatHref(locale, node)

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-start gap-1 py-1.5 pr-2 text-sm ${
            depth > 0 ? 'border-l border-gray-100' : ''
          }`}
          style={{ paddingLeft: Math.max(0, 4 + depth * 18) }}
        >
          {hasChildren ? (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => toggle(node.id)}
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="inline-block w-6 shrink-0" />
          )}
          <span
            className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${kindBadgeClass(node.kind)}`}
          >
            {t(`kind_${node.kind}` as Parameters<typeof t>[0])}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-gray-900">{label}</span>
              {href && (
                <Link
                  href={href}
                  className="inline-flex items-center gap-0.5 font-mono text-xs text-blue-600 hover:underline"
                >
                  {href}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
            {treeHintHidden && node.kind !== 'cluster' && (
              <div className="mt-0.5 text-xs text-amber-700">({t('badgeHidden')})</div>
            )}
          </div>
        </div>
        {hasChildren && expanded && (
          <div>{node.children!.map((ch) => renderNode(ch, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 space-y-6 rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:p-4 md:p-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{t('fullCrudTableTitle')}</h2>
        <p className="mt-1 text-xs text-gray-600">{t('fullCrudTableIntro')}</p>
        <p className="mt-1 text-xs text-amber-800">{t('crudFinanceSuperNote')}</p>
        {patchError && (
          <p className="mt-2 text-xs text-red-700">
            {t('matrixLoadError')}: {patchError.message}
          </p>
        )}
        {canEdit && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                editMode ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {t('matrixEditMode')}
            </button>
            <p className="text-xs text-gray-600">{t('matrixEditHint')}</p>
            {patchesLoading && <span className="text-xs text-gray-500">{t('matrixLoading')}</span>}
          </div>
        )}
      </div>

      <div className="w-full min-w-0 overflow-x-auto rounded border border-gray-200 shadow-sm">
        <table className="w-full min-w-[1240px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th
                rowSpan={2}
                className="sticky left-0 z-20 border-r border-gray-200 bg-gray-50 px-2 py-2 font-medium text-gray-700"
              >
                {t('columnKind')}
              </th>
              <th rowSpan={2} className="min-w-[140px] border-r border-gray-200 px-2 py-2 font-medium text-gray-700">
                {t('columnItem')}
              </th>
              <th rowSpan={2} className="min-w-[200px] border-r border-gray-200 px-2 py-2 font-medium text-gray-700">
                {t('columnPath')}
              </th>
              <th
                rowSpan={2}
                className="border-r border-gray-200 px-2 py-2 text-center font-medium text-gray-700"
                title={t('columnInMyMenuHint')}
              >
                {t('columnInMyMenu')}
              </th>
              {SITE_ACCESS_PERSONAS.map((persona) => (
                <th
                  key={persona}
                  colSpan={4}
                  className="border-l border-gray-300 bg-gray-50 px-1 py-2 text-center text-[11px] font-semibold text-gray-800"
                >
                  {t(`persona_${persona}` as Parameters<typeof t>[0])}
                </th>
              ))}
            </tr>
            <tr className="border-b border-gray-200 bg-gray-100/80">
              {SITE_ACCESS_PERSONAS.flatMap((persona) => {
                const subKeys = ['crudRead', 'crudWrite', 'crudUpdate', 'crudDelete'] as const
                return subKeys.map((sk, idx) => (
                  <th
                    key={`${persona}-${sk}`}
                    className={`border-b border-gray-200 px-0.5 py-1 text-center text-[10px] font-normal text-gray-600 ${
                      idx === 0 ? 'border-l border-gray-300' : ''
                    }`}
                  >
                    {t(sk)}
                  </th>
                ))
              })}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group.cluster.id}>
                <tr className="border-y border-slate-200 bg-slate-100">
                  <td
                    colSpan={CRUD_TABLE_COLSPAN}
                    className="px-3 py-2.5 text-sm font-semibold tracking-tight text-slate-900"
                  >
                    {resolveNodeLabel(group.cluster, t, tSidebar, tCommon)}
                  </td>
                </tr>
                {group.rows.map(({ node, depth }) => {
                  const label = resolveNodeLabel(node, t, tSidebar, tCommon)
                  const { sidebarColumn: menuShown } = mergedAdminLinkShown(node, navCtx, patchMap)
                  const pathStr = displayPath(locale, node)
                  const href = formatHref(locale, node)
                  const baseline = personaCrudFromRoleCrud(node, computeCrudForNode(node))
                  const crud = mergePersonaCrudWithPatches(baseline, node.id, patchMap)
                  const indentPx = 8 + depth * 18
                  const rowEditable = editMode && canEdit && node.kind !== 'cluster'

                  return (
                    <tr key={node.id} className="hover:bg-blue-50/30">
                      <td
                        className="sticky left-0 z-10 border-r border-gray-100 bg-white py-1.5 pr-2"
                        style={{ paddingLeft: `${indentPx}px` }}
                      >
                        <span
                          className={`inline-block rounded border px-1 py-0.5 text-[10px] font-semibold ${kindBadgeClass(node.kind)}`}
                        >
                          {t(`kind_${node.kind}` as Parameters<typeof t>[0])}
                        </span>
                      </td>
                      <td
                        className="border-r border-gray-100 bg-white py-1.5 pr-2 font-medium text-gray-900"
                        style={{ paddingLeft: `${indentPx}px` }}
                      >
                        {label}
                      </td>
                      <td
                        className="min-w-[10rem] max-w-[min(48vw,36rem)] border-r border-gray-100 bg-white py-1.5 pr-2 font-mono text-[11px] text-gray-700 xl:max-w-none"
                        style={{ paddingLeft: `${indentPx}px` }}
                      >
                        {href ? (
                          <Link href={href} className="break-all text-blue-600 hover:underline">
                            {pathStr}
                          </Link>
                        ) : (
                          <span className="break-all text-gray-600">{pathStr}</span>
                        )}
                      </td>
                      <td
                        className="border-r border-gray-100 bg-white px-2 py-1.5 text-center text-gray-800"
                        title={
                          !isAdminSidebarMenuColumnRelevant(node)
                            ? t('naAdminSidebar')
                            : undefined
                        }
                      >
                        {node.kind === 'cluster'
                          ? '—'
                          : !isAdminSidebarMenuColumnRelevant(node)
                            ? '—'
                            : menuShown
                              ? '✓'
                              : '—'}
                      </td>
                      {SITE_ACCESS_PERSONAS.map((persona) => {
                        const patch = patchMap.get(node.id)?.get(persona) ?? {}
                        const saving = savingKey?.startsWith(`${node.id}::${persona}`) ?? false
                        return (
                          <React.Fragment key={persona}>
                            {rowEditable ? (
                              <PersonaCrudEditCells
                                mergedCell={crud[persona]}
                                patch={patch}
                                saving={saving}
                                t={t}
                                onTriChange={(key, tri) => {
                                  void persistTri(node.id, persona, key, tri)
                                }}
                              />
                            ) : (
                              <CrudFourCells cell={crud[persona]} />
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tr>
                  )
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">{t('footnoteRls')}</p>

      <div>
        <h2 className="mb-2 text-base font-semibold text-gray-900">{t('treeHierarchyTitle')}</h2>
        <p className="mb-2 text-xs text-gray-600">{t('treeIntro')}</p>
        <div className="max-h-[min(50vh,480px)] space-y-3 overflow-y-auto">
          {tree.children?.map((cluster) => (
            <div
              key={cluster.id}
              className="rounded-lg border border-slate-200 bg-slate-50/40 p-2 shadow-sm"
            >
              {renderNode(cluster, 0)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
