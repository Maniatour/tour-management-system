import { LAS_VEGAS_MANIA_WAIVER_EN } from '@/lib/waiver/documents/lasVegasMania/en'
import {
  MANIA_WAIVER_ROWS_PER_PAGE,
  chunkPrintGuests,
  padPrintRows,
  type CanyonWaiverPrintGuest,
  type CanyonWaiverPrintPacket,
} from '@/lib/canyonWaiverPrintForms'

function SignatureImage({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="cwf-sig-ink">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="cwf-sig" />
    </span>
  )
}

function ManiaWaiverDocument({ date, guestCount }: { date: string; guestCount: number }) {
  const content = LAS_VEGAS_MANIA_WAIVER_EN
  return (
    <section className="mania-page" aria-label="Las Vegas Mania Tour waiver">
      <article className="mania-doc">
        <p className="mania-op">{content.operatorName}</p>
        <h2>{content.title}</h2>
        {content.subtitle ? <p>{content.subtitle}</p> : null}
        <p className="mania-meta">
          Tour date: {date || '________'} · Participants: {guestCount}
        </p>
        <p className="mania-warn">{content.warning}</p>
        {content.intro.map((p) => (
          <p key={p.slice(0, 48)}>{p}</p>
        ))}
        {content.sections.map((section) => (
          <section key={section.number}>
            <h3>
              {section.number}. {section.title}
            </h3>
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 40)}>{p}</p>
            ))}
            {section.bullets?.length ? (
              <ul>
                {section.bullets.map((b) => (
                  <li key={b.slice(0, 40)}>{b}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
        {content.closing.map((p) => (
          <p key={p.slice(0, 40)}>{p}</p>
        ))}
      </article>
    </section>
  )
}

function ManiaSignaturePage({
  packet,
  guests,
  pageIndex,
  pageCount,
}: {
  packet: CanyonWaiverPrintPacket
  guests: CanyonWaiverPrintGuest[]
  pageIndex: number
  pageCount: number
}) {
  const rows = padPrintRows(guests, MANIA_WAIVER_ROWS_PER_PAGE)
  const start = pageIndex * MANIA_WAIVER_ROWS_PER_PAGE
  return (
    <section className="mania-page mania-sig-page" aria-label="Mania tour waiver signatures">
      <h2>LAS VEGAS MANIA TOUR — PARTICIPANT SIGNATURES</h2>
      <p className="mania-meta">
        Date: {packet.date || '________'}
        {packet.tourTime ? ` · Time: ${packet.tourTime}` : ''} · Page {pageIndex + 1} of {pageCount}
      </p>
      <p className="mania-meta">
        I have read the Acknowledgment of Risk, Release of Liability, Waiver &amp; Assumption of
        Risk Agreement and agree to its terms.
      </p>
      <table className="mania-sig-table">
        <thead>
          <tr>
            <th />
            <th>Print Name</th>
            <th>Signature</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((guest, i) => (
            <tr key={guest?.id ?? `empty-${start + i}`}>
              <td className="mania-num">{start + i + 1}</td>
              <td className="mania-name">{guest?.printName || ''}</td>
              <td className="mania-sig">
                {guest?.printName && guest.signatureUrl ? (
                  <SignatureImage
                    src={guest.signatureUrl}
                    alt={`Signature of ${guest.printName}`}
                  />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default function ManiaTourWaiverPrintPages({
  packet,
  include,
  isFirstPrintedBlock,
}: {
  packet: CanyonWaiverPrintPacket | null
  include: boolean
  isFirstPrintedBlock: boolean
}) {
  if (!include || !packet) return null
  const chunks = chunkPrintGuests(packet.guests, MANIA_WAIVER_ROWS_PER_PAGE)
  return (
    <>
      <div className={isFirstPrintedBlock ? undefined : 'cwf-page-break'}>
        <ManiaWaiverDocument date={packet.date} guestCount={packet.guests.filter((g) => g.printName).length} />
      </div>
      {chunks.map((guests, pageIndex) => (
        <div key={`mania-sig-${pageIndex}`} className="cwf-page-break">
          <ManiaSignaturePage
            packet={packet}
            guests={guests}
            pageIndex={pageIndex}
            pageCount={chunks.length}
          />
        </div>
      ))}
    </>
  )
}
