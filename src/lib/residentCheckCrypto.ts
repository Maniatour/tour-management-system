import { createHash, randomBytes } from 'crypto'

export function generateResidentCheckRawToken(): string {
  return randomBytes(24).toString('base64url')
}

export function hashResidentCheckToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}
