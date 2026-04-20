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
assert old in text
text = text.replace(old, new, 1)
anchor = "  const tourIdByReservationId = useMemo(() => {"
insert = """  const handleReservationOptionsMutated = useCallback(
    (reservationId: string) => {
      void refreshReservationOptionsPresenceForIds([reservationId])
      void refreshReservationPricingForIds([reservationId])
    },
    [refreshReservationOptionsPresenceForIds, refreshReservationPricingForIds]
  )

"""
assert anchor in text
text = text.replace(anchor, insert + anchor, 1)
prop_block = """                        onOpenTourDetailModal={handleOpenTourDetailModal}
                      />"""
new_prop = """                        onOpenTourDetailModal={handleOpenTourDetailModal}
                        reservationOptionsPresenceByReservationId={hookReservationOptionsPresenceByReservationId}
                        onReservationOptionsMutated={handleReservationOptionsMutated}
                      />"""
assert prop_block in text
cnt = text.count(prop_block)
assert cnt == 2, cnt
text = text.replace(prop_block, new_prop, 2)
p.write_text(text, encoding="utf-8")
print("page ok")
