import { haversineDistanceMeters, resolvePickupStopCoords } from '@/lib/geo'
import type { PickupHotel } from '@/utils/pickupHotelUtils'

export type AutoGroupMemberAssignment = {
  hotelId: string
  hotelName: string
  groupNumber: number
  isRepresentative: boolean
  distanceMeters: number | null
}

export type AutoGroupPreviewGroup = {
  groupIndex: number
  representative: PickupHotel
  members: AutoGroupMemberAssignment[]
}

export type AutoGroupPreview = {
  groups: AutoGroupPreviewGroup[]
  /** 좌표 없어 자동 배정 제외 */
  skippedNoLocation: PickupHotel[]
  /** 대표 호텔 중 좌표 없음 */
  repsWithoutLocation: PickupHotel[]
}

export function resolveHotelCoords(hotel: PickupHotel): { lat: number; lng: number } | null {
  return resolvePickupStopCoords(hotel.pin, hotel.link)
}

export function hotelHasLocation(hotel: PickupHotel): boolean {
  return resolveHotelCoords(hotel) !== null
}

/** 그룹 내 비대표 호텔 순번 → group_number (DECIMAL 3,1: N.1 ~ N.9) */
export function memberGroupNumber(mainGroup: number, rankZeroBased: number): number {
  const slot = Math.min(rankZeroBased + 1, 9)
  return Math.round((mainGroup + slot * 0.1) * 10) / 10
}

/**
 * 대표 호텔 N곳 기준, 좌표가 있는 나머지 호텔을 가장 가까운 대표 그룹에 배정.
 * representativeHotelIds 순서 = 그룹 1, 2, 3…
 */
export function computeAutoGroupPreview(
  allHotels: PickupHotel[],
  representativeHotelIds: string[]
): AutoGroupPreview {
  const repIdSet = new Set(representativeHotelIds)
  const reps: Array<{
    hotel: PickupHotel
    groupIndex: number
    lat: number
    lng: number
  }> = []
  const repsWithoutLocation: PickupHotel[] = []

  representativeHotelIds.forEach((id, index) => {
    const hotel = allHotels.find((h) => h.id === id)
    if (!hotel) return
    const coords = resolveHotelCoords(hotel)
    if (!coords) {
      repsWithoutLocation.push(hotel)
      return
    }
    reps.push({
      hotel,
      groupIndex: index + 1,
      lat: coords.lat,
      lng: coords.lng,
    })
  })

  const skippedNoLocation: PickupHotel[] = []
  const assignable: Array<{ hotel: PickupHotel; lat: number; lng: number }> = []

  for (const hotel of allHotels) {
    if (repIdSet.has(hotel.id)) continue
    const coords = resolveHotelCoords(hotel)
    if (coords) {
      assignable.push({ hotel, lat: coords.lat, lng: coords.lng })
    } else {
      skippedNoLocation.push(hotel)
    }
  }

  const buckets = new Map<number, Array<{ hotel: PickupHotel; dist: number }>>()
  for (const rep of reps) {
    buckets.set(rep.groupIndex, [])
  }

  if (reps.length > 0) {
    for (const item of assignable) {
      let best = reps[0]
      let bestDist = haversineDistanceMeters(item.lat, item.lng, best.lat, best.lng)
      for (let i = 1; i < reps.length; i++) {
        const d = haversineDistanceMeters(item.lat, item.lng, reps[i].lat, reps[i].lng)
        if (d < bestDist) {
          bestDist = d
          best = reps[i]
        }
      }
      buckets.get(best.groupIndex)!.push({ hotel: item.hotel, dist: bestDist })
    }
  }

  const groups: AutoGroupPreviewGroup[] = reps.map((rep) => {
    const rawMembers = buckets.get(rep.groupIndex) || []
    rawMembers.sort((a, b) => a.dist - b.dist)

    const members: AutoGroupMemberAssignment[] = [
      {
        hotelId: rep.hotel.id,
        hotelName: rep.hotel.hotel,
        groupNumber: rep.groupIndex,
        isRepresentative: true,
        distanceMeters: 0,
      },
      ...rawMembers.map((m, rank) => ({
        hotelId: m.hotel.id,
        hotelName: m.hotel.hotel,
        groupNumber: memberGroupNumber(rep.groupIndex, rank),
        isRepresentative: false,
        distanceMeters: Math.round(m.dist),
      })),
    ]

    return {
      groupIndex: rep.groupIndex,
      representative: rep.hotel,
      members,
    }
  })

  return { groups, skippedNoLocation, repsWithoutLocation }
}

export function flattenAutoGroupAssignments(preview: AutoGroupPreview): AutoGroupMemberAssignment[] {
  return preview.groups.flatMap((g) => g.members)
}
