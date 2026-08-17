'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Loader2, Send, X } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import {
  buildRentalCarPickupDropoffSms,
  type RentalCarPickupDropoffSmsKind,
} from '@/lib/rentalCarPickupDropoffSms'
import {
  formatStaffNames,
  rentalCarCardRecipients,
  type RentalCarPickupDropoffCard,
} from '@/lib/rentalCarPickupDropoffQueue'

type RentalCarPickupDropoffSmsModalProps = {
  isOpen: boolean
  locale: string
  kind: RentalCarPickupDropoffSmsKind
  card: RentalCarPickupDropoffCard | null
  continuingVehicleId?: string | null
  onClose: () => void
  onSent?: () => void
}

function titleForKind(kind: RentalCarPickupDropoffSmsKind, isKo: boolean): string {
  if (kind === 'pickup') return isKo ? '픽업 안내 문자' : 'Pickup SMS'
  if (kind === 'return') return isKo ? '반납 안내 문자' : 'Return SMS'
  return isKo ? '공항 픽업 요청 문자' : 'Airport pickup SMS'
}

export function RentalCarPickupDropoffSmsModal({
  isOpen,
  locale,
  kind,
  card,
  continuingVehicleId = null,
  onClose,
  onSent,
}: RentalCarPickupDropoffSmsModalProps) {
  const isKo = locale === 'ko'
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [edits, setEdits] = useState<Record<string, string>>({})

  const recipients = useMemo(
    () => (card ? rentalCarCardRecipients(card, kind, continuingVehicleId) : []),
    [card, kind, continuingVehicleId]
  )

  const continuing =
    card?.continuingCrews.find((c) => c.vehicleId === continuingVehicleId) ?? card?.continuingCrews[0]
  const lastUsers = card ? formatStaffNames([card.lastTour?.guide, card.lastTour?.assistant]) : ''

  useEffect(() => {
    if (!isOpen || !card) {
      setEdits({})
      setSelectedEmails(new Set())
      setError(null)
      return
    }
    const next: Record<string, string> = {}
    for (const recipient of recipients) {
      next[recipient.email] = buildRentalCarPickupDropoffSms(kind, {
        recipientName: recipient.displayName,
        vehicleLabel: card.vehicleLabel,
        company: card.rentalCompany,
        location: kind === 'pickup' ? card.pickupLocation : card.returnLocation,
        agreementNumber: card.agreementNumber,
        startDate: card.startDate,
        endDate: card.endDate,
        lastUsers,
        returnCrew: lastUsers || (isKo ? '반납 팀' : 'return crew'),
        returnVehicleLabel: card.vehicleLabel,
        continuingVehicleLabel: continuing?.vehicleLabel ?? null,
      })
    }
    setEdits(next)
    setSelectedEmails(new Set(recipients.map((r) => r.email)))
    setError(null)
  }, [isOpen, card, kind, continuing, lastUsers, recipients, isKo])

  if (!isOpen || !card) return null

  const toggleRecipient = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  const handleSend = async () => {
    if (selectedEmails.size === 0) {
      setError(isKo ? '수신자를 선택해 주세요.' : 'Select at least one recipient.')
      return
    }
    setSending(true)
    setError(null)
    try {
      const recipientOverrides = Array.from(selectedEmails).map((email) => ({
        email,
        smsBody: (edits[email] || '').trim(),
      }))
      const response = await fetchApiWithAuth('/api/rental-car-pickup-dropoff/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: card.vehicleId,
          kind,
          locale,
          continuingVehicleId,
          recipientEmails: Array.from(selectedEmails),
          recipientOverrides,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || (isKo ? '발송에 실패했습니다.' : 'Failed to send.'))
      alert(data.message || (isKo ? '발송되었습니다.' : 'Sent.'))
      onSent?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : isKo ? '발송에 실패했습니다.' : 'Failed to send.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">{titleForKind(kind, isKo)}</p>
            <p className="text-xs text-muted-foreground">{card.vehicleLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {recipients.length === 0 ? (
            <p className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
              {kind === 'pickup'
                ? isKo
                  ? '예약자(픽업 담당)가 없습니다. 먼저 팀원을 지정해 주세요.'
                  : 'No reserved pickup person. Assign a team member first.'
                : isKo
                  ? '안내할 가이드/드라이버가 없습니다.'
                  : 'No guide or driver to notify.'}
            </p>
          ) : (
            recipients.map((recipient) => (
              <div key={recipient.email} className="rounded-lg border border-border/70 p-3">
                <label className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <input
                      type="checkbox"
                      checked={selectedEmails.has(recipient.email)}
                      onChange={() => toggleRecipient(recipient.email)}
                    />
                    {recipient.displayName}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50"
                    onClick={async () => {
                      const value = edits[recipient.email] || ''
                      if (!value.trim()) return
                      await navigator.clipboard.writeText(value)
                      setCopiedEmail(recipient.email)
                      window.setTimeout(() => setCopiedEmail(null), 1600)
                    }}
                  >
                    {copiedEmail === recipient.email ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copiedEmail === recipient.email ? (isKo ? '복사됨' : 'Copied') : isKo ? '복사' : 'Copy'}
                  </button>
                </label>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {recipient.phone || (isKo ? '전화번호 없음' : 'No phone')}
                </p>
                <textarea
                  value={edits[recipient.email] || ''}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [recipient.email]: e.target.value }))}
                  rows={6}
                  className="mt-2 w-full rounded-lg border border-input px-2.5 py-2 text-xs leading-5"
                />
              </div>
            ))
          )}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {isKo ? '닫기' : 'Close'}
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || recipients.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {isKo ? '문자 보내기' : 'Send SMS'}
          </button>
        </div>
      </div>
    </div>
  )
}
