'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { KOVEgAS_VIATOR_DRY_RUN_CONNECTION_ID } from '@/lib/commerce/ota/types'

type MappingRow = {
  id: string
  connection_id: string
  internal_type: string
  internal_id: string
  external_sku: string
  external_product_id: string | null
  external_package_id: string | null
  is_active: boolean
  created_at: string
}

type OutboxRow = {
  id: string
  event_type: string
  entity_type: string
  entity_id: string
  status: string
  attempts: number
  last_error: string | null
  idempotency_key: string | null
  created_at: string
}

type ConnectionRow = {
  id: string
  platform: string
  display_name: string
  status: string
  credentials_ref: string | null
  config: Record<string, unknown> | null
  last_synced_at: string | null
}

type InboundRow = {
  id: string
  platform: string
  event_type: string
  external_event_id: string
  external_booking_id: string | null
  external_sku: string | null
  status: string
  reservation_id: string | null
  last_error: string | null
  created_at: string
  processed_at: string | null
}

const INTERNAL_TYPES = ['product', 'offer', 'rate_plan', 'choice_option'] as const
const CONNECTION_STATUSES = ['disabled', 'dry_run', 'active'] as const

function statusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'succeeded' || status === 'processed') return 'default'
  if (
    status === 'skipped' ||
    status === 'pending' ||
    status === 'received' ||
    status === 'processing'
  ) {
    return 'secondary'
  }
  if (status === 'failed') return 'destructive'
  return 'outline'
}

export default function OtaDistributionAdmin() {
  const t = useTranslations('adminOtaDistribution')
  const [mappings, setMappings] = useState<MappingRow[]>([])
  const [events, setEvents] = useState<OutboxRow[]>([])
  const [connections, setConnections] = useState<ConnectionRow[]>([])
  const [liveFlag, setLiveFlag] = useState(false)
  const [inboundFlag, setInboundFlag] = useState(false)
  const [inboundEvents, setInboundEvents] = useState<InboundRow[]>([])
  const [loadingMappings, setLoadingMappings] = useState(true)
  const [loadingOutbox, setLoadingOutbox] = useState(true)
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [loadingInbound, setLoadingInbound] = useState(true)
  const [saving, setSaving] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [credentialsDraft, setCredentialsDraft] = useState('env:OTA_VIATOR_API_KEY')
  const [ratesUrlDraft, setRatesUrlDraft] = useState('')
  const [testSku, setTestSku] = useState('')

  const [internalType, setInternalType] =
    useState<(typeof INTERNAL_TYPES)[number]>('product')
  const [internalId, setInternalId] = useState('')
  const [externalSku, setExternalSku] = useState('')
  const [externalProductId, setExternalProductId] = useState('')
  const [externalPackageId, setExternalPackageId] = useState('')

  const primaryConnection =
    connections.find((c) => c.id === KOVEgAS_VIATOR_DRY_RUN_CONNECTION_ID) ||
    connections[0] ||
    null

  const loadConnections = useCallback(async () => {
    setLoadingConnections(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/commerce/ota/connections')
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('connectionLoadError'))
        setConnections([])
        return
      }
      const rows = Array.isArray(json.connections) ? (json.connections as ConnectionRow[]) : []
      setConnections(rows)
      setLiveFlag(!!json.liveFlag)
      const primary =
        rows.find((c) => c.id === KOVEgAS_VIATOR_DRY_RUN_CONNECTION_ID) || rows[0]
      if (primary) {
        setCredentialsDraft(primary.credentials_ref || 'env:OTA_VIATOR_API_KEY')
        const url = primary.config?.ratesPushUrl
        setRatesUrlDraft(typeof url === 'string' ? url : '')
      }
    } catch {
      toast.error(t('connectionLoadError'))
      setConnections([])
    } finally {
      setLoadingConnections(false)
    }
  }, [t])

  const loadMappings = useCallback(async () => {
    setLoadingMappings(true)
    try {
      const res = await fetchApiWithAuth(
        `/api/admin/commerce/ota/mappings?connectionId=${encodeURIComponent(
          KOVEgAS_VIATOR_DRY_RUN_CONNECTION_ID
        )}`
      )
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('loadError'))
        setMappings([])
        return
      }
      setMappings(Array.isArray(json.mappings) ? json.mappings : [])
    } catch {
      toast.error(t('loadError'))
      setMappings([])
    } finally {
      setLoadingMappings(false)
    }
  }, [t])

  const loadOutbox = useCallback(async () => {
    setLoadingOutbox(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/commerce/ota/outbox?limit=40')
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('outboxLoadError'))
        setEvents([])
        return
      }
      setEvents(Array.isArray(json.events) ? json.events : [])
    } catch {
      toast.error(t('outboxLoadError'))
      setEvents([])
    } finally {
      setLoadingOutbox(false)
    }
  }, [t])

  const loadInbound = useCallback(async () => {
    setLoadingInbound(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/commerce/ota/inbound?limit=40')
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('inboundLoadError'))
        setInboundEvents([])
        return
      }
      setInboundFlag(!!json.inboundFlag)
      setInboundEvents(Array.isArray(json.events) ? json.events : [])
    } catch {
      toast.error(t('inboundLoadError'))
      setInboundEvents([])
    } finally {
      setLoadingInbound(false)
    }
  }, [t])

  useEffect(() => {
    void loadConnections()
    void loadMappings()
    void loadOutbox()
    void loadInbound()
  }, [loadConnections, loadMappings, loadOutbox, loadInbound])

  const updateConnection = async (patch: {
    status?: string
    credentialsRef?: string | null
    config?: Record<string, unknown>
  }) => {
    if (!primaryConnection) {
      toast.error(t('connectionMissing'))
      return
    }
    setSaving(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/commerce/ota/connections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: primaryConnection.id,
          ...patch,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('connectionSaveError'))
        return
      }
      toast.success(t('connectionSaveSuccess'))
      await loadConnections()
    } catch {
      toast.error(t('connectionSaveError'))
    } finally {
      setSaving(false)
    }
  }

  const saveMapping = async () => {
    if (!internalId.trim() || !externalSku.trim()) {
      toast.error(t('fieldsRequired'))
      return
    }
    setSaving(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/commerce/ota/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: KOVEgAS_VIATOR_DRY_RUN_CONNECTION_ID,
          internalType,
          internalId: internalId.trim(),
          externalSku: externalSku.trim(),
          externalProductId: externalProductId.trim() || undefined,
          externalPackageId: externalPackageId.trim() || undefined,
          isActive: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('saveError'))
        return
      }
      toast.success(t('saveSuccess'))
      setInternalId('')
      setExternalSku('')
      setExternalProductId('')
      setExternalPackageId('')
      await loadMappings()
    } catch {
      toast.error(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  const deactivateMapping = async (row: MappingRow) => {
    setSaving(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/commerce/ota/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: row.connection_id,
          internalType: row.internal_type,
          internalId: row.internal_id,
          externalSku: row.external_sku,
          externalProductId: row.external_product_id || undefined,
          externalPackageId: row.external_package_id || undefined,
          isActive: false,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('saveError'))
        return
      }
      toast.success(t('deactivateSuccess'))
      await loadMappings()
    } catch {
      toast.error(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  const processOutbox = async () => {
    setProcessing(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/commerce/ota/process-outbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 20 }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('processError'))
        return
      }
      toast.success(
        t('processSuccess', {
          claimed: json.claimed ?? 0,
          succeeded: json.succeeded ?? 0,
          skipped: json.skipped ?? 0,
          failed: json.failed ?? 0,
        })
      )
      await loadOutbox()
    } catch {
      toast.error(t('processError'))
    } finally {
      setProcessing(false)
    }
  }

  const ingestTestInbound = async () => {
    if (!testSku.trim()) {
      toast.error(t('inboundSkuRequired'))
      return
    }
    setProcessing(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/commerce/ota/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ingest',
          platform: 'viator',
          connectionId: KOVEgAS_VIATOR_DRY_RUN_CONNECTION_ID,
          payload: {
            eventId: `test-${Date.now()}`,
            eventType: 'booking_created',
            booking: {
              sku: testSku.trim(),
              tourDate: new Date().toISOString().slice(0, 10),
              adults: 2,
              customer: {
                name: 'OTA Test Guest',
                email: 'ota-test@example.com',
                phone: '+10000000000',
              },
            },
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('inboundIngestError'))
        return
      }
      toast.success(t('inboundIngestSuccess'))
      await loadInbound()
    } catch {
      toast.error(t('inboundIngestError'))
    } finally {
      setProcessing(false)
    }
  }

  const processInboundBatch = async () => {
    setProcessing(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/commerce/ota/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'processBatch', limit: 20 }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('inboundProcessError'))
        return
      }
      toast.success(t('inboundProcessSuccess', { claimed: json.claimed ?? 0 }))
      await loadInbound()
    } catch {
      toast.error(t('inboundProcessError'))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-muted-foreground">
            <Share2 className="h-5 w-5" aria-hidden />
            <span className="text-sm font-medium tracking-wide">{t('eyebrow')}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t('title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
            {t('description')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 rounded-xl"
          onClick={() => {
            void loadConnections()
            void loadMappings()
            void loadOutbox()
            void loadInbound()
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          {t('refresh')}
        </Button>
      </div>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('connectionTitle')}</CardTitle>
          <CardDescription>{t('connectionHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingConnections ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : !primaryConnection ? (
            <p className="text-sm text-muted-foreground">{t('connectionMissing')}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{primaryConnection.platform}</Badge>
                <span className="text-sm font-medium">{primaryConnection.display_name}</span>
                <Badge variant={primaryConnection.status === 'active' ? 'default' : 'secondary'}>
                  {primaryConnection.status}
                </Badge>
                <Badge variant={liveFlag ? 'default' : 'outline'}>
                  {liveFlag ? t('liveFlagOn') : t('liveFlagOff')}
                </Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ota-conn-status">{t('fieldConnectionStatus')}</Label>
                  <Select
                    value={primaryConnection.status}
                    onValueChange={(v) => void updateConnection({ status: v })}
                    disabled={saving}
                  >
                    <SelectTrigger id="ota-conn-status" className="h-11 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONNECTION_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {t(`connectionStatus.${status}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ota-cred-ref">{t('fieldCredentialsRef')}</Label>
                  <Input
                    id="ota-cred-ref"
                    className="h-11 rounded-lg font-mono text-sm"
                    value={credentialsDraft}
                    onChange={(e) => setCredentialsDraft(e.target.value)}
                    placeholder="env:OTA_VIATOR_API_KEY"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="ota-rates-url">{t('fieldRatesPushUrl')}</Label>
                  <Input
                    id="ota-rates-url"
                    className="h-11 rounded-lg font-mono text-sm"
                    value={ratesUrlDraft}
                    onChange={(e) => setRatesUrlDraft(e.target.value)}
                    placeholder="https://… or leave empty + simulate"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-11 rounded-xl"
                  disabled={saving}
                  onClick={() =>
                    void updateConnection({
                      credentialsRef: credentialsDraft.trim() || null,
                      config: {
                        ratesPushUrl: ratesUrlDraft.trim() || null,
                        simulate: !ratesUrlDraft.trim(),
                      },
                    })
                  }
                >
                  {saving ? t('saving') : t('saveConnection')}
                </Button>
              </div>
              {primaryConnection.last_synced_at ? (
                <p className="text-xs text-muted-foreground">
                  {t('lastSynced', {
                    at: new Date(primaryConnection.last_synced_at).toLocaleString(),
                  })}
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('mappingTitle')}</CardTitle>
          <CardDescription>{t('mappingHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ota-internal-type">{t('fieldInternalType')}</Label>
              <Select
                value={internalType}
                onValueChange={(v) =>
                  setInternalType(v as (typeof INTERNAL_TYPES)[number])
                }
              >
                <SelectTrigger id="ota-internal-type" className="h-11 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERNAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`internalType.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ota-internal-id">{t('fieldInternalId')}</Label>
              <Input
                id="ota-internal-id"
                className="h-11 rounded-lg"
                value={internalId}
                onChange={(e) => setInternalId(e.target.value)}
                placeholder={t('placeholderInternalId')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ota-external-sku">{t('fieldExternalSku')}</Label>
              <Input
                id="ota-external-sku"
                className="h-11 rounded-lg"
                value={externalSku}
                onChange={(e) => setExternalSku(e.target.value)}
                placeholder={t('placeholderExternalSku')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ota-ext-product">{t('fieldExternalProductId')}</Label>
              <Input
                id="ota-ext-product"
                className="h-11 rounded-lg"
                value={externalProductId}
                onChange={(e) => setExternalProductId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ota-ext-package">{t('fieldExternalPackageId')}</Label>
              <Input
                id="ota-ext-package"
                className="h-11 rounded-lg"
                value={externalPackageId}
                onChange={(e) => setExternalPackageId(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                className="h-11 w-full rounded-xl"
                disabled={saving}
                onClick={() => void saveMapping()}
              >
                {saving ? t('saving') : t('saveMapping')}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colInternalType')}</TableHead>
                  <TableHead>{t('colInternalId')}</TableHead>
                  <TableHead>{t('colExternalSku')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  <TableHead className="text-right">{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMappings ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      {t('loading')}
                    </TableCell>
                  </TableRow>
                ) : mappings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      {t('emptyMappings')}
                    </TableCell>
                  </TableRow>
                ) : (
                  mappings.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.internal_type}</TableCell>
                      <TableCell className="max-w-[200px] truncate font-mono text-xs">
                        {row.internal_id}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.external_sku}</TableCell>
                      <TableCell>
                        <Badge variant={row.is_active ? 'default' : 'secondary'}>
                          {row.is_active ? t('active') : t('inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.is_active ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={saving}
                            onClick={() => void deactivateMapping(row)}
                          >
                            {t('deactivate')}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">{t('inboundTitle')}</CardTitle>
            <CardDescription>{t('inboundHint')}</CardDescription>
            <div className="mt-2">
              <Badge variant={inboundFlag ? 'default' : 'outline'}>
                {inboundFlag ? t('inboundFlagOn') : t('inboundFlagOff')}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              disabled={processing}
              onClick={() => void ingestTestInbound()}
            >
              {t('inboundIngestTest')}
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl"
              disabled={processing}
              onClick={() => void processInboundBatch()}
            >
              {processing ? t('processing') : t('inboundProcessBatch')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md space-y-2">
            <Label htmlFor="ota-test-sku">{t('inboundTestSku')}</Label>
            <Input
              id="ota-test-sku"
              className="h-11 rounded-lg font-mono text-sm"
              value={testSku}
              onChange={(e) => setTestSku(e.target.value)}
              placeholder={t('placeholderExternalSku')}
            />
          </div>
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colEvent')}</TableHead>
                  <TableHead>{t('colExternalSku')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  <TableHead>{t('colReservation')}</TableHead>
                  <TableHead>{t('colError')}</TableHead>
                  <TableHead>{t('colCreated')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingInbound ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {t('loading')}
                    </TableCell>
                  </TableRow>
                ) : inboundEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {t('emptyInbound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  inboundEvents.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="font-medium">{ev.event_type}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {ev.external_sku || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(ev.status)}>{ev.status}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate font-mono text-xs">
                        {ev.reservation_id || '—'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {ev.last_error || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {ev.created_at ? new Date(ev.created_at).toLocaleString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">{t('outboxTitle')}</CardTitle>
            <CardDescription>{t('outboxHint')}</CardDescription>
          </div>
          <Button
            type="button"
            className="h-11 rounded-xl"
            disabled={processing}
            onClick={() => void processOutbox()}
          >
            {processing ? t('processing') : t('processOutbox')}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colEvent')}</TableHead>
                  <TableHead>{t('colEntity')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  <TableHead>{t('colAttempts')}</TableHead>
                  <TableHead>{t('colError')}</TableHead>
                  <TableHead>{t('colCreated')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingOutbox ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {t('loading')}
                    </TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {t('emptyOutbox')}
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="font-medium">{ev.event_type}</TableCell>
                      <TableCell className="max-w-[180px] truncate font-mono text-xs">
                        {ev.entity_type}:{ev.entity_id}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(ev.status)}>{ev.status}</Badge>
                      </TableCell>
                      <TableCell>{ev.attempts}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {ev.last_error || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {ev.created_at ? new Date(ev.created_at).toLocaleString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
