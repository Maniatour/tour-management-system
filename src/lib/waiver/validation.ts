import { z } from 'zod'
import { WAIVER_LOCALES, WAIVER_PARTICIPANT_TYPES } from '@/lib/waiver/types'

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

export const participantIdentitySchema = z.object({
  fullLegalName: z.string().trim().min(2).max(200),
  dateOfBirth: isoDate,
  participantType: z.enum(WAIVER_PARTICIPANT_TYPES),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  emergencyContactName: z.string().trim().min(2).max(200),
  emergencyContactPhone: z.string().trim().min(7).max(40),
})

export const minorGuardianSchema = z.object({
  guardianFullLegalName: z.string().trim().min(2).max(200),
  relationshipToMinor: z.string().trim().min(2).max(80),
  minorParticipantIds: z.array(z.string().uuid()).min(1),
})

export const startParticipantSchema = z.object({
  participantId: z.string().uuid(),
  language: z.enum(WAIVER_LOCALES),
})

export const viewDocumentSchema = z.object({
  participantId: z.string().uuid(),
  documentCode: z.enum(['LAS_VEGAS_MANIA', 'ANTELOPE_CANYON_X', 'LOWER_ANTELOPE']),
})

export const submitWaiverSchema = z.object({
  participantId: z.string().uuid(),
  language: z.enum(WAIVER_LOCALES),
  identity: participantIdentitySchema,
  documentAcceptances: z.record(z.string(), z.boolean()),
  acknowledgments: z.object({
    readAgreements: z.literal(true),
    inherentRisks: z.literal(true),
    releasesRights: z.literal(true),
    mayRefuseActivity: z.literal(true),
    informationAccurate: z.literal(true),
    electronicSignature: z.literal(true),
    guardianAuthority: z.boolean().optional(),
  }),
  signaturePngBase64: z.string().min(80).max(900_000),
  guardian: minorGuardianSchema.optional(),
})

export function isMinorAgeOnTourDate(dateOfBirth: string, tourDate: string): boolean {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`)
  const tour = new Date(`${tourDate}T00:00:00Z`)
  if (Number.isNaN(dob.getTime()) || Number.isNaN(tour.getTime())) return false
  let age = tour.getUTCFullYear() - dob.getUTCFullYear()
  const month = tour.getUTCMonth() - dob.getUTCMonth()
  if (month < 0 || (month === 0 && tour.getUTCDate() < dob.getUTCDate())) age -= 1
  return age < 18
}

export function parsePngBase64(raw: string): Buffer | null {
  const trimmed = raw.trim()
  const match = trimmed.match(/^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/i)
  const b64 = match ? match[1] : /^[A-Za-z0-9+/=\s]+$/.test(trimmed) ? trimmed : null
  if (!b64) return null
  try {
    const buf = Buffer.from(b64.replace(/\s+/g, ''), 'base64')
    if (buf.length < 80 || buf.length > 650_000) return null
    if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null
    return buf
  } catch {
    return null
  }
}
