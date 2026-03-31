/** 예약(R), 투어(T), 고객(C)용 짧은 텍스트 ID — 접두사 1자 + 난수 접미사 */
const ALPHANUMERIC =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

export type EntityIdPrefix = 'R' | 'T' | 'C'

export function generatePrefixedEntityId(prefix: EntityIdPrefix, suffixLength = 8): string {
  const bytes = new Uint8Array(suffixLength)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < suffixLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  let suffix = ''
  for (let i = 0; i < suffixLength; i++) {
    suffix += ALPHANUMERIC[bytes[i]! % ALPHANUMERIC.length]
  }
  return `${prefix}${suffix}`
}

export const generateReservationId = () => generatePrefixedEntityId('R')
export const generateTourId = () => generatePrefixedEntityId('T')
export const generateCustomerId = () => generatePrefixedEntityId('C')
