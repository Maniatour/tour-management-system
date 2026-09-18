import { LAS_VEGAS_MANIA_WAIVER_EN } from '@/lib/waiver/documents/lasVegasMania/en'
import {
  MANIA_WAIVER_ROWS_PER_PAGE,
  chunkPrintGuests,
  padPrintRows,
  type CanyonWaiverPrintGuest,
  type CanyonWaiverPrintPacket,
} from '@/lib/canyonWaiverPrintForms'
import PrintSignatureImage from '@/components/tour/print/PrintSignatureImage'

const MANIA_WAIVER_FRONT_THROUGH = 8

function ManiaWaiverSections({
  sections,
}: {
  sections: (typeof LAS_VEGAS_MANIA_WAIVER_EN.sections)[number][]
}) {
  return (
    <>
      {sections.map((section) => (
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
    </>
  )
}

function ManiaWaiverFront({ date, guestCount }: { date: string; guestCount: number }) {
  const content = LAS_VEGAS_MANIA_WAIVER_EN
  return (
    <section
      className="mania-page mania-waiver-page"
      data-print-section="mania-waiver"
      aria-label="Las Vegas Mania Tour waiver front"
    >
      <p className="acx-sheet-side">Front · waiver</p>
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
        <ManiaWaiverSections sections={content.sections.slice(0, MANIA_WAIVER_FRONT_THROUGH)} />
      </article>
      <div className="mania-page-num">1</div>
    </section>
  )
}

function ManiaWaiverBack() {
  const content = LAS_VEGAS_MANIA_WAIVER_EN
  return (
    <section
      className="mania-page mania-waiver-page"
      data-print-section="mania-waiver"
      aria-label="Las Vegas Mania Tour waiver back"
    >
      <p className="acx-sheet-side">Back · waiver</p>
      <article className="mania-doc">
        <p className="mania-op">{content.operatorName}</p>
        <h2>{content.title} — CONTINUED</h2>
        <ManiaWaiverSections sections={content.sections.slice(MANIA_WAIVER_FRONT_THROUGH)} />
        {content.closing.map((p) => (
          <p key={p.slice(0, 40)}>{p}</p>
        ))}
      </article>
      <div className="mania-page-num">2</div>
    </section>
  )
}

export type ManiaSignatureSheetInfo = {
  tourDate: string
  vehicleLabel: string
  tourName: string
  peopleCount: number
  guideName: string
  driverName: string
  balanceLabel: string
}

function HeadValue({
  value,
  blank = false,
  className,
}: {
  value: string
  blank?: boolean
  className?: string
}) {
  return (
    <span
      className={[blank ? 'mania-sig-head-value mania-sig-blank' : 'mania-sig-head-value', className]
        .filter(Boolean)
        .join(' ')}
    >
      {value || '\u00a0'}
    </span>
  )
}

function ManiaSignaturePage({
  packet,
  guests,
  pageIndex,
  pageCount,
  sheet,
}: {
  packet: CanyonWaiverPrintPacket
  guests: CanyonWaiverPrintGuest[]
  pageIndex: number
  pageCount: number
  sheet: ManiaSignatureSheetInfo
}) {
  const rows = padPrintRows(guests, MANIA_WAIVER_ROWS_PER_PAGE)
  const start = pageIndex * MANIA_WAIVER_ROWS_PER_PAGE
  const peopleLabel = sheet.peopleCount > 0 ? String(sheet.peopleCount) : ''
  const tourAndPeople = [sheet.tourName, peopleLabel].filter(Boolean).join(' / ')
  return (
    <section
      className="mania-page mania-sig-page"
      data-print-section="mania-signatures"
      aria-label="Mania tour waiver signatures"
    >
      <div className="mania-sig-head">
        <div className="mania-sig-head-row">
          <span className="mania-sig-head-label">투어 날짜 (Date of Tour):</span>
          <HeadValue value={sheet.tourDate || packet.date} />
        </div>
        <div className="mania-sig-head-row">
          <span className="mania-sig-head-label">투어 차량 (Tour Vehicle) :</span>
          <HeadValue value={sheet.vehicleLabel} />
          <span className="mania-sig-mileage">
            종료 마일리지 (End Mileage) :
            <HeadValue value="" blank />
          </span>
        </div>
        <div className="mania-sig-head-row">
          <span className="mania-sig-head-label">
            투어 명 (Name of Tour) / 투어 인원 (Number of people):
          </span>
          <HeadValue value={tourAndPeople} />
        </div>
        <div className="mania-sig-head-row mania-sig-staff">
          <span className="mania-sig-head-label">투어 가이드 / 서명 (Tour Guide Name / Signature) :</span>
          <HeadValue value={sheet.guideName || packet.guideName} />
          <span className="mania-sig-sign-only" aria-label="Tour guide signature" />
        </div>
        <div className="mania-sig-head-row mania-sig-staff">
          <span className="mania-sig-head-label">투어 드라이버 / 서명(Tour Driver / Signature) :</span>
          <HeadValue value={sheet.driverName} />
          <span className="mania-sig-sign-only" aria-label="Tour driver signature" />
        </div>
        <div className="mania-sig-head-row mania-sig-balance">
          <span className="mania-sig-head-label">투어 잔금 (Balance) : $</span>
          <HeadValue
            value={sheet.balanceLabel.replace(/^\$/, '')}
            className="mania-sig-balance-amount"
          />
        </div>
      </div>

      <div className="mania-sign-list">
        {rows.map((guest, i) => (
          <div key={guest?.id ?? `empty-${start + i}`} className="mania-sign-row">
            <div className="mania-sign-field">
              <span className="mania-sign-label">NAME :</span>
              <span className="mania-sign-line">{guest?.printName || '\u00a0'}</span>
            </div>
            <div className="mania-sign-field">
              <span className="mania-sign-label">SIGN :</span>
              <span className="mania-sign-line">
                {guest?.printName && guest.signatureUrl ? (
                  <PrintSignatureImage
                    src={guest.signatureUrl}
                    alt={`Signature of ${guest.printName}`}
                  />
                ) : (
                  '\u00a0'
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
      {pageCount > 1 ? (
        <div className="mania-page-num">
          {pageIndex + 1} / {pageCount}
        </div>
      ) : null}
    </section>
  )
}

export default function ManiaTourWaiverPrintPages({
  packet,
  includeWaiver,
  includeSignatures,
  isFirstPrintedBlock,
  sheet,
}: {
  packet: CanyonWaiverPrintPacket | null
  includeWaiver: boolean
  includeSignatures: boolean
  isFirstPrintedBlock: boolean
  sheet: ManiaSignatureSheetInfo
}) {
  if (!packet) return null
  if (!includeWaiver && !includeSignatures) return null
  const chunks = chunkPrintGuests(packet.guests, MANIA_WAIVER_ROWS_PER_PAGE)
  const guestCount = packet.guests.filter((g) => g.printName).length
  const waiverStartClass = isFirstPrintedBlock ? undefined : 'cwf-page-break mania-duplex-start'

  return (
    <>
      {includeWaiver ? (
        <>
          <div className={waiverStartClass}>
            <ManiaWaiverFront date={packet.date} guestCount={guestCount} />
          </div>
          <div className="cwf-page-break">
            <ManiaWaiverBack />
          </div>
        </>
      ) : null}
      {includeSignatures
        ? chunks.map((guests, pageIndex) => (
            <div
              key={`mania-sig-${pageIndex}`}
              className={includeWaiver || !isFirstPrintedBlock || pageIndex > 0 ? 'cwf-page-break' : undefined}
            >
              <ManiaSignaturePage
                packet={packet}
                guests={guests}
                pageIndex={pageIndex}
                pageCount={chunks.length}
                sheet={sheet}
              />
            </div>
          ))
        : null}
    </>
  )
}
