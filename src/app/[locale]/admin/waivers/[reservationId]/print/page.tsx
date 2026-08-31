'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import WaiverDocumentView from '@/components/waiver/WaiverDocumentView'

type PrintPayload = {
  bookingNumber: string
  tourDate: string
  tourName: string
  canyonTime: string | null
  companyName: string
  adultCount: number
  minorCount: number
  guideName: string | null
  guidePhone: string | null
  guideSignatureUrl: string | null
  guideSignatureRequired: boolean
  required: string[]
  canyonXEnglish: Parameters<typeof WaiverDocumentView>[0]['content']
  generatedAt: string
  participants: Array<{
    id: string
    name: string
    type: string | null
    age: number | null
        mania: {
          waiverId: string
          version: string
          language: string
          signedAt: string
          signatureUrl: string | null
          snapshot: Parameters<typeof WaiverDocumentView>[0]['content'] | null
          translation: Parameters<typeof WaiverDocumentView>[0]['content'] | null
        } | null
    canyonX: { signatureUrl: string | null; signedAt: string } | null
    guardianName: string | null
    guardianSignatureUrl: string | null
  }>
}

export default function WaiverPrintPage() {
  const params = useParams()
  const search = useSearchParams()
  const reservationId = String(params.reservationId ?? '')
  const packet = search.get('packet') || 'full'
  const participantId = search.get('participantId')
  const [data, setData] = useState<PrintPayload | null>(null)

  useEffect(() => {
    void fetch(`/api/admin/waivers/print?reservationId=${encodeURIComponent(reservationId)}`)
      .then((r) => r.json())
      .then(setData)
  }, [reservationId])

  if (!data) return <p className="p-8">Loading print packet…</p>

  const showCover = packet === 'full'
  const showMania = packet === 'full' || packet === 'mania' || packet === 'individual'
  const showCanyon = (packet === 'full' || packet === 'canyon-x') && (data.required ?? []).includes('ANTELOPE_CANYON_X')
  const printParticipants =
    packet === 'individual' && participantId
      ? data.participants.filter((p) => p.id === participantId)
      : data.participants
  const maniaComplete = printParticipants.filter((p) => p.mania).length
  const canyonComplete = printParticipants.filter((p) => p.canyonX).length
  const overallReady =
    printParticipants.length > 0 &&
    printParticipants.every((p) => {
      const maniaOk = p.mania
      const canyonOk = !(data.required ?? []).includes('ANTELOPE_CANYON_X') || Boolean(p.canyonX)
      return maniaOk && canyonOk
    })
  const chunks: typeof data.participants[] = []
  for (let i = 0; i < printParticipants.length; i += 18) {
    chunks.push(printParticipants.slice(i, i + 18))
  }

  return (
    <div className="waiver-print bg-white text-black">
      <style>{`
        @page { size: letter; margin: 0.6in; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .page-break { break-after: page; page-break-after: always; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
          header, nav, aside, [data-admin-chrome] { display: none !important; }
        }
      `}</style>
      <div className="no-print sticky top-0 z-10 flex gap-2 border-b bg-white p-3">
        <button type="button" className="rounded-lg border px-4 py-2" onClick={() => window.print()}>
          Print
        </button>
      </div>

      {showCover ? (
        <section className="page-break mx-auto max-w-[8.5in] px-8 py-10">
          <p className="text-sm tracking-wide">LAS VEGAS MANIA TOUR</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">TOUR WAIVER PACKET</h1>
          <dl className="mt-8 space-y-2 text-base">
            <div>Tour: {data.tourName}</div>
            <div>Tour Date: {data.tourDate}</div>
            <div>Booking: {data.bookingNumber}</div>
            <div>Guests: {printParticipants.length}</div>
          </dl>
          <ul className="mt-6 space-y-1">
            <li>
              LAS VEGAS MANIA {maniaComplete} / {printParticipants.length}{' '}
              {maniaComplete === printParticipants.length && printParticipants.length > 0 ? 'COMPLETE' : 'INCOMPLETE'}
            </li>
            {(data.required ?? []).includes('ANTELOPE_CANYON_X') ? (
              <li>
                ANTELOPE CANYON X {canyonComplete} / {printParticipants.length}{' '}
                {canyonComplete === printParticipants.length && printParticipants.length > 0 ? 'COMPLETE' : 'INCOMPLETE'}
              </li>
            ) : null}
          </ul>
          <p className="mt-6 text-xl font-semibold">OVERALL: {overallReady ? 'READY FOR TOUR' : 'INCOMPLETE'}</p>
          <ul className="mt-6 space-y-1">
            {printParticipants.map((p) => (
              <li key={p.id}>
                {p.mania && (!(data.required ?? []).includes('ANTELOPE_CANYON_X') || p.canyonX) ? '✓' : '⚠'} {p.name}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm">Generated: {data.generatedAt}</p>
        </section>
      ) : null}

      {showMania
        ? printParticipants.map((p) =>
            p.mania?.snapshot ? (
              <section key={p.id} className="page-break mx-auto max-w-[8.5in] px-8 py-8">
                <WaiverDocumentView content={p.mania.snapshot} languageNotice="" showGoverningNotice={false} />
                {p.mania.translation ? (
                  <div className="mt-8 border-t pt-6">
                    <WaiverDocumentView content={p.mania.translation} languageNotice="" showGoverningNotice={false} />
                  </div>
                ) : null}
                <div className="avoid-break mt-8 border-t pt-4">
                  <p>Participant: {p.name}</p>
                  <p>Tour date: {data.tourDate}</p>
                  <p>Booking: {data.bookingNumber}</p>
                  {p.mania.signatureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.mania.signatureUrl} alt={`Signature of ${p.name}`} className="mt-3 h-20 border" />
                  ) : null}
                  <p className="mt-3 text-sm">
                    Electronically signed by {p.name} on {p.mania.signedAt}. Waiver {p.mania.waiverId} · {p.mania.version}
                  </p>
                </div>
              </section>
            ) : null
          )
        : null}

      {showCanyon ? (
        <>
          <section className="page-break mx-auto max-w-[8.5in] px-8 py-8">
            <WaiverDocumentView content={data.canyonXEnglish} languageNotice="" showGoverningNotice={false} />
          </section>
          {chunks.map((group, pageIdx) => (
            <section key={pageIdx} className="page-break mx-auto max-w-[8.5in] px-8 py-8">
              <h2 className="text-xl font-semibold">TOUR COMPANY INFORMATION{pageIdx > 0 ? ' — CONTINUATION' : ''}</h2>
              {pageIdx === 0 ? (
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div>COMPANY NAME: {data.companyName}</div>
                  <div>DATE: {data.tourDate}</div>
                  <div>TOUR TIME: {data.canyonTime || '—'}</div>
                  <div>TOTAL ADULT CUSTOMERS: {data.adultCount}</div>
                  <div>TOTAL MINOR CUSTOMERS: {data.minorCount}</div>
                  <div>TOUR GUIDE NAME: {data.guideName || '—'}</div>
                  <div>TOUR GUIDE PHONE: {data.guidePhone || '—'}</div>
                  <div>
                    TOUR GUIDE SIGNATURE:{' '}
                    {data.guideSignatureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={data.guideSignatureUrl} alt="Guide signature" className="inline h-10" />
                    ) : (
                      <span>Guide Signature Required</span>
                    )}
                  </div>
                </dl>
              ) : null}
              <p className="mt-4 text-sm">
                All participants must print their name and sign the Release of Liability Waiver before participating.
              </p>
              <ol className="mt-4 space-y-3">
                {group.map((p, i) => {
                  const line = pageIdx * 18 + i + 1
                  const isMinor = p.type === 'MINOR'
                  return (
                    <li key={p.id} className="avoid-break border-b pb-2 text-sm">
                      <div>
                        {line}. PRINT NAME:{' '}
                        {isMinor ? `${p.name.toUpperCase()} — AGE ${p.age ?? '—'}` : p.name.toUpperCase()}
                      </div>
                      <div className="mt-1 flex items-center gap-3">
                        SIGNATURE:{' '}
                        {isMinor ? (
                          p.guardianSignatureUrl || p.canyonX?.signatureUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.guardianSignatureUrl || p.canyonX?.signatureUrl || ''}
                              alt={`Guardian signature for ${p.name}`}
                              className="h-10"
                            />
                          ) : (
                            'Guardian signature pending'
                          )
                        ) : p.canyonX?.signatureUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.canyonX.signatureUrl} alt={`Signature of ${p.name}`} className="h-10" />
                        ) : (
                          'Pending'
                        )}
                      </div>
                      {isMinor ? <div className="text-xs">Guardian signed on behalf of minor{p.guardianName ? `: ${p.guardianName}` : ''}</div> : null}
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </>
      ) : null}
    </div>
  )
}
