path = r"src/components/reservation/ReservationActionRequiredModal.tsx"
with open(path, "r", encoding="utf-8") as f:
    s = f.read()
needle = """  }, [isOpen, reservations])

  const hasTourAssigned = useCallback("""
insert = """  }, [isOpen, reservations])

  const handleReservationOptionsMutated = useCallback(
    (reservationId: string) => {
      void (async () => {
        const { data: optRows } = await supabase
          .from('reservation_options')
          .select('reservation_id, total_price, price, ea, status')
          .eq('reservation_id', reservationId)
        const has = (optRows?.length ?? 0) > 0
        setReservationOptionsPresenceByReservationId((prev) => {
          const next = new Map(prev)
          next.set(reservationId, has)
          return next
        })
        const chunkSums = aggregateReservationOptionSumsByReservationId(optRows ?? [])
        const sum = chunkSums.get(reservationId) ?? 0
        setReservationOptionSumByReservationId((prev) => {
          const next = new Map(prev)
          next.set(reservationId, sum)
          return next
        })
        await onRefreshReservationPricing?.([reservationId])
      })()
    },
    [onRefreshReservationPricing]
  )

  const hasTourAssigned = useCallback("""
if needle not in s:
    raise SystemExit("needle not found for insert block")
s = s.replace(needle, insert, 1)
needle2 = """                      linkedTourId={tourIdByReservationId?.get(reservation.id) ?? null}
                    />"""
insert2 = """                      linkedTourId={tourIdByReservationId?.get(reservation.id) ?? null}
                      reservationOptionsPresenceByReservationId={reservationOptionsPresenceByReservationId}
                      onReservationOptionsMutated={handleReservationOptionsMutated}
                    />"""
if needle2 not in s:
    raise SystemExit("needle2 not found")
s = s.replace(needle2, insert2, 1)
with open(path, "w", encoding="utf-8", newline="\n") as f:
    f.write(s)
print("patched ok")
