'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  Circle,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useOperator } from '@/contexts/OperatorContext'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import type { PilotCheckId, PilotCheckResult } from '@/lib/operators/pilotStatus'
import type {
  RegressionCheckId,
  RegressionCheckResult,
} from '@/lib/operators/kovegasRegression'
import type {
  OpsFinanceCheckId,
  OpsFinanceCheckResult,
} from '@/lib/operators/opsFinanceIsolation'
import type {
  CommerceIsolationCheckId,
  CommerceIsolationCheckResult,
} from '@/lib/operators/commerceIsolation'
import type {
  HostBookCheckId,
  HostBookCheckResult,
} from '@/lib/operators/hostBookReadiness'

type PageLink = {
  hrefKey: string
  titleKey: string
  bodyKey: string
  badgeKey?: string
}

const STRUCTURE_KEYS = ['tenancy', 'commerce', 'public', 'payments', 'ops'] as const
const SAFETY_KEYS = [
  'flagsOff',
  'kovegasUnchanged',
  'm00001',
  'opsOptional',
  'pilotOptIn',
] as const
const E2E_KEYS = [
  'switchB',
  'catalogPrice',
  'commerceIsolationSmoke',
  'hostBookReadiness',
  'hostBook',
  'connectOptIn',
  'opsFinanceSmoke',
  'opsFinanceUi',
  'switchBack',
  'regressionGreen',
] as const

const TODO_KEYS = [
  'createOperator',
  'connect',
  'subdomain',
  'catalog',
  'pricing',
  'checkoutFlag',
  'isolation',
  'opsOff',
  'opsRouteGuard',
] as const satisfies readonly PilotCheckId[]

const REGRESSION_KEYS = [
  'kovegasRow',
  'kovegasOpsOn',
  'm00001Channel',
  'directChannelM00001',
  'kovegasCatalog',
  'platformCheckoutDefault',
  'otaLiveDefaultOff',
  'otaInboundDefaultOff',
  'commerceV2ReadNotGlobal',
] as const satisfies readonly RegressionCheckId[]

const OPS_FINANCE_KEYS = [
  'stampVehicles',
  'stampCompanyExpenses',
  'stampCashFinancial',
  'stampStatement',
  'stampMatchTables',
  'stampPaymentRecords',
  'kovegasPaymentBaseline',
  'tenantPartitionPayments',
  'paymentRecordsSelectRls',
  'opsFinanceSelectRls',
  'companyExpensesSelectRls',
  'stampJournal',
  'journalSelectRls',
  'fleetSelectRls',
  'attendanceSelectRls',
  'tipMealSelectRls',
  'tourResExpensesSelectRls',
  'staffTenantLockPilot',
] as const satisfies readonly OpsFinanceCheckId[]

const COMMERCE_ISOLATION_KEYS = [
  'stampProducts',
  'stampChannels',
  'stampChannelProducts',
  'stampDynamicPricing',
  'stampReservations',
  'stampCustomers',
  'stampRatePlans',
  'stampOffers',
  'kovegasCatalogBaseline',
  'tenantPartitionProducts',
  'tenantPartitionChannels',
  'directChannelResolve',
  'v2OfferProductSameTenant',
  'connectCheckoutFlag',
  'stampInventoryCore',
  'stampInventoryHoldsLedger',
  'channelProductSameTenant',
  'inventoryBindingResourceSameTenant',
] as const satisfies readonly CommerceIsolationCheckId[]

const HOST_BOOK_KEYS = [
  'subdomainConfigured',
  'routingEnvReady',
  'hostResolveMatches',
  'catalogReadyForHost',
  'directChannelReady',
  'debugEndpointAvailable',
] as const satisfies readonly HostBookCheckId[]

const PAGE_LINKS: PageLink[] = [
  {
    hrefKey: 'manual',
    titleKey: 'pageManualTitle',
    bodyKey: 'pageManualBody',
    badgeKey: 'badgeHere',
  },
  {
    hrefKey: 'operators',
    titleKey: 'pageOperatorsTitle',
    bodyKey: 'pageOperatorsBody',
    badgeKey: 'badgeSuper',
  },
  {
    hrefKey: 'ota',
    titleKey: 'pageOtaTitle',
    bodyKey: 'pageOtaBody',
  },
  {
    hrefKey: 'products',
    titleKey: 'pageProductsTitle',
    bodyKey: 'pageProductsBody',
  },
  {
    hrefKey: 'channels',
    titleKey: 'pageChannelsTitle',
    bodyKey: 'pageChannelsBody',
  },
  {
    hrefKey: 'reservations',
    titleKey: 'pageReservationsTitle',
    bodyKey: 'pageReservationsBody',
  },
  {
    hrefKey: 'customers',
    titleKey: 'pageCustomersTitle',
    bodyKey: 'pageCustomersBody',
  },
]

function hrefFor(locale: string, key: string): string {
  const map: Record<string, string> = {
    manual: `/${locale}/admin/operator-b/manual`,
    operators: `/${locale}/admin/operators`,
    ota: `/${locale}/admin/commerce/ota-mappings`,
    products: `/${locale}/admin/products`,
    channels: `/${locale}/admin/channels`,
    reservations: `/${locale}/admin/reservations`,
    customers: `/${locale}/admin/customers`,
  }
  return map[key] || `/${locale}/admin`
}

function CheckListItem({
  ok,
  title,
  body,
  detail,
}: {
  ok: boolean
  title: string
  body: string
  detail?: string
}) {
  return (
    <li className="flex gap-3 text-sm">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{body}</p>
        {detail ? (
          <p className="mt-1 font-mono text-xs text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </li>
  )
}

export default function OperatorBManual() {
  const t = useTranslations('adminOperatorBManual')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const { operatorId, operator, operationsEnabled } = useOperator()
  const isKovegas = operatorId === KOVEgAS_OPERATOR_ID
  const opsBlocked = searchParams.get('ops_blocked') === '1'

  const [checks, setChecks] = useState<PilotCheckResult[]>([])
  const [regressionChecks, setRegressionChecks] = useState<RegressionCheckResult[]>([])
  const [opsFinanceChecks, setOpsFinanceChecks] = useState<OpsFinanceCheckResult[]>([])
  const [commerceChecks, setCommerceChecks] = useState<CommerceIsolationCheckResult[]>([])
  const [hostBookChecks, setHostBookChecks] = useState<HostBookCheckResult[]>([])
  const [passedCount, setPassedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [regressionPassed, setRegressionPassed] = useState(0)
  const [regressionTotal, setRegressionTotal] = useState(0)
  const [regressionAllOk, setRegressionAllOk] = useState(false)
  const [opsFinancePassed, setOpsFinancePassed] = useState(0)
  const [opsFinanceTotal, setOpsFinanceTotal] = useState(0)
  const [opsFinanceAllOk, setOpsFinanceAllOk] = useState(false)
  const [commercePassed, setCommercePassed] = useState(0)
  const [commerceTotal, setCommerceTotal] = useState(0)
  const [commerceAllOk, setCommerceAllOk] = useState(false)
  const [hostBookPassed, setHostBookPassed] = useState(0)
  const [hostBookTotal, setHostBookTotal] = useState(0)
  const [hostBookAllOk, setHostBookAllOk] = useState(false)
  const [activeOperatorOk, setActiveOperatorOk] = useState(false)
  const [activeOperatorDetail, setActiveOperatorDetail] = useState<string | null>(null)
  const [staffLockOk, setStaffLockOk] = useState(true)
  const [staffLockDetail, setStaffLockDetail] = useState<string | null>(null)
  const [staffLockEnabled, setStaffLockEnabled] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [statusError, setStatusError] = useState<string | null>(null)

  const checkMap = useMemo(() => {
    const map = new Map<string, PilotCheckResult>()
    for (const c of checks) map.set(c.id, c)
    return map
  }, [checks])

  const regressionMap = useMemo(() => {
    const map = new Map<string, RegressionCheckResult>()
    for (const c of regressionChecks) map.set(c.id, c)
    return map
  }, [regressionChecks])

  const opsFinanceMap = useMemo(() => {
    const map = new Map<string, OpsFinanceCheckResult>()
    for (const c of opsFinanceChecks) map.set(c.id, c)
    return map
  }, [opsFinanceChecks])

  const commerceMap = useMemo(() => {
    const map = new Map<string, CommerceIsolationCheckResult>()
    for (const c of commerceChecks) map.set(c.id, c)
    return map
  }, [commerceChecks])

  const hostBookMap = useMemo(() => {
    const map = new Map<string, HostBookCheckResult>()
    for (const c of hostBookChecks) map.set(c.id, c)
    return map
  }, [hostBookChecks])

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true)
    setStatusError(null)
    try {
      const res = await fetchApiWithAuth(
        `/api/admin/operators/pilot-status?operatorId=${encodeURIComponent(operatorId)}`
      )
      const json = await res.json()
      if (!res.ok) {
        setStatusError(json.error || t('statusLoadError'))
        setChecks([])
        setRegressionChecks([])
        setOpsFinanceChecks([])
        setCommerceChecks([])
        setHostBookChecks([])
        setActiveOperatorOk(false)
        setActiveOperatorDetail(null)
        setStaffLockOk(true)
        setStaffLockEnabled(false)
        setStaffLockDetail(null)
        return
      }
      setChecks(Array.isArray(json.checks) ? json.checks : [])
      setPassedCount(Number(json.passedCount) || 0)
      setTotalCount(Number(json.totalCount) || 0)
      const reg = json.regression
      if (reg && Array.isArray(reg.checks)) {
        setRegressionChecks(reg.checks)
        setRegressionPassed(Number(reg.passedCount) || 0)
        setRegressionTotal(Number(reg.totalCount) || 0)
        setRegressionAllOk(!!reg.allOk)
      } else {
        setRegressionChecks([])
        setRegressionPassed(0)
        setRegressionTotal(0)
        setRegressionAllOk(false)
      }
      const opsFin = json.opsFinance
      if (opsFin && Array.isArray(opsFin.checks)) {
        setOpsFinanceChecks(opsFin.checks)
        setOpsFinancePassed(Number(opsFin.passedCount) || 0)
        setOpsFinanceTotal(Number(opsFin.totalCount) || 0)
        setOpsFinanceAllOk(!!opsFin.allOk)
      } else {
        setOpsFinanceChecks([])
        setOpsFinancePassed(0)
        setOpsFinanceTotal(0)
        setOpsFinanceAllOk(false)
      }
      const commerce = json.commerceIsolation
      if (commerce && Array.isArray(commerce.checks)) {
        setCommerceChecks(commerce.checks)
        setCommercePassed(Number(commerce.passedCount) || 0)
        setCommerceTotal(Number(commerce.totalCount) || 0)
        setCommerceAllOk(!!commerce.allOk)
      } else {
        setCommerceChecks([])
        setCommercePassed(0)
        setCommerceTotal(0)
        setCommerceAllOk(false)
      }
      const hb = json.hostBook
      if (hb && Array.isArray(hb.checks)) {
        setHostBookChecks(hb.checks)
        setHostBookPassed(Number(hb.passedCount) || 0)
        setHostBookTotal(Number(hb.totalCount) || 0)
        setHostBookAllOk(!!hb.allOk)
      } else {
        setHostBookChecks([])
        setHostBookPassed(0)
        setHostBookTotal(0)
        setHostBookAllOk(false)
      }
      const aos = json.activeOperatorSession
      if (aos && typeof aos === 'object') {
        setActiveOperatorOk(!!aos.ok)
        setActiveOperatorDetail(typeof aos.detail === 'string' ? aos.detail : null)
      } else {
        setActiveOperatorOk(false)
        setActiveOperatorDetail(null)
      }
      const stl = json.staffTenantLock
      if (stl && typeof stl === 'object') {
        setStaffLockOk(!!stl.ok)
        setStaffLockEnabled(!!stl.lockEnabled)
        setStaffLockDetail(typeof stl.detail === 'string' ? stl.detail : null)
      } else {
        setStaffLockOk(true)
        setStaffLockEnabled(false)
        setStaffLockDetail(null)
      }
    } catch {
      setStatusError(t('statusLoadError'))
      setChecks([])
      setRegressionChecks([])
      setOpsFinanceChecks([])
      setCommerceChecks([])
      setHostBookChecks([])
      setActiveOperatorOk(false)
      setActiveOperatorDetail(null)
      setStaffLockOk(true)
      setStaffLockEnabled(false)
      setStaffLockDetail(null)
    } finally {
      setLoadingStatus(false)
    }
  }, [operatorId, t])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 text-muted-foreground">
          <BookMarked className="h-5 w-5" aria-hidden />
          <span className="text-sm font-medium tracking-wide">{t('eyebrow')}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t('title')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
          {t('description')}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline">
            {t('activeOperator', { name: operator?.name || '—' })}
          </Badge>
          <Badge variant={isKovegas ? 'secondary' : 'default'}>
            {isKovegas ? t('badgeKovegas') : t('badgeTenantB')}
          </Badge>
          <Badge variant={operationsEnabled ? 'default' : 'outline'}>
            {operationsEnabled ? t('opsOn') : t('opsOff')}
          </Badge>
          {!loadingStatus && totalCount > 0 ? (
            <Badge variant="outline">
              {t('pilotScore', { passed: passedCount, total: totalCount })}
            </Badge>
          ) : null}
          {!loadingStatus && regressionTotal > 0 ? (
            <Badge variant={regressionAllOk ? 'default' : 'destructive'}>
              {t('regressionScore', {
                passed: regressionPassed,
                total: regressionTotal,
              })}
            </Badge>
          ) : null}
          {!loadingStatus && commerceTotal > 0 ? (
            <Badge variant={commerceAllOk ? 'default' : 'destructive'}>
              {t('commerceIsolationScore', {
                passed: commercePassed,
                total: commerceTotal,
              })}
            </Badge>
          ) : null}
          {!loadingStatus && hostBookTotal > 0 ? (
            <Badge variant={hostBookAllOk ? 'default' : 'destructive'}>
              {t('hostBookScore', {
                passed: hostBookPassed,
                total: hostBookTotal,
              })}
            </Badge>
          ) : null}
          {!loadingStatus && opsFinanceTotal > 0 ? (
            <Badge variant={opsFinanceAllOk ? 'default' : 'destructive'}>
              {t('opsFinanceScore', {
                passed: opsFinancePassed,
                total: opsFinanceTotal,
              })}
            </Badge>
          ) : null}
          {!loadingStatus ? (
            <Badge
              variant={
                activeOperatorOk
                  ? 'default'
                  : activeOperatorDetail?.includes('Malformed')
                    ? 'destructive'
                    : 'outline'
              }
            >
              {t('activeOperatorSessionBadge', {
                state: activeOperatorOk
                  ? t('activeOperatorSessionOk')
                  : t('activeOperatorSessionPending'),
              })}
            </Badge>
          ) : null}
          {!loadingStatus ? (
            <Badge
              variant={
                !staffLockEnabled ? 'outline' : staffLockOk ? 'default' : 'destructive'
              }
            >
              {t('staffTenantLockBadge', {
                state: !staffLockEnabled
                  ? t('staffTenantLockOff')
                  : staffLockOk
                    ? t('staffTenantLockOnReady')
                    : t('staffTenantLockOnMissingJwt'),
              })}
            </Badge>
          ) : null}
        </div>
      </div>

      {opsBlocked ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
          <p>{t('opsBlockedBanner')}</p>
        </div>
      ) : null}

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('activeOperatorSessionTitle')}</CardTitle>
          <CardDescription>{t('activeOperatorSessionHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CheckListItem
            ok={activeOperatorOk}
            title={t('activeOperatorSessionCheckTitle')}
            body={t('activeOperatorSessionCheckBody')}
            {...(activeOperatorDetail ? { detail: activeOperatorDetail } : {})}
          />
          <CheckListItem
            ok={staffLockOk}
            title={t('staffTenantLockCheckTitle')}
            body={t('staffTenantLockCheckBody')}
            {...(staffLockDetail ? { detail: staffLockDetail } : {})}
          />
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-1 inline-flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden />
              <CardTitle className="text-lg">{t('regressionTitle')}</CardTitle>
            </div>
            <CardDescription>{t('regressionHint')}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 rounded-xl"
            disabled={loadingStatus}
            onClick={() => void loadStatus()}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            {loadingStatus ? t('statusLoading') : t('statusRefresh')}
          </Button>
        </CardHeader>
        <CardContent>
          {statusError ? (
            <p className="mb-4 text-sm text-destructive">{statusError}</p>
          ) : null}
          <ul className="space-y-3">
            {REGRESSION_KEYS.map((key) => {
              const live = regressionMap.get(key)
              return (
                <CheckListItem
                  key={key}
                  ok={live?.ok === true}
                  title={t(`regression.${key}.title`)}
                  body={t(`regression.${key}.body`)}
                  {...(live?.detail ? { detail: live.detail } : {})}
                />
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('commerceIsolationTitle')}</CardTitle>
          <CardDescription>{t('commerceIsolationHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {statusError ? (
            <p className="mb-4 text-sm text-destructive">{statusError}</p>
          ) : null}
          <ul className="space-y-3">
            {COMMERCE_ISOLATION_KEYS.map((key) => {
              const live = commerceMap.get(key)
              return (
                <CheckListItem
                  key={key}
                  ok={live?.ok === true}
                  title={t(`commerceIsolation.${key}.title`)}
                  body={t(`commerceIsolation.${key}.body`)}
                  {...(live?.detail ? { detail: live.detail } : {})}
                />
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('hostBookTitle')}</CardTitle>
          <CardDescription>{t('hostBookHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {statusError ? (
            <p className="mb-4 text-sm text-destructive">{statusError}</p>
          ) : null}
          <ul className="space-y-3">
            {HOST_BOOK_KEYS.map((key) => {
              const live = hostBookMap.get(key)
              return (
                <CheckListItem
                  key={key}
                  ok={live?.ok === true}
                  title={t(`hostBookChecks.${key}.title`)}
                  body={t(`hostBookChecks.${key}.body`)}
                  {...(live?.detail ? { detail: live.detail } : {})}
                />
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('opsFinanceTitle')}</CardTitle>
          <CardDescription>{t('opsFinanceHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {statusError ? (
            <p className="mb-4 text-sm text-destructive">{statusError}</p>
          ) : null}
          <ul className="space-y-3">
            {OPS_FINANCE_KEYS.map((key) => {
              const live = opsFinanceMap.get(key)
              return (
                <CheckListItem
                  key={key}
                  ok={live?.ok === true}
                  title={t(`opsFinance.${key}.title`)}
                  body={t(`opsFinance.${key}.body`)}
                  {...(live?.detail ? { detail: live.detail } : {})}
                />
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('safetyTitle')}</CardTitle>
          <CardDescription>{t('safetyHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {SAFETY_KEYS.map((key) => (
            <div key={key} className="rounded-lg border border-border/60 p-4">
              <h3 className="text-sm font-semibold">{t(`safety.${key}.title`)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`safety.${key}.body`)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('structureTitle')}</CardTitle>
          <CardDescription>{t('structureHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {STRUCTURE_KEYS.map((key) => (
            <div key={key} className="rounded-lg border border-border/60 p-4">
              <h3 className="text-sm font-semibold">{t(`structure.${key}.title`)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`structure.${key}.body`)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('e2eTitle')}</CardTitle>
          <CardDescription>{t('e2eHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            {E2E_KEYS.map((key) => (
              <li key={key}>
                <p className="font-medium">{t(`e2e.${key}.title`)}</p>
                <p className="text-muted-foreground">{t(`e2e.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('todoTitle')}</CardTitle>
          <CardDescription>{t('todoHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isKovegas ? (
            <p className="mb-4 text-sm text-muted-foreground">{t('todoKovegasHint')}</p>
          ) : null}
          <ul className="space-y-3">
            {TODO_KEYS.map((key) => {
              const live = checkMap.get(key)
              return (
                <CheckListItem
                  key={key}
                  ok={live?.ok === true}
                  title={t(`todos.${key}.title`)}
                  body={t(`todos.${key}.body`)}
                  {...(live?.detail ? { detail: live.detail } : {})}
                />
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('pagesTitle')}</CardTitle>
          <CardDescription>{t('pagesHint')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {PAGE_LINKS.map((page) => (
            <Link
              key={page.hrefKey}
              href={hrefFor(locale, page.hrefKey)}
              className="group rounded-xl border border-border/60 p-4 transition hover:border-border hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold group-hover:underline">
                  {t(page.titleKey)}
                </h3>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </div>
              {page.badgeKey ? (
                <Badge variant="secondary" className="mt-2">
                  {t(page.badgeKey)}
                </Badge>
              ) : null}
              <p className="mt-2 text-sm text-muted-foreground">{t(page.bodyKey)}</p>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('doneTitle')}</CardTitle>
          <CardDescription>{t('doneHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {(
              [
                'doneTenant',
                'doneCatalog',
                'donePublic',
                'doneCheckout',
                'doneConnect',
                'doneOta',
                'doneOpsGate',
                'doneOpsRouteGuard',
                'donePilotStatus',
                'doneOtaInbound',
                'doneRegression',
                'doneOpsVehicles',
                'doneOpsMaintenance',
                'doneOpsAttendance',
                'doneOpsExpenses',
                'doneOpsMealTips',
                'doneOpsTipShares',
                'doneOpsTourResExpenses',
                'doneOpsReconCashScope',
                'doneOpsCashFinancial',
                'doneOpsStatementImports',
                'doneOpsReconMatches',
                'doneOpsPaymentRecords',
                'doneOpsFinanceSmoke',
                'doneOpsPaymentRecordsRls',
                'doneOpsFinanceSelectRls',
                'doneOpsCompanyExpensesRls',
                'doneOpsJournal',
                'doneOpsFleetSelectRls',
                'doneOpsAttendanceSelectRls',
                'doneOpsTipMealSelectRls',
                'doneOpsTourResExpensesSelectRls',
                'doneOpsActiveOperatorSession',
                'doneOpsStaffTenantLockPilot',
                'doneCommerceIsolationSmoke',
                'doneHostBookReadiness',
              ] as const
            ).map((key) => (
              <li key={key} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
