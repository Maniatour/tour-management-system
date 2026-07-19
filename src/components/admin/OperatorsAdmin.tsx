'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Building2, CreditCard, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import type { OperatorMemberRole } from '@/lib/operatorConstants'

type OperatorRow = {
  id: string
  name: string
  slug: string
  status: string
  plan_code: string
  subdomain: string | null
  stripe_connect_account_id?: string | null
  stripe_connect_status: string
  modules: { commerce?: boolean; operations?: boolean } | null
  created_at: string
}

type MemberRow = {
  id: string
  email: string
  role: string
  status: string
}

export default function OperatorsAdmin() {
  const t = useTranslations('adminOperators')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const connectReturnHandled = useRef(false)
  const [operators, setOperators] = useState<OperatorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connectBusyId, setConnectBusyId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [enableOperations, setEnableOperations] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OperatorMemberRole>('ops')

  const loadOperators = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/operators')
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('loadError'))
        setOperators([])
        return
      }
      setOperators(Array.isArray(json.operators) ? json.operators : [])
    } catch {
      toast.error(t('loadError'))
      setOperators([])
    } finally {
      setLoading(false)
    }
  }, [t])

  const loadMembers = useCallback(
    async (operatorId: string) => {
      setLoadingMembers(true)
      try {
        const res = await fetchApiWithAuth(
          `/api/admin/operators/${encodeURIComponent(operatorId)}/members`
        )
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error || t('membersLoadError'))
          setMembers([])
          return
        }
        setMembers(Array.isArray(json.members) ? json.members : [])
      } catch {
        toast.error(t('membersLoadError'))
        setMembers([])
      } finally {
        setLoadingMembers(false)
      }
    },
    [t]
  )

  useEffect(() => {
    void loadOperators()
  }, [loadOperators])

  useEffect(() => {
    if (selectedId) void loadMembers(selectedId)
  }, [selectedId, loadMembers])

  const refreshConnectStatus = useCallback(
    async (operatorId: string, opts?: { silent?: boolean }) => {
      setConnectBusyId(operatorId)
      try {
        const res = await fetchApiWithAuth(
          `/api/admin/operators/${encodeURIComponent(operatorId)}/stripe-connect`
        )
        const json = await res.json()
        if (!res.ok) {
          if (!opts?.silent) toast.error(json.error || t('connectSyncError'))
          return
        }
        if (!opts?.silent) {
          toast.success(t('connectSyncSuccess', { status: json.status || '—' }))
        }
        await loadOperators()
      } catch {
        if (!opts?.silent) toast.error(t('connectSyncError'))
      } finally {
        setConnectBusyId(null)
      }
    },
    [loadOperators, t]
  )

  const startConnect = useCallback(
    async (operatorId: string) => {
      setConnectBusyId(operatorId)
      try {
        const res = await fetchApiWithAuth(
          `/api/admin/operators/${encodeURIComponent(operatorId)}/stripe-connect`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale }),
          }
        )
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error || t('connectStartError'))
          return
        }
        const url = typeof json.onboardingUrl === 'string' ? json.onboardingUrl : ''
        if (!url) {
          toast.error(t('connectStartError'))
          return
        }
        toast.success(t('connectStartSuccess'))
        window.location.href = url
      } catch {
        toast.error(t('connectStartError'))
        setConnectBusyId(null)
      }
    },
    [locale, t]
  )

  useEffect(() => {
    if (connectReturnHandled.current) return
    const connectFlag = searchParams.get('connect')
    const operatorId = searchParams.get('operator')
    if (connectFlag !== '1' || !operatorId) return
    connectReturnHandled.current = true
    setSelectedId(operatorId)
    void refreshConnectStatus(operatorId)
  }, [searchParams, refreshConnectStatus])

  const create = async () => {
    if (!name.trim() || !slug.trim() || !ownerEmail.trim()) {
      toast.error(t('fieldsRequired'))
      return
    }
    setSaving(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          ownerEmail: ownerEmail.trim(),
          enableOperations,
          status: 'pending',
          ...(subdomain.trim() ? { subdomain: subdomain.trim().toLowerCase() } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('createError'))
        return
      }
      toast.success(t('createSuccess'))
      setName('')
      setSlug('')
      setSubdomain('')
      setOwnerEmail('')
      setEnableOperations(false)
      await loadOperators()
      if (json.operatorId) setSelectedId(json.operatorId)
    } catch {
      toast.error(t('createError'))
    } finally {
      setSaving(false)
    }
  }

  const invite = async () => {
    if (!selectedId || !inviteEmail.trim()) {
      toast.error(t('inviteRequired'))
      return
    }
    setSaving(true)
    try {
      const res = await fetchApiWithAuth(
        `/api/admin/operators/${encodeURIComponent(selectedId)}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
        }
      )
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('inviteError'))
        return
      }
      toast.success(t('inviteSuccess'))
      setInviteEmail('')
      await loadMembers(selectedId)
    } catch {
      toast.error(t('inviteError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-5 w-5" aria-hidden />
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
          onClick={() => void loadOperators()}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          {t('refresh')}
        </Button>
      </div>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('createTitle')}</CardTitle>
          <CardDescription>{t('createHint')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="op-name">{t('fieldName')}</Label>
            <Input
              id="op-name"
              className="h-11 rounded-lg"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="op-slug">{t('fieldSlug')}</Label>
            <Input
              id="op-slug"
              className="h-11 rounded-lg"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="demo-tour"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="op-subdomain">{t('fieldSubdomain')}</Label>
            <Input
              id="op-subdomain"
              className="h-11 rounded-lg"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              placeholder="demo"
            />
            <p className="text-xs text-muted-foreground">{t('fieldSubdomainHint')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="op-owner">{t('fieldOwnerEmail')}</Label>
            <Input
              id="op-owner"
              type="email"
              className="h-11 rounded-lg"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Checkbox
              id="op-ops"
              checked={enableOperations}
              onCheckedChange={(v) => setEnableOperations(v === true)}
            />
            <Label htmlFor="op-ops" className="font-normal">
              {t('fieldEnableOperations')}
            </Label>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              className="h-11 w-full rounded-xl"
              disabled={saving}
              onClick={() => void create()}
            >
              {saving ? t('saving') : t('create')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('listTitle')}</CardTitle>
          <CardDescription>{t('listHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colName')}</TableHead>
                  <TableHead>{t('colSlug')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  <TableHead>{t('colConnect')}</TableHead>
                  <TableHead>{t('colPlan')}</TableHead>
                  <TableHead className="text-right">{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {t('loading')}
                    </TableCell>
                  </TableRow>
                ) : operators.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {t('empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  operators.map((op) => (
                    <TableRow
                      key={op.id}
                      className={selectedId === op.id ? 'bg-muted/40' : undefined}
                    >
                      <TableCell className="font-medium">{op.name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {op.slug}
                        {op.subdomain ? (
                          <span className="ml-1 text-muted-foreground">
                            ({op.subdomain})
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={op.status === 'active' ? 'default' : 'secondary'}>
                          {op.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={
                              op.stripe_connect_status === 'enabled' ? 'default' : 'secondary'
                            }
                          >
                            {op.stripe_connect_status || 'not_started'}
                          </Badge>
                          {op.stripe_connect_account_id ? (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {op.stripe_connect_account_id}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{op.plan_code}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            disabled={connectBusyId === op.id}
                            onClick={() => void startConnect(op.id)}
                          >
                            <CreditCard className="mr-1 h-3.5 w-3.5" aria-hidden />
                            {op.stripe_connect_status === 'not_started' ||
                            !op.stripe_connect_status
                              ? t('connectStart')
                              : t('connectContinue')}
                          </Button>
                          {op.stripe_connect_account_id ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={connectBusyId === op.id}
                              onClick={() => void refreshConnectStatus(op.id)}
                            >
                              {t('connectRefresh')}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedId(op.id)}
                          >
                            {t('manageMembers')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedId ? (
        <Card className="rounded-xl border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">{t('membersTitle')}</CardTitle>
            <CardDescription>{t('membersHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="invite-email">{t('fieldInviteEmail')}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  className="h-11 rounded-lg"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('fieldInviteRole')}</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as OperatorMemberRole)}
                >
                  <SelectTrigger className="h-11 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['owner', 'admin', 'ops', 'finance', 'guide', 'read_only'] as const).map(
                      (role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  className="h-11 w-full rounded-xl"
                  disabled={saving}
                  onClick={() => void invite()}
                >
                  {t('invite')}
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colEmail')}</TableHead>
                    <TableHead>{t('colRole')}</TableHead>
                    <TableHead>{t('colStatus')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingMembers ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        {t('loading')}
                      </TableCell>
                    </TableRow>
                  ) : members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        {t('emptyMembers')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.email}</TableCell>
                        <TableCell>{m.role}</TableCell>
                        <TableCell>
                          <Badge variant={m.status === 'active' ? 'default' : 'secondary'}>
                            {m.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
