'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import WaiverDocumentView from '@/components/waiver/WaiverDocumentView'
import AntelopeXCompanyInfoForm from '@/components/tour/print/AntelopeXCompanyInfoForm'
import {
  ANTELOPE_X_ROWS_PER_PAGE,
  chunkPrintGuests,
  formatCanyonFormDate,
  formatCanyonFormTime,
  getCanyonWaiverPrintStyles,
  pickEnglishPrintName,
  pickReusableWaiverSignature,
  type CanyonWaiverPrintGuest,
  type CanyonWaiverPrintPacket,
} from '@/lib/canyonWaiverPrintForms'

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
  const canyonXPacket: CanyonWaiverPrintPacket = {
    canyon: 'X',
    companyName: data.companyName,
    date: formatCanyonFormDate(data.tourDate),
    tourTime: formatCanyonFormTime(data.canyonTime),
    adultCount: data.adultCount,
    minorCount: data.minorCount,
    guideName: data.guideName || '',
    guidePhone: data.guidePhone || '',
    guideSignatureUrl: data.guideSignatureUrl,
    guests: printParticipants.map((p): CanyonWaiverPrintGuest => ({
      id: p.id,
      reservationId,
      printName: pickEnglishPrintName({ fullLegalName: p.name, name: p.name }),
      signatureUrl: pickReusableWaiverSignature({
        canyonSignatureUrl: p.canyonX?.signatureUrl ?? null,
        maniaSignatureUrl: p.mania?.signatureUrl ?? null,
        guardianSignatureUrl: p.guardianSignatureUrl,
        isMinor: p.type === 'MINOR',
      }),
      country: '',
      receiptNumber: data.bookingNumber,
      isMinor: p.type === 'MINOR',
      age: p.age,
      guardianName: p.guardianName,
    })),
  }
  const canyonXChunks = chunkPrintGuests(canyonXPacket.guests, ANTELOPE_X_ROWS_PER_PAGE)

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
        ${getCanyonWaiverPrintStyles()}
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
          {canyonXChunks.map((group, pageIdx) => (
            <section key={pageIdx} className="page-break mx-auto max-w-[8.5in]">
              <AntelopeXCompanyInfoForm
                packet={canyonXPacket}
                guests={group}
                pageIndex={pageIdx}
                pageCount={canyonXChunks.length}
              />
            </section>
          ))}
        </>
      ) : null}
    </div>
  )
}
