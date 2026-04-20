# -*- coding: utf-8 -*-
from pathlib import Path
import re

p = Path("src/components/reservation/ReservationCardItem.tsx")
text = p.read_text(encoding="utf-8", errors="replace")

old_row2 = """          {/* Row 2: date + product name (products.name) with choice badges inline */}
          <div className=\"flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0\">
            <span className=\"shrink-0 text-sm font-medium text-gray-900\">{formatTourDateMmDdYyyy(reservation.tourDate)}</span>"""
new_row2 = """          {/* Row 2: date + product name (products.name) with choice badges inline */}
          <div className=\"flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0\">
            <span className=\"shrink-0 text-sm font-medium text-gray-900\">
              {hideAssignedTourUi ? (
                <span className=\"inline-flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-1.5\">
                  <span className=\"text-xs font-medium text-gray-600\">{t('card.registrationDateLabel')}</span>
                  <span className=\"tabular-nums\">{formatRegistrationDateForCard(reservation, locale)}</span>
                </span>
              ) : (
                formatTourDateMmDdYyyy(reservation.tourDate)
              )}
            </span>"""
if old_row2 not in text:
    raise SystemExit("old_row2 not found")
text = text.replace(old_row2, new_row2, 1)

old_row3_start = """          {/* Row 3 */}
          {(() => {
            const tourInfo = effectiveTourId && !hideAssignedTourUi ? tourInfoMap.get(effectiveTourId) : undefined"""
new_row3_start = """          {/* Row 3 */}
          {(() => {
            if (hideAssignedTourUi) {
              return (
                <div className=\"flex items-start justify-end gap-1 min-w-0\">
                  <button
                    type=\"button\"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSimpleActionsExpanded((x) => !x)
                    }}
                    className=\"shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100\"
                    title={t('card.simpleActionsToggle')}
                    aria-expanded={simpleActionsExpanded}
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${simpleActionsExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              )
            }
            const tourInfo = effectiveTourId ? tourInfoMap.get(effectiveTourId) : undefined"""
if old_row3_start not in text:
    raise SystemExit("old_row3_start not found")
text = text.replace(old_row3_start, new_row3_start, 1)

old_btn = """                  <button
                    type=\"button\"
                    disabled={!effectiveTourId || hideAssignedTourUi}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!effectiveTourId || hideAssignedTourUi) return"""
new_btn = """                  <button
                    type=\"button\"
                    disabled={!effectiveTourId}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!effectiveTourId) return"""
if old_btn not in text:
    raise SystemExit("old_btn not found")
text = text.replace(old_btn, new_btn, 1)

# Fix U+FFFD middle dots in simple row 3 (three occurrences)
text = re.sub(
    r'(<span className="max-w-\[4\.5rem\] truncate" title=\{g\}>\{g\}</span>\s*<span className="text-gray-300">)\uFFFD(</span>)',
    r"\1·\2",
    text,
    count=1,
)
text = re.sub(
    r'(<span className="max-w-\[4\.5rem\] truncate" title=\{a\}>\{a\}</span>\s*<span className="text-gray-300">)\uFFFD(</span>)',
    r"\1·\2",
    text,
    count=1,
)
text = re.sub(
    r'(<span className="max-w-\[5rem\] truncate" title=\{v\}>\{v\}</span>\s*<span className="text-gray-300">)\uFFFD(</span>)',
    r"\1·\2",
    text,
    count=1,
)

# Standard layout: tour + pickup block -> registration only when cancelled
old_std = """        {/* Tour date (tour_date) / pickup date-time (pickup_date & pickup_time) */}
        <div className=\"flex items-center flex-wrap gap-x-2 gap-y-1\">
          <Calendar className=\"h-4 w-4 text-gray-400 flex-shrink-0\" />
          <span className=\"text-sm text-gray-900\">{reservation.tourDate || '-'}</span>
          <span className=\"text-gray-400\">"""
# file may have · or U+FFFD after text-gray-400
idx = text.find("        {/* Tour date (tour_date) / pickup date-time (pickup_date & pickup_time) */}")
if idx < 0:
    raise SystemExit("standard tour block comment not found")
# find end of pickup hotel row closing div before Net Price
marker = "        {/* Net Price"
end_idx = text.find(marker, idx)
if end_idx < 0:
    raise SystemExit("Net Price marker not found")
block = text[idx:end_idx]
old_pickup_close = """        </div>

        {/* ?? ?? ?? */}
        <div className=\"flex items-center space-x-2\">
          <MapPin className=\"h-4 w-4 text-gray-400\" />
          <span 
            className={`text-sm hover:text-blue-600 hover:underline cursor-pointer ${
              reservation.pickUpHotel 
                ? 'text-gray-900' 
                : 'text-gray-500 italic'
            }`}
            onClick={(e) => onPickupHotelClick(reservation, e)}
          >
            {reservation.pickUpHotel 
              ? getPickupHotelDisplay(reservation.pickUpHotel, pickupHotels as any || [])
              : t('card.pickupHotelTbd')
            }
          </span>
        </div>

"""
if old_pickup_close not in block:
    raise SystemExit("pickup block tail not found in slice")
# More reliable: replace full standard section using regex on block
pattern = re.compile(
    r"        /\* Tour date \(tour_date\) / pickup date-time \(pickup_date & pickup_time\) \*/\s*"
    r"<div className=\"flex items-center flex-wrap gap-x-2 gap-y-1\">\s*"
    r"<Calendar className=\"h-4 w-4 text-gray-400 flex-shrink-0\" />\s*"
    r"<span className=\"text-sm text-gray-900\">\{reservation\.tourDate \|\| '-'\}</span>\s*"
    r"<span className=\"text-gray-400\">[^\n]*</span>\s*"
    r"<Clock className=\"h-4 w-4 text-gray-400 flex-shrink-0\" />\s*"
    r"\{pickupTimeLine\}\s*"
    r"</div>\s*"
    r"/\*[^\n]*\*/\s*"
    r"<div className=\"flex items-center space-x-2\">\s*"
    r"<MapPin className=\"h-4 w-4 text-gray-400\" />\s*"
    r"<span\s*"
    r"className=\{`text-sm hover:text-blue-600 hover:underline cursor-pointer \$\{\s*"
    r"reservation\.pickUpHotel\s*"
    r"\? 'text-gray-900'\s*"
    r": 'text-gray-500 italic'\s*"
    r"\}`\}\s*"
    r"onClick=\{\(e\) => onPickupHotelClick\(reservation, e\)\}\s*"
    r">\s*"
    r"\{reservation\.pickUpHotel\s*"
    r"\? getPickupHotelDisplay\(reservation\.pickUpHotel, pickupHotels as any \|\| \[\]\)\s*"
    r": t\('card\.pickupHotelTbd'\)\s*"
    r"\}\s*"
    r"</span>\s*"
    r"</div>",
    re.DOTALL,
)
new_std = """        {hideAssignedTourUi ? (
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
            <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-900">
              <span className="text-gray-600 font-medium">{t('card.registrationDateLabel')}</span>{' '}
              <span className="tabular-nums">{formatRegistrationDateForCard(reservation, locale)}</span>
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
              <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-900">{reservation.tourDate || '-'}</span>
              <span className="text-gray-400">·</span>
              <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
              {pickupTimeLine}
            </div>

            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span
                className={`text-sm hover:text-blue-600 hover:underline cursor-pointer ${
                  reservation.pickUpHotel
                    ? 'text-gray-900'
                    : 'text-gray-500 italic'
                }`}
                onClick={(e) => onPickupHotelClick(reservation, e)}
              >
                {reservation.pickUpHotel
                  ? getPickupHotelDisplay(reservation.pickUpHotel, pickupHotels as any || [])
                  : t('card.pickupHotelTbd')}
              </span>
            </div>
          </>
        )}

"""
m = pattern.search(text)
if not m:
    raise SystemExit("regex standard block not found")
text = text[: m.start()] + new_std + text[m.end() :]

p.write_text(text, encoding="utf-8")
print("patched", p)
