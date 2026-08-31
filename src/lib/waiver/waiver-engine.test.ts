import assert from 'node:assert/strict'
import test from 'node:test'
import { hashWaiverContent } from '@/lib/waiver/hash'
import { LAS_VEGAS_MANIA_WAIVER_EN } from '@/lib/waiver/documents/lasVegasMania/en'
import { LAS_VEGAS_MANIA_WAIVER_KO } from '@/lib/waiver/documents/lasVegasMania/ko'
import { LAS_VEGAS_MANIA_WAIVER_JA } from '@/lib/waiver/documents/lasVegasMania/ja'
import { LAS_VEGAS_MANIA_WAIVER_ZH } from '@/lib/waiver/documents/lasVegasMania/zh'
import { LAS_VEGAS_MANIA_WAIVER_ES } from '@/lib/waiver/documents/lasVegasMania/es'
import { LAS_VEGAS_MANIA_WAIVER_FR } from '@/lib/waiver/documents/lasVegasMania/fr'
import { LAS_VEGAS_MANIA_WAIVER_DE } from '@/lib/waiver/documents/lasVegasMania/de'
import { ANTELOPE_CANYON_X_WAIVER_EN } from '@/lib/waiver/documents/antelopeCanyonX/en'
import { WAIVER_DOCUMENT_CATALOG } from '@/lib/waiver/documents/catalog'
import { resolveRequiredWaivers, signingRequiredCodes } from '@/lib/waiver/requiredWaivers'
import { generateWaiverRawToken, hashWaiverToken, isPlausibleWaiverToken, waiverTokensEqual } from '@/lib/waiver/tokens'
import { isMinorAgeOnTourDate, parsePngBase64, submitWaiverSchema } from '@/lib/waiver/validation'
import { emptyWaiverContent, suggestedWaiverVersion, validateGoverningWaiverContent } from '@/lib/waiver/documentEditor'

test('Mania English source has sections 1-16', () => {
  assert.equal(LAS_VEGAS_MANIA_WAIVER_EN.sections.length, 16)
  assert.equal(LAS_VEGAS_MANIA_WAIVER_EN.sections[0].number, '1')
  assert.equal(LAS_VEGAS_MANIA_WAIVER_EN.sections[15].number, '16')
  assert.equal(LAS_VEGAS_MANIA_WAIVER_EN.version, '2026-08-30-v1')
})

test('all Mania translations keep sections 1-16', () => {
  for (const content of [
    LAS_VEGAS_MANIA_WAIVER_KO,
    LAS_VEGAS_MANIA_WAIVER_JA,
    LAS_VEGAS_MANIA_WAIVER_ZH,
    LAS_VEGAS_MANIA_WAIVER_ES,
    LAS_VEGAS_MANIA_WAIVER_FR,
    LAS_VEGAS_MANIA_WAIVER_DE,
  ]) {
    assert.equal(content.sections.length, 16)
    assert.equal(content.sections[0].number, '1')
    assert.equal(content.sections[15].number, '16')
    assert.equal(content.version, LAS_VEGAS_MANIA_WAIVER_EN.version)
  }
})

test('Korean translation keeps 16 sections and does not replace English hash', () => {
  assert.equal(LAS_VEGAS_MANIA_WAIVER_KO.sections.length, 16)
  const enHash = hashWaiverContent(LAS_VEGAS_MANIA_WAIVER_EN)
  const koHash = hashWaiverContent(LAS_VEGAS_MANIA_WAIVER_KO)
  assert.notEqual(enHash, koHash)
  assert.match(enHash, /^[a-f0-9]{64}$/)
})

test('historical hash stays stable for the frozen English snapshot', () => {
  const first = hashWaiverContent(LAS_VEGAS_MANIA_WAIVER_EN)
  const second = hashWaiverContent({ ...LAS_VEGAS_MANIA_WAIVER_EN })
  assert.equal(first, second)
})

test('Canyon X operator names are preserved', () => {
  assert.equal(ANTELOPE_CANYON_X_WAIVER_EN.operatorName, 'Taadidiin Tours L.L.C.')
  assert.match(ANTELOPE_CANYON_X_WAIVER_EN.title, /TAADIDIIN/)
  assert.equal(WAIVER_DOCUMENT_CATALOG.ANTELOPE_CANYON_X.sourceType, 'OFFICIAL_OPERATOR_FORM')
})

test('Lower Antelope is recognized but not configured', () => {
  assert.equal(WAIVER_DOCUMENT_CATALOG.LOWER_ANTELOPE.status, 'NOT_CONFIGURED')
  assert.equal(WAIVER_DOCUMENT_CATALOG.LOWER_ANTELOPE.contents.en, undefined)
  const resolved = resolveRequiredWaivers({
    productRequiredCodes: ['LAS_VEGAS_MANIA', 'LOWER_ANTELOPE'],
    canyonChoice: 'L',
  })
  const lower = resolved.find((r) => r.code === 'LOWER_ANTELOPE')
  assert.equal(lower?.requiredForSigning, false)
  assert.deepEqual(signingRequiredCodes(resolved), ['LAS_VEGAS_MANIA'])
})

test('Canyon X tour requires Mania + Canyon X', () => {
  const resolved = resolveRequiredWaivers({
    productRequiredCodes: ['LAS_VEGAS_MANIA'],
    canyonChoice: 'X',
  })
  assert.deepEqual(
    signingRequiredCodes(resolved).sort(),
    ['ANTELOPE_CANYON_X', 'LAS_VEGAS_MANIA']
  )
})

test('non-canyon tour requires Mania only', () => {
  const resolved = resolveRequiredWaivers({
    productRequiredCodes: ['LAS_VEGAS_MANIA'],
    productName: 'Las Vegas City Tour',
  })
  assert.deepEqual(signingRequiredCodes(resolved), ['LAS_VEGAS_MANIA'])
})

test('tokens are non-guessable and hashed', () => {
  const a = generateWaiverRawToken()
  const b = generateWaiverRawToken()
  assert.notEqual(a, b)
  assert.equal(isPlausibleWaiverToken(a), true)
  assert.equal(isPlausibleWaiverToken('1'), false)
  const ha = hashWaiverToken(a)
  assert.equal(ha.length, 64)
  assert.equal(waiverTokensEqual(ha, hashWaiverToken(a)), true)
})

test('minor age uses tour date', () => {
  assert.equal(isMinorAgeOnTourDate('2015-09-01', '2026-08-30'), true)
  assert.equal(isMinorAgeOnTourDate('2000-01-01', '2026-08-30'), false)
})

test('suggested waiver versions increment by date', () => {
  assert.equal(suggestedWaiverVersion(['2026-08-30-v1'], new Date('2026-08-30T20:00:00-07:00')), '2026-08-30-v2')
  const empty = emptyWaiverContent('LAS_VEGAS_MANIA', 'en')
  assert.equal(typeof validateGoverningWaiverContent(empty), 'string')
})

test('empty signature payload is rejected', () => {
  const parsed = submitWaiverSchema.safeParse({
    participantId: '00000000-0000-0000-0000-000000000000',
    language: 'en',
    identity: {
      fullLegalName: 'John Smith',
      dateOfBirth: '1990-01-01',
      participantType: 'ADULT',
      emergencyContactName: 'Jane',
      emergencyContactPhone: '7025550100',
    },
    documentAcceptances: { LAS_VEGAS_MANIA: true },
    acknowledgments: {
      readAgreements: true,
      inherentRisks: true,
      releasesRights: true,
      mayRefuseActivity: true,
      informationAccurate: true,
      electronicSignature: true,
    },
    signaturePngBase64: 'not-a-png',
  })
  assert.equal(parsed.success, false)
  assert.equal(parsePngBase64('hello'), null)
})
