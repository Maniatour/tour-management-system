from pathlib import Path
p = Path("src/app/[locale]/admin/reservations/page.tsx")
text = p.read_text(encoding="utf-8")
old = """    reservationPricingMap: hookReservationPricingMap,
    toursMap: hookToursMap,
    loading,
    loadingProgress,
    reservationsAggregateReady,
    refreshReservations,
    refreshReservationPricingForIds,
    refreshCustomers
  } = useReservationData()"""
new = """    reservationPricingMap: hookReservationPricingMap,
    reservationOptionsPresenceByReservationId: hookReservationOptionsPresenceByReservationId,
    toursMap: hookToursMap,
    loading,
    loadingProgress,
    reservationsAggregateReady,
    refreshReservations,
    refreshReservationPricingForIds,
    refreshReservationOptionsPresenceForIds,
    refreshCustomers
  } = useReservationData()"""
if old not in text:
    raise SystemExit("hook block not found")
text = text.replace(old, new, 1)
p.write_text(text, encoding="utf-8")
print("hook ok")
