'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import WaiverDocumentView from '@/components/waiver/WaiverDocumentView'
import WaiverSignaturePad from '@/components/waiver/WaiverSignaturePad'
import { WAIVER_LOCALE_LABELS } from '@/lib/waiver/locales'
import { getWaiverUi } from '@/lib/waiver/ui'
import { WAIVER_LOCALES, type WaiverLocale } from '@/lib/waiver/types'

type RequiredDoc = {
  code: string
  status: string
  requiredForSigning: boolean
  displayName: string
  operatorName: string
  content: Parameters<typeof WaiverDocumentView>[0]['content'] | null
}

type Participant = {
  id: string
  slotIndex: number
  label: string
  type: 'ADULT' | 'MINOR' | null
  signed: boolean
  completedCount: number
  requiredCount: number
}

type Session = {
  bookingNumber: string
  tourDate: string
  tourName: string
  guestCount: number
  requiredWaivers: Array<{ code: string; status: string; requiredForSigning: boolean }>
  participants: Participant[]
  completedCount: number
  requiredCount: number
}

type Step = 'list' | 'form' | 'docs' | 'acks' | 'sign' | 'success'

function waiverSigningApiUrl(token: string, query = '') {
  return `/api/waiver-signing/${encodeURIComponent(token)}${query}`
}

const emptyForm = {
  fullLegalName: '',
  dateOfBirth: '',
  email: '',
  phone: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  participantType: 'ADULT' as 'ADULT' | 'MINOR',
  guardianFullLegalName: '',
  relationshipToMinor: '',
}

export default function WaiverSigningClient({
  token,
  preview = false,
  previewSession,
  previewDocuments,
  onPreviewLangChange,
  initialLang = 'en',
}: {
  token?: string
  preview?: boolean
  previewSession?: Session | null
  previewDocuments?: RequiredDoc[]
  onPreviewLangChange?: (lang: WaiverLocale) => void
  initialLang?: WaiverLocale
}) {
  const [lang, setLang] = useState<WaiverLocale>(initialLang)
  const ui = getWaiverUi(lang)
  const [session, setSession] = useState<Session | null>(null)
  const [docs, setDocs] = useState<RequiredDoc[]>([])
  const [loadError, setLoadError] = useState(false)
  const [step, setStep] = useState<Step>('list')
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [docAccept, setDocAccept] = useState<Record<string, boolean>>({})
  const [acks, setAcks] = useState({
    readAgreements: false,
    inherentRisks: false,
    releasesRights: false,
    mayRefuseActivity: false,
    informationAccurate: false,
    electronicSignature: false,
    guardianAuthority: false,
  })
  const [openDoc, setOpenDoc] = useState<string | null>(null)
  const [viewedDocs, setViewedDocs] = useState<Record<string, boolean>>({})
  const [signatureEmpty, setSignatureEmpty] = useState(true)
  const [signatureData, setSignatureData] = useState('')
  const [padKey, setPadKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successName, setSuccessName] = useState('')
  const [signedAt, setSignedAt] = useState('')
  const [signedDocs, setSignedDocs] = useState<string[]>([])

  const load = useCallback(
    async (nextLang?: WaiverLocale) => {
      if (preview) return
      if (!token) {
        setLoadError(true)
        return
      }
      const locale = nextLang ?? lang
      const res = await fetch(waiverSigningApiUrl(token, `?lang=${locale}`))
      if (!res.ok) {
        setLoadError(true)
        return
      }
      const data = await res.json()
      setSession(data.session)
      setDocs(data.documents ?? [])
      setLoadError(false)
    },
    [lang, preview, token]
  )

  useEffect(() => {
    if (preview) return
    void load()
  }, [load, preview])

  useEffect(() => {
    if (!preview) return
    if (previewSession) setSession(previewSession)
    if (previewDocuments) setDocs(previewDocuments)
    setLoadError(false)
  }, [preview, previewDocuments, previewSession])

  const activeDocs = useMemo(() => docs.filter((d) => d.requiredForSigning), [docs])
  const current = session?.participants.find((p) => p.id === participantId) ?? null

  function resetSensitiveState() {
    setForm(emptyForm)
    setDocAccept({})
    setAcks({
      readAgreements: false,
      inherentRisks: false,
      releasesRights: false,
      mayRefuseActivity: false,
      informationAccurate: false,
      electronicSignature: false,
      guardianAuthority: false,
    })
    setSignatureEmpty(true)
    setSignatureData('')
    setPadKey((k) => k + 1)
    setOpenDoc(null)
    setViewedDocs({})
    setError(null)
  }

  function startParticipant(id: string) {
    resetSensitiveState()
    setParticipantId(id)
    setStep('form')
  }

  async function submit() {
    if (preview) {
      setError(ui.previewOnly)
      return
    }
    if (!participantId || !token) return
    if (signatureEmpty || !signatureData) {
      setError(ui.signatureRequired)
      return
    }
    setSaving(true)
    setError(null)
    const res = await fetch(waiverSigningApiUrl(token), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId,
        language: lang,
        identity: {
          fullLegalName: form.fullLegalName,
          dateOfBirth: form.dateOfBirth,
          participantType: form.participantType,
          email: form.email,
          phone: form.phone,
          emergencyContactName: form.emergencyContactName,
          emergencyContactPhone: form.emergencyContactPhone,
        },
        documentAcceptances: docAccept,
        acknowledgments: acks,
        signaturePngBase64: signatureData,
        guardian:
          form.participantType === 'MINOR'
            ? {
                guardianFullLegalName: form.guardianFullLegalName,
                relationshipToMinor: form.relationshipToMinor,
                minorParticipantIds: [participantId],
              }
            : undefined,
      }),
    })
    setSaving(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || ui.errorGeneric)
      return
    }
    setSuccessName(data.result?.participantName || form.fullLegalName)
    setSignedAt(data.result?.signedAt || '')
    setSignedDocs(data.result?.documents || [])
    if (data.session) setSession(data.session)
    resetSensitiveState()
    setStep('success')
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{ui.invalidToken}</h1>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center text-muted-foreground">{ui.saving}</main>
    )
  }

  const remaining = session.participants.filter((p) => !p.signed)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-white">
        {preview ? (
          <div className="bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-950">
            {ui.previewOnly}
          </div>
        ) : null}
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4 sm:px-6">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">{ui.brand}</p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{session.tourName}</h1>
              <p className="text-sm text-muted-foreground">
                {ui.booking} {session.bookingNumber} · {ui.tourDate} {session.tourDate}
              </p>
            </div>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{ui.language}</span>
              <select
                className="app-input h-11 min-w-[160px] rounded-lg"
                value={lang}
                onChange={(e) => {
                  const next = e.target.value as WaiverLocale
                  setLang(next)
                  if (preview) {
                    onPreviewLangChange?.(next)
                    return
                  }
                  void load(next)
                }}
              >
                {WAIVER_LOCALES.map((code) => (
                  <option key={code} value={code}>
                    {WAIVER_LOCALE_LABELS[code]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="sticky top-0 z-10 rounded-lg bg-muted/80 px-3 py-2 text-sm backdrop-blur">
            {ui.waiversCompleted}: {session.completedCount} {ui.of} {session.requiredCount}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 md:py-12">
        {step === 'list' || step === 'success' ? (
          <section className="space-y-6">
            {step === 'success' ? (
              <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-semibold tracking-tight">{ui.successTitle}</h2>
                <p className="mt-2 text-lg">{successName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ui.booking} {session.bookingNumber}
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {signedDocs.map((code) => (
                    <li key={code} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600" />
                      {docs.find((d) => d.code === code)?.displayName || code}
                    </li>
                  ))}
                </ul>
                {signedAt ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {ui.signed}: {new Date(signedAt).toISOString().replace('T', ' ').slice(0, 19)} UTC
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">{ui.requiredAgreements}</h2>
              <ul className="mt-4 space-y-3">
                {docs.map((d) => (
                  <li key={d.code} className="flex items-start gap-3 text-sm">
                    <FileText className="mt-0.5 h-4 w-4" />
                    <div>
                      <p className="font-medium">{d.displayName}</p>
                      <p className="text-muted-foreground">{d.operatorName || (d.status === 'NOT_CONFIGURED' ? ui.notConfigured : '')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              {session.participants.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-4">
                  <div>
                    <p className="font-medium">{p.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.completedCount}/{p.requiredCount} {p.signed ? ui.ready : ui.pending}
                    </p>
                  </div>
                  {!p.signed ? (
                    <Button className="h-11 rounded-xl" onClick={() => startParticipant(p.id)}>
                      {ui.startWaiver}
                    </Button>
                  ) : (
                    <span className="text-sm text-emerald-700">{ui.signed}</span>
                  )}
                </div>
              ))}
            </div>

            {step === 'success' && remaining.length > 0 ? (
              <Button className="h-12 w-full rounded-xl" onClick={() => setStep('list')}>
                {ui.nextParticipant} ({session.completedCount} {ui.of} {session.requiredCount})
              </Button>
            ) : null}
            {remaining.length === 0 ? (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-center font-medium text-emerald-900">{ui.allComplete}</p>
            ) : null}
          </section>
        ) : null}

        {step !== 'list' && step !== 'success' ? (
          <section className="space-y-6">
            <button type="button" className="inline-flex items-center gap-1 text-sm text-muted-foreground" onClick={() => setStep('list')}>
              <ChevronLeft className="h-4 w-4" /> {ui.back}
            </button>
            <p className="text-sm text-muted-foreground">{current?.label}</p>

            {step === 'form' ? (
              <div className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">{ui.participantInfo}</h2>
                <Field label={ui.fullLegalName} value={form.fullLegalName} onChange={(v) => setForm({ ...form, fullLegalName: v })} />
                <Field label={ui.dateOfBirth} type="date" value={form.dateOfBirth} onChange={(v) => setForm({ ...form, dateOfBirth: v })} />
                <Field label={ui.tourDate} value={session.tourDate} readOnly />
                <Field label={ui.bookingNumber} value={session.bookingNumber} readOnly />
                <Field label={ui.email} type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                <Field label={ui.phone} type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                <Field label={ui.emergencyContactName} value={form.emergencyContactName} onChange={(v) => setForm({ ...form, emergencyContactName: v })} />
                <Field label={ui.emergencyContactPhone} type="tel" value={form.emergencyContactPhone} onChange={(v) => setForm({ ...form, emergencyContactPhone: v })} />
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">{ui.participantType}</legend>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="ptype" checked={form.participantType === 'ADULT'} onChange={() => setForm({ ...form, participantType: 'ADULT' })} />
                    {ui.adult}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="ptype" checked={form.participantType === 'MINOR'} onChange={() => setForm({ ...form, participantType: 'MINOR' })} />
                    {ui.minor}
                  </label>
                </fieldset>
                {form.participantType === 'MINOR' ? (
                  <>
                    <Field label={ui.guardianName} value={form.guardianFullLegalName} onChange={(v) => setForm({ ...form, guardianFullLegalName: v })} />
                    <Field label={ui.relationshipToMinor} value={form.relationshipToMinor} onChange={(v) => setForm({ ...form, relationshipToMinor: v })} />
                  </>
                ) : null}
                <Button
                  className="h-12 w-full rounded-xl"
                  onClick={() => {
                    if (!form.fullLegalName.trim() || !form.dateOfBirth || !form.emergencyContactName.trim() || !form.emergencyContactPhone.trim()) {
                      setError(ui.validationRequired)
                      return
                    }
                    setError(null)
                    setStep('docs')
                  }}
                >
                  {ui.continue}
                </Button>
              </div>
            ) : null}

            {step === 'docs' ? (
              <div className="space-y-4">
                {activeDocs.map((doc) => (
                  <div key={doc.code} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{doc.displayName}</p>
                        <p className="text-sm text-muted-foreground">{doc.operatorName}</p>
                      </div>
                      <Button type="button" variant="outline" className="h-11 rounded-lg" onClick={() => {
                        setOpenDoc(openDoc === doc.code ? null : doc.code)
                        setViewedDocs((prev) => ({ ...prev, [doc.code]: true }))
                        if (!preview && token) {
                          void fetch(waiverSigningApiUrl(token), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'view', documentCode: doc.code, participantId }),
                          })
                        }
                      }}>
                        {ui.viewDocument}
                      </Button>
                    </div>
                    {openDoc === doc.code && doc.content ? (
                      <div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">
                        <WaiverDocumentView
                          content={doc.content}
                          languageNotice={doc.code === 'ANTELOPE_CANYON_X' ? ui.languageNoticeCanyonX : ui.languageNoticeMania}
                          showGoverningNotice={lang !== 'en'}
                        />
                      </div>
                    ) : null}
                    <label className="mt-4 flex items-start gap-3 text-sm">
                      <Checkbox
                        checked={!!docAccept[doc.code]}
                        disabled={!viewedDocs[doc.code]}
                        onCheckedChange={(v) => {
                          if (!viewedDocs[doc.code]) return
                          setDocAccept({ ...docAccept, [doc.code]: v === true })
                        }}
                      />
                      <span>
                        {doc.code === 'ANTELOPE_CANYON_X' ? ui.acceptCanyonX : ui.acceptMania}
                        {!viewedDocs[doc.code] ? (
                          <span className="mt-1 block text-muted-foreground">{ui.viewBeforeAccept}</span>
                        ) : null}
                      </span>
                    </label>
                  </div>
                ))}
                <Button
                  className="h-12 w-full rounded-xl"
                  disabled={activeDocs.some((d) => !docAccept[d.code])}
                  onClick={() => setStep('acks')}
                >
                  {ui.continue}
                </Button>
              </div>
            ) : null}

            {step === 'acks' ? (
              <div className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">{ui.acknowledgmentsTitle}</h2>
                {(
                  [
                    ['readAgreements', ui.ackRead],
                    ['inherentRisks', ui.ackRisks],
                    ['releasesRights', ui.ackRelease],
                    ['mayRefuseActivity', ui.ackRefuse],
                    ['informationAccurate', ui.ackAccurate],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-start gap-3 text-sm">
                    <Checkbox checked={acks[key]} onCheckedChange={(v) => setAcks({ ...acks, [key]: v === true })} />
                    <span>{label}</span>
                  </label>
                ))}
                {form.participantType === 'MINOR' ? (
                  <label className="flex items-start gap-3 text-sm">
                    <Checkbox checked={acks.guardianAuthority} onCheckedChange={(v) => setAcks({ ...acks, guardianAuthority: v === true })} />
                    <span>{ui.guardianAck}</span>
                  </label>
                ) : null}
                <Button
                  className="h-12 w-full rounded-xl"
                  disabled={
                    !acks.readAgreements ||
                    !acks.inherentRisks ||
                    !acks.releasesRights ||
                    !acks.mayRefuseActivity ||
                    !acks.informationAccurate ||
                    (form.participantType === 'MINOR' && !acks.guardianAuthority)
                  }
                  onClick={() => setStep('sign')}
                >
                  {ui.continue}
                </Button>
              </div>
            ) : null}

            {step === 'sign' ? (
              <div className="space-y-5 rounded-2xl border border-border bg-white p-6 shadow-sm">
                <p className="text-sm leading-6 text-muted-foreground">{ui.eSignConsent}</p>
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={acks.electronicSignature}
                    onCheckedChange={(v) => setAcks({ ...acks, electronicSignature: v === true })}
                  />
                  <span>{ui.eSignAgree}</span>
                </label>
                <WaiverSignaturePad
                  key={padKey}
                  label={ui.signHere}
                  hint={ui.signatureHint}
                  clearLabel={ui.clear}
                  undoLabel={ui.undo}
                  onChange={(empty, dataUrl) => {
                    setSignatureEmpty(empty)
                    setSignatureData(dataUrl)
                  }}
                />
                <Button
                  className="h-12 w-full rounded-xl"
                  disabled={saving || signatureEmpty || !acks.electronicSignature}
                  onClick={() => void submit()}
                >
                  {saving ? ui.saving : ui.submit}
                </Button>
              </div>
            ) : null}

            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
          </section>
        ) : null}
      </main>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  readOnly,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  type?: string
  readOnly?: boolean
}) {
  const id = label.replace(/\s+/g, '-')
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="h-12 rounded-lg"
      />
    </div>
  )
}
