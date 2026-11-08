export const LOCATION_LIMITS = { floor: 60, roomNumber: 100, additionalDetails: 500 } as const

export type ReportLocation = {
  floor?: string | null
  roomNumber?: string | null
  additionalDetails?: string | null
  room?: string | null
}

export function locationSummary(location: ReportLocation) {
  return [location.floor, location.roomNumber || location.room, location.additionalDetails]
    .map(value => value?.trim()).filter(Boolean).join(" · ") || "Location details not recorded"
}
