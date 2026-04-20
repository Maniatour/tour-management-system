from pathlib import Path
p = Path("src/hooks/useReservationData.ts")
text = p.read_text(encoding="utf-8")
blocks = [
(
"""      const [firstPricingMap, firstToursById, firstToursByOverlap] = await Promise.all([
        fetchPricingMap(firstResIds),
        fetchToursMap(firstTourIds),
        fetchToursOverlappingReservationIds(firstResIds),
      ])

      setReservations(firstMapped)
      setReservationPricingMap(firstPricingMap)""",
"""      const [firstPricingMap, firstToursById, firstToursByOverlap, firstOptionsPresenceMap] = await Promise.all([
        fetchPricingMap(firstResIds),
        fetchToursMap(firstTourIds),
        fetchToursOverlappingReservationIds(firstResIds),
        fetchReservationOptionsPresenceMap(firstResIds),
      ])

      setReservations(firstMapped)
      setReservationPricingMap(firstPricingMap)
      setReservationOptionsPresenceByReservationId(firstOptionsPresenceMap)""",
),
(
"""      const [restPricingMap, restToursById, restToursByOverlap] = await Promise.all([
        fetchPricingMap(restResIds),
        fetchToursMap(restTourIds),
        fetchToursOverlappingReservationIds(restResIds),
      ])
      const totalCount = firstMapped.length + restMapped.length

      setReservations(prev => {
        const ids = new Set(prev.map((r) => r.id))
        const extra = restMapped.filter((r) => !ids.has(r.id))
        return extra.length === 0 ? prev : [...prev, ...extra]
      })
      setReservationPricingMap(prev => new Map([...prev, ...restPricingMap]))""",
"""      const [restPricingMap, restToursById, restToursByOverlap, restOptionsPresenceMap] = await Promise.all([
        fetchPricingMap(restResIds),
        fetchToursMap(restTourIds),
        fetchToursOverlappingReservationIds(restResIds),
        fetchReservationOptionsPresenceMap(restResIds),
      ])
      const totalCount = firstMapped.length + restMapped.length

      setReservations(prev => {
        const ids = new Set(prev.map((r) => r.id))
        const extra = restMapped.filter((r) => !ids.has(r.id))
        return extra.length === 0 ? prev : [...prev, ...extra]
      })
      setReservationPricingMap(prev => new Map([...prev, ...restPricingMap]))
      setReservationOptionsPresenceByReservationId(
        (prev) => new Map([...prev, ...restOptionsPresenceMap])
      )""",
),
(
"""  const refreshReservationPricingForIds = async (reservationIds: string[]) => {
    const unique = [...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
    if (unique.length === 0) return
    const map = await fetchPricingMap(unique)
    setReservationPricingMap((prev) => {
      const next = new Map(prev)
      map.forEach((v, k) => next.set(k, v))
      return next
    })
  }

  // 예약 데이터만 별도로 로드""",
"""  const refreshReservationPricingForIds = async (reservationIds: string[]) => {
    const unique = [...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
    if (unique.length === 0) return
    const map = await fetchPricingMap(unique)
    setReservationPricingMap((prev) => {
      const next = new Map(prev)
      map.forEach((v, k) => next.set(k, v))
      return next
    })
  }

  const refreshReservationOptionsPresenceForIds = async (reservationIds: string[]) => {
    const unique = [...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
    if (unique.length === 0) return
    const map = await fetchReservationOptionsPresenceMap(unique)
    setReservationOptionsPresenceByReservationId((prev) => {
      const next = new Map(prev)
      map.forEach((v, k) => next.set(k, v))
      return next
    })
  }

  // 예약 데이터만 별도로 로드""",
),
(
"""    reservationPricingMap,
    toursMap,""",
"""    reservationPricingMap,
    reservationOptionsPresenceByReservationId,
    toursMap,""",
),
(
"""    refreshReservationPricingForIds,
    refreshCustomers: refetchCustomers,""",
"""    refreshReservationPricingForIds,
    refreshReservationOptionsPresenceForIds,
    refreshCustomers: refetchCustomers,""",
),
]
for i, (o, n) in enumerate(blocks):
    if o not in text:
        raise SystemExit(f"missing block {i+1}")
    text = text.replace(o, n, 1)
p.write_text(text, encoding="utf-8")
print("promise and return ok")
