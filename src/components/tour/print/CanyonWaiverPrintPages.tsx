import {
  LOWER_ANTELOPE_ROWS_PER_PAGE,
  chunkPrintGuests,
  type CanyonWaiverPrintPacket,
} from '@/lib/canyonWaiverPrintForms'
import LowerAntelopeReservationsForm from '@/components/tour/print/LowerAntelopeReservationsForm'
import ManiaTourWaiverPrintPages, {
  type ManiaSignatureSheetInfo,
} from '@/components/tour/print/ManiaTourWaiverPrintPages'
import AntelopeXDuplexSheets from '@/components/tour/print/AntelopeXDuplexSheets'
import AntelopeXOverlaySheets from '@/components/tour/print/AntelopeXOverlaySheets'

export default function CanyonWaiverPrintPages({
  mania = null,
  lower,
  canyonX,
  includeManiaWaiver = false,
  includeManiaSignatures = false,
  includeLower,
  includeX,
  includeXOverlay = false,
  isFirstPrintedBlock,
  maniaSheet,
}: {
  mania?: CanyonWaiverPrintPacket | null
  lower: CanyonWaiverPrintPacket | null
  canyonX: CanyonWaiverPrintPacket | null
  includeManiaWaiver?: boolean
  includeManiaSignatures?: boolean
  includeLower: boolean
  includeX: boolean
  includeXOverlay?: boolean
  isFirstPrintedBlock: boolean
  maniaSheet?: ManiaSignatureSheetInfo
}) {
  const maniaOn = (includeManiaWaiver || includeManiaSignatures) && Boolean(mania)
  const lowerChunks = includeLower && lower ? chunkPrintGuests(lower.guests, LOWER_ANTELOPE_ROWS_PER_PAGE) : []
  const xOn = includeX && Boolean(canyonX)
  const xOverlayOn = includeXOverlay && Boolean(canyonX)
  const lowerIsFirst = isFirstPrintedBlock && !maniaOn
  const xIsFirst = isFirstPrintedBlock && !maniaOn && lowerChunks.length === 0
  const xOverlayIsFirst = xIsFirst && !xOn
  const sheet = maniaSheet ?? {
    tourDate: mania?.date || '',
    vehicleLabel: '',
    tourName: '',
    peopleCount: (mania?.adultCount || 0) + (mania?.minorCount || 0),
    guideName: mania?.guideName || '',
    driverName: '',
    balanceLabel: '',
  }

  return (
    <>
      <ManiaTourWaiverPrintPages
        packet={mania}
        includeWaiver={includeManiaWaiver}
        includeSignatures={includeManiaSignatures}
        isFirstPrintedBlock={isFirstPrintedBlock}
        sheet={sheet}
      />
      {lower &&
        lowerChunks.map((guests, pageIndex) => (
          <div
            key={`lower-${pageIndex}`}
            className={!(lowerIsFirst && pageIndex === 0) ? 'cwf-page-break' : undefined}
          >
            <LowerAntelopeReservationsForm
              packet={lower}
              guests={guests}
              pageIndex={pageIndex}
              pageCount={lowerChunks.length}
            />
          </div>
        ))}
      {xOn && canyonX ? (
        <AntelopeXDuplexSheets packet={canyonX} isFirstPrintedBlock={xIsFirst} />
      ) : null}
      {xOverlayOn && canyonX ? (
        <AntelopeXOverlaySheets packet={canyonX} isFirstPrintedBlock={xOverlayIsFirst} />
      ) : null}
    </>
  )
}
