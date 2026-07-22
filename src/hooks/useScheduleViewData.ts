'use client'

import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react'
import dayjs from 'dayjs'
import { supabase } from '@/lib/supabase'
import { getScheduleDisplayFetchDateRange } from '@/lib/scheduleDisplayCalendarMeta'
import {
  buildScheduleVehiclesForDisplayGrid,
  fetchScheduleGridCoreData,
  normalizeScheduleDisplayReservations,
  normalizeScheduleDisplayTours,
  SCHEDULE_ADMIN_UNASSIGNED_TOUR_SELECT,
  type ScheduleDisplayDataPayload,
  type ScheduleDisplayReservationChoice,
  type ScheduleDisplayTicketBookingRow,
} from '@/lib/scheduleDisplayData'
import { buildToursAssignmentBaseline } from '@/lib/guideAssignmentSchedule'
import {
  pickLatestEngineOilByVehicle,
  type ScheduleTourForOil,
  type VehicleMaintenanceOilRecord,
} from '@/lib/scheduleVehicleOilMaintenance'

const SCHEDULE_TOURS_PAGE_SIZE = 1000

export type ScheduleViewScheduleVehicle = {
  id: string
  label: string
  vehicle_category: string | null
  rental_start_date: string | null
  rental_end_date: string | null
  engine_oil_change_cycle: number | null
  recent_engine_oil_change_mileage: number | null
  recent_engine_oil_change_date: string | null
  current_mileage: number | null
}

type ScheduleVehicleRow = {
  id: string
  vehicle_number?: string | null
  nick?: string | null
  vehicle_category?: string | null
  status?: string | null
  rental_start_date?: string | null
  rental_end_date?: string | null
  engine_oil_change_cycle?: number | null
  recent_engine_oil_change_mileage?: number | null
  current_mileage?: number | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tour = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Product = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Team = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reservation = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Customer = any

type UseScheduleViewDataParams = {
  isDisplayMode: boolean
  displayDayCount: number
  currentDate: Date
  activeOperatorId: string
  usesPrefetchedScheduleData: boolean
  prefetchedScheduleData: ScheduleDisplayDataPayload | null
  onScheduleDisplayRefetch?: (() => Promise<void>) | undefined
  loadUserSettingsRef: MutableRefObject<() => Promise<void>>
  toursAssignmentBaselineRef: MutableRefObject<ReturnType<typeof buildToursAssignmentBaseline>>
  initialLoading: boolean
}

export function useScheduleViewData({
  isDisplayMode,
  displayDayCount,
  currentDate,
  activeOperatorId,
  usesPrefetchedScheduleData,
  prefetchedScheduleData,
  onScheduleDisplayRefetch,
  loadUserSettingsRef,
  toursAssignmentBaselineRef,
  initialLoading,
}: UseScheduleViewDataParams) {
  const firstDayOfMonth = useMemo(() => {
    if (isDisplayMode) return dayjs().startOf('day')
    return dayjs(currentDate).startOf('month')
  }, [currentDate, isDisplayMode])

  const lastDayOfMonth = useMemo(() => {
    if (isDisplayMode) return dayjs().startOf('day').add(Math.max(displayDayCount, 1) - 1, 'day')
    return dayjs(currentDate).endOf('month')
  }, [currentDate, isDisplayMode, displayDayCount])

  const [loading, setLoading] = useState(initialLoading)
  const [products, setProducts] = useState<Product[]>([])
  const [teamMembers, setTeamMembers] = useState<Team[]>([])
  const [inactiveTeamMembers, setInactiveTeamMembers] = useState<Team[]>([])
  const [tours, setTours] = useState<Tour[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [reservationChoices, setReservationChoices] = useState<ScheduleDisplayReservationChoice[]>(
    [],
  )
  const [ticketBookings, setTicketBookings] = useState<ScheduleDisplayTicketBookingRow[]>([])
  const [tourHotelBookings, setTourHotelBookings] = useState<
    Array<{
      id: string
      tour_id: string | null
      status: string | null
      rooms: number | null
      hotel?: string
      check_in_date?: string
    }>
  >([])
  const [offSchedules, setOffSchedules] = useState<
    Array<{ team_email: string; off_date: string; reason: string; status: string }>
  >([])
  const [dateNotes, setDateNotes] = useState<Record<string, { note: string; created_by?: string }>>(
    {},
  )
  const [scheduleVehicles, setScheduleVehicles] = useState<ScheduleViewScheduleVehicle[]>([])
  const [vehicleOilCalcTours, setVehicleOilCalcTours] = useState<ScheduleTourForOil[]>([])
  const [unassignedTours, setUnassignedTours] = useState<Tour[]>([])

  const fetchUnassignedTours = useCallback(async () => {
    try {
      const startDate = firstDayOfMonth.format('YYYY-MM-DD')
      const endDate = lastDayOfMonth.format('YYYY-MM-DD')
      const UNASSIGNED_PAGE = 1000
      let unassignedToursData: Tour[] = []
      for (let from = 0; ; from += UNASSIGNED_PAGE) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: batch, error } = await (supabase as any)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from('tours' as any)
          .select(SCHEDULE_ADMIN_UNASSIGNED_TOUR_SELECT)
          .eq('operator_id', activeOperatorId)
          .gte('tour_date', startDate)
          .lte('tour_date', endDate)
          .or('tour_guide_id.is.null,tour_guide_id.eq.,assistant_id.is.null,assistant_id.eq.')
          .order('tour_date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + UNASSIGNED_PAGE - 1)

        if (error) {
          console.error('Error fetching unassigned tours:', error)
          return
        }
        const b = (batch || []) as Tour[]
        unassignedToursData = unassignedToursData.concat(b)
        if (b.length < UNASSIGNED_PAGE) break
      }

      setUnassignedTours(unassignedToursData || [])
    } catch (error) {
      console.error('Error fetching unassigned tours:', error)
    }
  }, [firstDayOfMonth, lastDayOfMonth, activeOperatorId])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      const startDate = isDisplayMode
        ? getScheduleDisplayFetchDateRange(displayDayCount).start
        : firstDayOfMonth.subtract(3, 'day').format('YYYY-MM-DD')
      const endDate = isDisplayMode
        ? getScheduleDisplayFetchDateRange(displayDayCount).end
        : lastDayOfMonth.add(1, 'day').format('YYYY-MM-DD')
      const gridNoteStart = firstDayOfMonth.subtract(1, 'day').format('YYYY-MM-DD')
      const gridNoteEnd = lastDayOfMonth.add(1, 'day').format('YYYY-MM-DD')
      const monthStart = firstDayOfMonth.format('YYYY-MM-DD')
      const monthEnd = lastDayOfMonth.format('YYYY-MM-DD')

      const core = await fetchScheduleGridCoreData(supabase, {
        operatorId: activeOperatorId,
        rangeStart: startDate,
        rangeEnd: endDate,
        gridNoteStart,
        gridNoteEnd,
        monthStart,
        monthEnd,
        reservationSelect: isDisplayMode ? 'display' : 'admin',
      })

      const inactiveTeamData = isDisplayMode
        ? []
        : (
            await supabase.from('team').select('*').eq('is_active', false).order('name_ko')
          ).data || []

      const sortedVehicles = core.sortedVehiclesForMonth as ScheduleVehicleRow[]

      if (isDisplayMode) {
        setScheduleVehicles(buildScheduleVehiclesForDisplayGrid(sortedVehicles))
        setVehicleOilCalcTours([])
      } else {
        const companyVehicleIds = sortedVehicles
          .filter((v) => (v.vehicle_category || 'company').toString().toLowerCase() !== 'rental')
          .map((v) => v.id)

        const oilChangeByVehicleId = new Map<string, { date: string; mileage: number | null }>()
        if (companyVehicleIds.length > 0) {
          const MAINT_PAGE = 1000
          let maintenanceRows: VehicleMaintenanceOilRecord[] = []
          for (let from = 0; ; from += MAINT_PAGE) {
            const { data: batch, error: maintErr } = await supabase
              .from('vehicle_maintenance')
              .select('vehicle_id, maintenance_date, mileage, subcategory')
              .eq('operator_id', activeOperatorId)
              .in('vehicle_id', companyVehicleIds)
              .order('maintenance_date', { ascending: false })
              .order('mileage', { ascending: false })
              .range(from, from + MAINT_PAGE - 1)
            if (maintErr) {
              console.error('Error fetching vehicle maintenance for oil change:', maintErr)
              break
            }
            const b = (batch || []) as VehicleMaintenanceOilRecord[]
            maintenanceRows = maintenanceRows.concat(b)
            if (b.length < MAINT_PAGE) break
          }
          for (const [vehicleId, latest] of pickLatestEngineOilByVehicle(maintenanceRows)) {
            oilChangeByVehicleId.set(vehicleId, latest)
          }
        }

        setScheduleVehicles(
          sortedVehicles.map((v) => {
            const fromMaintenance = oilChangeByVehicleId.get(v.id)
            const fallbackMileage =
              v.recent_engine_oil_change_mileage != null && v.recent_engine_oil_change_mileage > 0
                ? v.recent_engine_oil_change_mileage
                : null
            return {
              id: v.id,
              label: ((v.nick && v.nick.trim()) || v.vehicle_number || v.id).toString().trim() || v.id,
              vehicle_category: v.vehicle_category ?? null,
              rental_start_date: v.rental_start_date ?? null,
              rental_end_date: v.rental_end_date ?? null,
              engine_oil_change_cycle: v.engine_oil_change_cycle ?? null,
              recent_engine_oil_change_mileage: fromMaintenance?.mileage ?? fallbackMileage,
              recent_engine_oil_change_date: fromMaintenance?.date ?? null,
              current_mileage:
                v.current_mileage != null && v.current_mileage > 0 ? v.current_mileage : null,
            }
          }),
        )

        if (companyVehicleIds.length > 0) {
          const oilHistStart = firstDayOfMonth.subtract(6, 'month').format('YYYY-MM-DD')
          const oilHistEnd = lastDayOfMonth.add(1, 'day').format('YYYY-MM-DD')
          let oilHistTours: ScheduleTourForOil[] = []
          for (let from = 0; ; from += SCHEDULE_TOURS_PAGE_SIZE) {
            const { data: batch, error: oilToursErr } = await supabase
              .from('tours')
              .select('id, tour_date, tour_status, tour_car_id, product_id, products(name)')
              .eq('operator_id', activeOperatorId)
              .gte('tour_date', oilHistStart)
              .lte('tour_date', oilHistEnd)
              .in('tour_car_id', companyVehicleIds)
              .order('tour_date', { ascending: true })
              .order('id', { ascending: true })
              .range(from, from + SCHEDULE_TOURS_PAGE_SIZE - 1)
            if (oilToursErr) {
              console.error('Error fetching vehicle oil calc tours:', oilToursErr)
              break
            }
            const b = (batch || []) as ScheduleTourForOil[]
            oilHistTours = oilHistTours.concat(b)
            if (b.length < SCHEDULE_TOURS_PAGE_SIZE) break
          }
          setVehicleOilCalcTours(oilHistTours)
        } else {
          setVehicleOilCalcTours([])
        }
      }

      setProducts(core.products as Product[])
      setTeamMembers(core.teamMembers)
      setInactiveTeamMembers(inactiveTeamData as Team[])
      setTours(normalizeScheduleDisplayTours(core.tours as Tour[]) as Tour[])
      toursAssignmentBaselineRef.current = buildToursAssignmentBaseline(core.tours as Tour[])
      setReservations(normalizeScheduleDisplayReservations(core.reservations as Reservation[]) as Reservation[])

      if (isDisplayMode) {
        setLoading(false)
      }

      setReservationChoices(core.reservationChoices)
      setCustomers(core.customers as Customer[])
      setTicketBookings(core.ticketBookings)
      setTourHotelBookings(core.tourHotelBookings)
      setOffSchedules(core.offSchedules)
      setDateNotes(core.dateNotes)

      try {
        await loadUserSettingsRef.current()
      } catch (settingsError) {
        console.warn('Failed to load user settings, continuing with default values:', settingsError)
      }

      if (!isDisplayMode) {
        await fetchUnassignedTours()
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [
    firstDayOfMonth,
    lastDayOfMonth,
    loadUserSettingsRef,
    fetchUnassignedTours,
    activeOperatorId,
    isDisplayMode,
    displayDayCount,
    toursAssignmentBaselineRef,
  ])

  const applyPrefetchedScheduleData = useCallback(
    (payload: ScheduleDisplayDataPayload) => {
      setProducts(payload.products as Product[])
      setTeamMembers(payload.teamMembers)
      setInactiveTeamMembers([])
      setTours(normalizeScheduleDisplayTours(payload.tours as Tour[]) as Tour[])
      toursAssignmentBaselineRef.current = buildToursAssignmentBaseline(payload.tours as Tour[])
      setReservations(
        normalizeScheduleDisplayReservations(payload.reservations as Reservation[]) as Reservation[],
      )
      setCustomers(payload.customers as Customer[])
      setReservationChoices(payload.reservationChoices)
      setTicketBookings(payload.ticketBookings as ScheduleDisplayTicketBookingRow[])
      setTourHotelBookings(payload.tourHotelBookings)
      setOffSchedules(payload.offSchedules)
      setDateNotes(payload.dateNotes)
      setScheduleVehicles(payload.scheduleVehicles)
      setVehicleOilCalcTours([])
    },
    [toursAssignmentBaselineRef],
  )

  const refreshScheduleData = useCallback(async () => {
    if (usesPrefetchedScheduleData && onScheduleDisplayRefetch) {
      await onScheduleDisplayRefetch()
      return
    }
    await fetchData()
  }, [usesPrefetchedScheduleData, onScheduleDisplayRefetch, fetchData])

  useEffect(() => {
    if (usesPrefetchedScheduleData && prefetchedScheduleData) {
      applyPrefetchedScheduleData(prefetchedScheduleData)
      setLoading(false)
      void (async () => {
        try {
          await loadUserSettingsRef.current()
        } catch (settingsError) {
          console.warn('Failed to load user settings:', settingsError)
        }
      })()
      return
    }
    fetchData()
  }, [
    fetchData,
    usesPrefetchedScheduleData,
    prefetchedScheduleData,
    applyPrefetchedScheduleData,
    loadUserSettingsRef,
  ])

  return {
    firstDayOfMonth,
    lastDayOfMonth,
    loading,
    setLoading,
    products,
    setProducts,
    teamMembers,
    setTeamMembers,
    inactiveTeamMembers,
    setInactiveTeamMembers,
    tours,
    setTours,
    reservations,
    setReservations,
    customers,
    setCustomers,
    reservationChoices,
    setReservationChoices,
    ticketBookings,
    setTicketBookings,
    tourHotelBookings,
    setTourHotelBookings,
    offSchedules,
    setOffSchedules,
    dateNotes,
    setDateNotes,
    scheduleVehicles,
    setScheduleVehicles,
    vehicleOilCalcTours,
    setVehicleOilCalcTours,
    unassignedTours,
    setUnassignedTours,
    fetchData,
    fetchUnassignedTours,
    refreshScheduleData,
    applyPrefetchedScheduleData,
  }
}
