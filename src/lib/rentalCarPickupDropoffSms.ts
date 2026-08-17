export type RentalCarPickupDropoffSmsKind = 'pickup' | 'return' | 'airport_shuttle'

export type RentalCarPickupDropoffSmsParams = {
  recipientName: string
  vehicleLabel: string
  company?: string | null
  location?: string | null
  agreementNumber?: string | null
  startDate?: string | null
  endDate?: string | null
  lastUsers?: string | null
  returnCrew?: string | null
  returnVehicleLabel?: string | null
  continuingVehicleLabel?: string | null
}

function formatShortDate(raw?: string | null): string {
  const value = String(raw || '').trim()
  if (!value) return '—'
  const parts = value.split('-')
  if (parts.length !== 3) return value
  return `${Number(parts[1])}/${Number(parts[2])}`
}

export function buildRentalCarPickupSms(params: RentalCarPickupDropoffSmsParams): string {
  const lines = [
    `[Mania Tour] ${params.recipientName}님, 오늘 렌터카 픽업 담당입니다.`,
    `차량: ${params.vehicleLabel}`,
  ]
  if (params.company) lines.push(`회사: ${params.company}`)
  if (params.location) lines.push(`픽업 장소: ${params.location}`)
  if (params.agreementNumber) lines.push(`계약번호: ${params.agreementNumber}`)
  if (params.startDate || params.endDate) {
    lines.push(`기간: ${formatShortDate(params.startDate)} ~ ${formatShortDate(params.endDate)}`)
  }
  return lines.join('\n')
}

export function buildRentalCarReturnSms(params: RentalCarPickupDropoffSmsParams): string {
  const lines = [
    `[Mania Tour] ${params.recipientName}님, 오늘 렌터카 반납 부탁드립니다.`,
    `차량: ${params.vehicleLabel}`,
  ]
  if (params.location) lines.push(`반납 장소: ${params.location}`)
  if (params.lastUsers) lines.push(`마지막 사용자: ${params.lastUsers}`)
  if (params.company) lines.push(`회사: ${params.company}`)
  return lines.join('\n')
}

export function buildRentalCarAirportShuttleSms(params: RentalCarPickupDropoffSmsParams): string {
  const returnCrew = params.returnCrew || '반납 팀'
  const returnVehicle = params.returnVehicleLabel || params.vehicleLabel
  const lines = [
    `[Mania Tour] ${params.recipientName}님, 공항 렌터카에서 픽업 부탁드립니다.`,
    `${returnCrew}님이 ${returnVehicle}을(를) 반납합니다.`,
  ]
  if (params.location) lines.push(`장소: ${params.location}`)
  if (params.continuingVehicleLabel) {
    lines.push(`계속 사용 차량: ${params.continuingVehicleLabel}`)
  }
  lines.push(`반납 후 ${returnCrew}을(를) 태워 와 주세요.`)
  return lines.join('\n')
}

export function buildRentalCarPickupDropoffSms(
  kind: RentalCarPickupDropoffSmsKind,
  params: RentalCarPickupDropoffSmsParams
): string {
  if (kind === 'pickup') return buildRentalCarPickupSms(params)
  if (kind === 'return') return buildRentalCarReturnSms(params)
  return buildRentalCarAirportShuttleSms(params)
}
