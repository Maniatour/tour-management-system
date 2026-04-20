from pathlib import Path
p = Path("src/components/reservation/ReservationActionRequiredModal.tsx")
text = p.read_text(encoding="utf-8")
repls = [
("""    if (!isOpen || reservations.length === 0) {
      setReservationIdsWithPayments(new Set())
      setPaymentRecordsByReservationId(new Map())
      setReservationOptionSumByReservationId(new Map())
      return
    }""",
"""    if (!isOpen || reservations.length === 0) {
      setReservationIdsWithPayments(new Set())
      setPaymentRecordsByReservationId(new Map())
      setReservationOptionSumByReservationId(new Map())
      setReservationOptionsPresenceByReservationId(new Map())
      return
    }"""),
("""      const mergedOptionSums = new Map<string, number>()
      const chunkSize = 200""",
"""      const mergedOptionSums = new Map<string, number>()
      const mergedOptionsPresence = new Map<string, boolean>()
      ids.forEach((id) => mergedOptionsPresence.set(id, false))
      const chunkSize = 200"""),
("""        const chunkSums = aggregateReservationOptionSumsByReservationId(optRows ?? [])
        for (const [rid, v] of chunkSums) {
          mergedOptionSums.set(rid, v)
        }
      }
      setReservationIdsWithPayments(set)""",
"""        const chunkSums = aggregateReservationOptionSumsByReservationId(optRows ?? [])
        for (const [rid, v] of chunkSums) {
          mergedOptionSums.set(rid, v)
        }
        for (const row of optRows ?? []) {
          const rid = (row as { reservation_id?: string }).reservation_id
          if (rid) mergedOptionsPresence.set(rid, true)
        }
      }
      setReservationIdsWithPayments(set)"""),
("""      setReservationOptionSumByReservationId(mergedOptionSums)
      setLoadingPayments(false)
    }
    load()
  }, [isOpen, reservations])

  const hasTourAssigned = useCallback(""",
"""      setReservationOptionSumByReservationId(mergedOptionSums)
      setReservationOptionsPresenceByReservationId(mergedOptionsPresence)
      setLoadingPayments(false)
    }
    load()
  }, [isOpen, reservations])

  const hasTourAssigned = useCallback("""),
]
for o,n in repls:
    assert o in text, "missing block"
    text = text.replace(o,n,1)
p.write_text(text, encoding="utf-8")
print("steps 2-5 ok")
