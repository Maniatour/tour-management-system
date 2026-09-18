import {
  ANTELOPE_X_ROWS_PER_PAGE,
  chunkPrintGuests,
  type CanyonWaiverPrintPacket,
} from '@/lib/canyonWaiverPrintForms'
import AntelopeXCompanyInfoForm from '@/components/tour/print/AntelopeXCompanyInfoForm'

export default function AntelopeXOverlaySheets({
  packet,
  isFirstPrintedBlock,
}: {
  packet: CanyonWaiverPrintPacket
  isFirstPrintedBlock: boolean
}) {
  const chunks = chunkPrintGuests(packet.guests, ANTELOPE_X_ROWS_PER_PAGE)
  return (
    <>
      {chunks.map((guests, pageIndex) => (
        <div
          key={`x-overlay-${pageIndex}`}
          className={!(isFirstPrintedBlock && pageIndex === 0) ? 'cwf-page-break' : undefined}
        >
          <AntelopeXCompanyInfoForm
            overlay
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
