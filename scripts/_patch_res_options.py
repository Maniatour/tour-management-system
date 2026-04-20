from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "src/hooks/useReservationData.ts"
text = p.read_text(encoding="utf-8")

replacements = [
    (
        """  const [reservationPricingMap, setReservationPricingMap] = useState<Map<string, ReservationPricingMapValue>>(new Map())
  type TourMapRow = {""",
        """  const [reservationPricingMap, setReservationPricingMap] = useState<Map<string, ReservationPricingMapValue>>(new Map())
  const [reservationOptionsPresenceByReservationId, setReservationOptionsPresenceByReservationId] =
    useState<Map<string, boolean>>(new Map())
  type TourMapRow = {""",
    ),
    (
        """    return map
  }

  const TOUR_LIST_SELECT =""",
        """    return map
  }

  const fetchReservationOptionsPresenceMap = async (reservationIds: string[]) => {
    const map = new Map<string, boolean>()
    const unique = [...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
    for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
      const chunk = unique.slice(i, i + CHUNK_SIZE)
      for (const id of chunk) map.set(id, false)
      const { data, error } = await supabase
        .from('reservation_options')
        .select('reservation_id')
        .in('reservation_id', chunk)
      if (error) {
        console.warn('Error fetching reservation_options presence:', error)
        continue
      }
      const withRows = new Set(
        (data || []).map((r: { reservation_id: string }) => r.reservation_id).filter(Boolean)
      )
      for (const id of chunk) {
        map.set(id, withRows.has(id))
      }
    }
    return map
  }

  const TOUR_LIST_SELECT =""",
    ),
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

for i, (old, new) in enumerate(replacements):
    if old not in text:
        raise SystemExit(f"Block {i+1} not found")
    text = text.replace(old, new, 1)

p.write_text(text, encoding="utf-8")
print("useReservationData.ts patched")
