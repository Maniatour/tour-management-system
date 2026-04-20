from pathlib import Path

p = Path("src/components/reservation/ReservationCardItem.tsx")
s = p.read_text(encoding="utf-8")
s = s.replace("\\u00b7", "\u00b7")

old = """            {effectiveTourId && !hideAssignedTourUi && !tourInfoSimple ? (

              <span className="text-gray-500">{t('card.assignedTourMetaLoading')}</span>

            ) : tourInfoSimple ? ("""
new = """            {effectiveTourId && !hideAssignedTourUi && !tourInfoSimple ? (

              <span className="inline-flex items-center gap-1 min-w-0 text-gray-500">
                <button
                  type="button"
                  onClick={openTourDetail}
                  className="shrink-0 rounded p-0.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                  title={t('card.openTourPageTitle')}
                >
                  <Flag className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span>{t('card.assignedTourMetaLoading')}</span>
              </span>

            ) : tourInfoSimple ? ("""
if old not in s:
    raise SystemExit("loading branch not found")
s = s.replace(old, new, 1)

p.write_text(s, encoding="utf-8")
print("ok")
