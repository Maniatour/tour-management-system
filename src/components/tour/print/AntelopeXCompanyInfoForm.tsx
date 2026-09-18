import type { ReactNode } from 'react'
import type { CanyonWaiverPrintGuest, CanyonWaiverPrintPacket } from '@/lib/canyonWaiverPrintForms'
import {
  ANTELOPE_X_ROWS_PER_PAGE,
  antelopeXDuplexPageNumber,
  antelopeXPrintName,
  padPrintRows,
} from '@/lib/canyonWaiverPrintForms'
import PrintSignatureImage from '@/components/tour/print/PrintSignatureImage'

function Chrome({ overlay, children }: { overlay: boolean; children: ReactNode }) {
  if (!overlay) return <>{children}</>
  return <span className="acx-chrome">{children}</span>
}

function UnderlineValue({
  value,
  minWidth,
  overlay = false,
}: {
  value: string
  minWidth?: string
  overlay?: boolean
}) {
  return (
    <span
      className={overlay ? 'acx-line acx-chrome-rule' : 'acx-line'}
      style={minWidth ? { minWidth } : undefined}
    >
      <span className={overlay ? 'acx-ink' : undefined}>{value || '\u00a0'}</span>
    </span>
  )
}

export default function AntelopeXCompanyInfoForm({
  packet,
  guests,
  pageIndex,
  pageCount: _pageCount,
  overlay = false,
}: {
  packet: CanyonWaiverPrintPacket
  guests: CanyonWaiverPrintGuest[]
  pageIndex: number
  pageCount: number
  overlay?: boolean
}) {
  const rows = padPrintRows(guests, ANTELOPE_X_ROWS_PER_PAGE)
  const start = pageIndex * ANTELOPE_X_ROWS_PER_PAGE
  const showCompanyBlock = pageIndex === 0

  return (
    <section
      className={overlay ? 'cwf-page acx-page acx-overlay-page' : 'cwf-page acx-page'}
      data-print-section={overlay ? 'antelope-x-overlay' : undefined}
      aria-label={
        overlay
          ? 'Antelope Canyon X official paper overlay'
          : 'Antelope Canyon X tour company information'
      }
    >
      {overlay ? (
        <p className="acx-preview-note">
          Preview on official Taadidiin paper — print fills company info, names, and signatures only
        </p>
      ) : null}
      <h1 className={overlay ? 'acx-title acx-chrome' : 'acx-title'}>
        TOUR COMPANY INFORMATION{pageIndex > 0 ? ' — CONTINUATION' : ''}
      </h1>

      {showCompanyBlock ? (
        <>
          <div className={overlay ? 'acx-field acx-overlay-company' : 'acx-field'}>
            <Chrome overlay={overlay}>COMPANY NAME: </Chrome>
            <UnderlineValue overlay={overlay} value={packet.companyName} minWidth="78%" />
          </div>
          <div className={overlay ? 'acx-row acx-overlay-datetime-top' : 'acx-row'}>
            <div className={overlay ? 'acx-field acx-overlay-date' : 'acx-field'}>
              <Chrome overlay={overlay}>DATE: </Chrome>
              <UnderlineValue overlay={overlay} value={packet.date} minWidth="55%" />
            </div>
            <div className={overlay ? 'acx-field acx-overlay-time' : 'acx-field'}>
              <Chrome overlay={overlay}>TOUR TIME: </Chrome>
              <UnderlineValue overlay={overlay} value={packet.tourTime} minWidth="55%" />
            </div>
          </div>
          <div className={overlay ? 'acx-row acx-overlay-counts' : 'acx-row'}>
            <div className={overlay ? 'acx-field acx-overlay-adults' : 'acx-field'}>
              <Chrome overlay={overlay}>TOTAL ADULT CUSTOMERS: </Chrome>
              <UnderlineValue overlay={overlay} value={String(packet.adultCount)} minWidth="40%" />
            </div>
            <div className={overlay ? 'acx-field acx-overlay-minors' : 'acx-field'}>
              <Chrome overlay={overlay}>TOTAL MINOR CUSTOMERS: </Chrome>
              <UnderlineValue overlay={overlay} value={String(packet.minorCount)} minWidth="40%" />
            </div>
          </div>
          <div className={overlay ? 'acx-field acx-overlay-guide-name' : 'acx-field'}>
            <Chrome overlay={overlay}>TOUR GUIDE NAME: </Chrome>
            <UnderlineValue overlay={overlay} value={packet.guideName} minWidth="72%" />
          </div>
          <div className="acx-field" style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <Chrome overlay={overlay}>TOUR GUIDE SIGNATURE:</Chrome>
            {packet.guideSignatureUrl ? (
              <span className={overlay ? 'acx-ink' : undefined}>
                <PrintSignatureImage
                  src={packet.guideSignatureUrl}
                  alt="Tour guide signature"
                  className="cwf-sig acx-guide-sig"
                />
              </span>
            ) : (
              <UnderlineValue overlay={overlay} value="" minWidth="62%" />
            )}
          </div>
          <div className={overlay ? 'acx-field acx-overlay-guide-phone' : 'acx-field'}>
            <Chrome overlay={overlay}>TOUR GUIDE PHONE: </Chrome>
            <UnderlineValue overlay={overlay} value={packet.guidePhone} minWidth="70%" />
          </div>
        </>
      ) : null}

      <p className={overlay ? 'acx-note acx-chrome' : 'acx-note'}>
        All participants must print their name and sign the Release of Liability Waiver before
        participating in the tour. Guardians of minors must print the minor&apos;s name and
        minor&apos;s age, and the guardian is responsible for signing on behalf of the minor child.
      </p>

      <div className={overlay ? 'acx-row acx-overlay-datetime-bottom' : 'acx-row'}>
        <div className={overlay ? 'acx-field acx-overlay-date' : 'acx-field'}>
          <Chrome overlay={overlay}>DATE: </Chrome>
          <UnderlineValue overlay={overlay} value={packet.date} minWidth="55%" />
        </div>
        <div className={overlay ? 'acx-field acx-overlay-time' : 'acx-field'}>
          <Chrome overlay={overlay}>TOUR TIME: </Chrome>
          <UnderlineValue overlay={overlay} value={packet.tourTime} minWidth="55%" />
        </div>
      </div>

      <ol className="acx-guest-list">
        {rows.map((guest, i) => (
          <li key={guest?.id ?? `empty-${start + i}`} className="acx-guest">
            <span className={overlay ? 'acx-idx acx-chrome' : 'acx-idx'}>{start + i + 1}.</span>
            <span className="acx-name">
              <Chrome overlay={overlay}>PRINT NAME:</Chrome>
              <span className={overlay ? 'acx-fill acx-chrome-rule' : 'acx-fill'}>
                <span className={overlay ? 'acx-ink' : undefined}>{antelopeXPrintName(guest)}</span>
              </span>
            </span>
            <span className="acx-sig">
              <Chrome overlay={overlay}>SIGNATURE:</Chrome>
              <span className={overlay ? 'acx-fill acx-chrome-rule acx-ink' : 'acx-fill'}>
                {guest?.signatureUrl ? (
                  <PrintSignatureImage
                    src={guest.signatureUrl}
                    alt={`Signature of ${guest.printName || 'guest'}`}
                  />
                ) : null}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className={overlay ? 'acx-page-num acx-chrome' : 'acx-page-num'}>
        {antelopeXDuplexPageNumber(pageIndex, 'form')}
      </div>
    </section>
  )
}
