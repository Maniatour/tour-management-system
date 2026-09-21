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
import { LOWER_ANTELOPE_WAIVER_EN } from '@/lib/waiver/documents/lowerAntelope/en'
import { WAIVER_DOCUMENT_CATALOG } from '@/lib/waiver/documents/catalog'
import { resolveRequiredWaivers, signingRequiredCodes } from '@/lib/waiver/requiredWaivers'
import { generateWaiverRawToken, hashWaiverToken, isPlausibleWaiverToken, waiverTokensEqual, buildStableWaiverSigningToken, parseStableWaiverSigningToken } from '@/lib/waiver/tokens'
import { pickCanonicalWaiverInvitation } from '@/lib/waiver/invitationCanonical'
import { isMinorAgeOnTourDate, parsePngBase64, submitWaiverSchema } from '@/lib/waiver/validation'
import { emptyWaiverContent, suggestedWaiverVersion, validateGoverningWaiverContent } from '@/lib/waiver/documentEditor'
import { getWaiverUi } from '@/lib/waiver/ui'
import { buildWaiverEmailCtaHtml, isSampleReservationId } from '@/lib/waiver/emailCtaHtml'
import { isEnglishLegalName } from '@/lib/waiver/englishName'
import { isWaiverOnlineSigningClosed, isWaiverPrintReminderWindow, tomorrowTourDateYmd, waiverOnlineSigningClosesAt } from '@/lib/waiver/signingWindow'

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

test('Canyon X English matches the official Taadidiin paper form', () => {
  assert.equal(ANTELOPE_CANYON_X_WAIVER_EN.operatorName, 'Taadidiin Tours L.L.C.')
  assert.match(ANTELOPE_CANYON_X_WAIVER_EN.title, /TAADIDIIN TOURS/)
  assert.equal(ANTELOPE_CANYON_X_WAIVER_EN.warning, '')
  assert.equal(ANTELOPE_CANYON_X_WAIVER_EN.intro.length, 1)
  assert.match(ANTELOPE_CANYON_X_WAIVER_EN.intro[0], /Slot canyons: Antelope Canyon X and Cardiac Canyon/)
  assert.equal(ANTELOPE_CANYON_X_WAIVER_EN.sections.length, 5)
  assert.equal(ANTELOPE_CANYON_X_WAIVER_EN.sections[0].title, '')
  assert.match(ANTELOPE_CANYON_X_WAIVER_EN.closing[0], /WILLINGLY\/VOLUNTARILY/)
  assert.equal(WAIVER_DOCUMENT_CATALOG.ANTELOPE_CANYON_X.sourceType, 'OFFICIAL_OPERATOR_FORM')
})

test('Lower Antelope operator waiver is configured', () => {
  assert.equal(LOWER_ANTELOPE_WAIVER_EN.operatorName, "Dixie's Lower Antelope Canyon Tours")
  assert.match(LOWER_ANTELOPE_WAIVER_EN.title, /Lower Antelope Canyon/)
  assert.equal(LOWER_ANTELOPE_WAIVER_EN.sections.length, 8)
  assert.equal(LOWER_ANTELOPE_WAIVER_EN.version, '2026-09-08-v1')
  assert.equal(WAIVER_DOCUMENT_CATALOG.LOWER_ANTELOPE.sourceType, 'OFFICIAL_OPERATOR_FORM')
  assert.equal(WAIVER_DOCUMENT_CATALOG.LOWER_ANTELOPE.status, 'ACTIVE')
})

test('Lower Antelope tour requires Mania + Lower Antelope', () => {
  const resolved = resolveRequiredWaivers({
    productRequiredCodes: ['LAS_VEGAS_MANIA', 'LOWER_ANTELOPE'],
    canyonChoice: 'L',
  })
  const lower = resolved.find((r) => r.code === 'LOWER_ANTELOPE')
  assert.equal(lower?.requiredForSigning, true)
  assert.deepEqual(
    signingRequiredCodes(resolved).sort(),
    ['LAS_VEGAS_MANIA', 'LOWER_ANTELOPE']
  )
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

test('stable waiver signing token round-trips invitation id', () => {
  const invitationId = '11111111-2222-4333-8333-444444444444'
  const token = buildStableWaiverSigningToken(invitationId)
  assert.equal(isPlausibleWaiverToken(token), true)
  assert.equal(parseStableWaiverSigningToken(token), invitationId)
  assert.equal(parseStableWaiverSigningToken(token.slice(0, 40)), null)
})

test('waiver email CTA copy differs for request vs reminder', () => {
  const requestHtml = buildWaiverEmailCtaHtml({
    isEnglish: true,
    url: 'https://example.com/waiver/abc',
    mode: 'request',
  })
  const reminderHtml = buildWaiverEmailCtaHtml({
    isEnglish: true,
    url: 'https://example.com/waiver/abc',
    mode: 'reminder',
  })
  assert.match(requestHtml, /Please sign the required tour waiver/)
  assert.match(requestHtml, /Sign the waiver/)
  assert.match(requestHtml, /English letters only/)
  assert.match(requestHtml, /6:00 PM Las Vegas time/)
  assert.equal(/[\uAC00-\uD7A3]/.test(requestHtml), false)
  const koreanHtml = buildWaiverEmailCtaHtml({
    isEnglish: false,
    url: 'https://example.com/waiver/abc',
    mode: 'request',
  })
  assert.match(koreanHtml, /영문/)
  assert.match(koreanHtml, /오후 6시/)
  assert.match(koreanHtml, /면책 동의서 작성하기/)
  assert.match(reminderHtml, /Your waiver is still unsigned/)
  assert.match(requestHtml, /https:\/\/example.com\/waiver\/abc/)
  assert.equal(isSampleReservationId('00000000-0000-0000-0000-000000000001'), true)
  assert.equal(isSampleReservationId('11111111-2222-4333-8333-444444444444'), false)
})

test('English waiver UI copy has no Hangul and Korean UI has the same guidance', () => {
  const en = getWaiverUi('en')
  for (const value of Object.values(en)) {
    assert.equal(/[\uAC00-\uD7A3]/.test(value), false, value)
  }
  assert.match(en.fullLegalNameHint, /English letters only/)
  assert.match(en.signingDeadlineNote, /6:00 PM Las Vegas time/)
  const ko = getWaiverUi('ko')
  assert.match(ko.fullLegalNameHint, /영문/)
  assert.match(ko.signingDeadlineNote, /오후 6시/)
})

test('minor age uses tour date', () => {
  assert.equal(isMinorAgeOnTourDate('2015-09-01', '2026-08-30'), true)
  assert.equal(isMinorAgeOnTourDate('2000-01-01', '2026-08-30'), false)
})

test('legal names must be English letters', () => {
  assert.equal(isEnglishLegalName('Kim Minjun'), true)
  assert.equal(isEnglishLegalName("O'Brien"), true)
  assert.equal(isEnglishLegalName('Jean-Luc Picard'), true)
  assert.equal(isEnglishLegalName('김민준'), false)
  assert.equal(isEnglishLegalName('金敏俊'), false)
  assert.equal(isEnglishLegalName('Kim 민준'), false)
  const hangul = submitWaiverSchema.safeParse({
    participantId: '00000000-0000-0000-0000-000000000000',
    language: 'en',
    identity: {
      fullLegalName: '김민준',
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
    signaturePngBase64: 'a'.repeat(80),
  })
  assert.equal(hangul.success, false)
})

test('online waiver signing closes at 6pm Las Vegas time the day before the tour', () => {
  const tourDate = '2026-09-20'
  const closesAt = waiverOnlineSigningClosesAt(tourDate)
  assert.ok(closesAt)
  assert.equal(closesAt.toISOString(), new Date('2026-09-19T18:00:00-07:00').toISOString())
  assert.equal(isWaiverOnlineSigningClosed(tourDate, new Date('2026-09-19T17:59:59-07:00')), false)
  assert.equal(isWaiverOnlineSigningClosed(tourDate, new Date('2026-09-19T18:00:00-07:00')), true)
  assert.equal(isWaiverOnlineSigningClosed(tourDate, new Date('2026-09-20T08:00:00-07:00')), true)
})

test('staff waiver print reminder opens at 6:05 PM Las Vegas time', () => {
  assert.equal(isWaiverPrintReminderWindow(new Date('2026-09-19T18:04:00-07:00')), false)
  assert.equal(isWaiverPrintReminderWindow(new Date('2026-09-19T18:05:00-07:00')), true)
  assert.equal(isWaiverPrintReminderWindow(new Date('2026-09-19T21:00:00-07:00')), true)
  assert.equal(tomorrowTourDateYmd(new Date('2026-09-19T18:05:00-07:00')), '2026-09-20')
})

test('closed waiver email CTA asks guests to sign the printed form', () => {
  const html = buildWaiverEmailCtaHtml({
    isEnglish: true,
    url: 'https://example.com/waiver/abc',
    mode: 'request',
    signingClosed: true,
  })
  assert.match(html, /Online waiver signing is closed/)
  assert.match(html, /printed waiver/)
  assert.doesNotMatch(html, /Sign the waiver/)
})

test('suggested waiver versions increment by date', () => {
  assert.equal(suggestedWaiverVersion(['2026-08-30-v1'], new Date('2026-08-30T20:00:00-07:00')), '2026-08-30-v2')
  const empty = emptyWaiverContent('LAS_VEGAS_MANIA', 'en')
  assert.equal(typeof validateGoverningWaiverContent(empty), 'string')
})

test('canonical invitation prefers the link the guest opened', () => {
  const opened = pickCanonicalWaiverInvitation([
    {
      id: 'with-participants',
      createdAtMs: 1,
      hasParticipants: true,
      lastOpenedAtMs: null,
    },
    {
      id: 'emailed-and-opened',
      createdAtMs: 3,
      hasParticipants: false,
      lastOpenedAtMs: 100,
    },
    {
      id: 'unused-extra',
      createdAtMs: 2,
      hasParticipants: false,
      lastOpenedAtMs: null,
    },
  ])
  assert.equal(opened?.id, 'emailed-and-opened')
})

test('canonical invitation falls back to the participant-linked invite', () => {
  const picked = pickCanonicalWaiverInvitation([
    { id: 'extra', createdAtMs: 1, hasParticipants: false, lastOpenedAtMs: null },
    { id: 'participants', createdAtMs: 2, hasParticipants: true, lastOpenedAtMs: null },
  ])
  assert.equal(picked?.id, 'participants')
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
