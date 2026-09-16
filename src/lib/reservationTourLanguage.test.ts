import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canonicalizeTourLanguage,
  formatTourLanguageAdminLabel,
  inferLegacyTourLanguage,
  pickTourLanguageFromPreferredList,
  reservationOpsLanguageBucket,
  resolveReservationTourLanguage,
} from '@/lib/reservationTourLanguage'

test('canonicalizeTourLanguage maps KR/JA aliases', () => {
  assert.equal(canonicalizeTourLanguage('KR'), 'ko')
  assert.equal(canonicalizeTourLanguage('한국어'), 'ko')
  assert.equal(canonicalizeTourLanguage('JA'), 'ja')
  assert.equal(canonicalizeTourLanguage('日本語'), 'ja')
  assert.equal(canonicalizeTourLanguage('Japanese (Live tour guide)'), 'ja')
  assert.equal(canonicalizeTourLanguage('English'), 'en')
  assert.equal(canonicalizeTourLanguage('es'), null)
})

test('inferLegacyTourLanguage keeps Japanese guests on English tours', () => {
  assert.equal(inferLegacyTourLanguage('KR'), 'ko')
  assert.equal(inferLegacyTourLanguage('ko'), 'ko')
  assert.equal(inferLegacyTourLanguage('JA'), 'en')
  assert.equal(inferLegacyTourLanguage('日本語'), 'en')
  assert.equal(inferLegacyTourLanguage('EN'), 'en')
  assert.equal(inferLegacyTourLanguage('ES'), 'en')
})

test('resolveReservationTourLanguage prefers explicit Japanese application', () => {
  assert.equal(
    resolveReservationTourLanguage({
      explicitTourLanguage: 'ja',
      customerLanguage: 'JA',
    }),
    'ja'
  )
  assert.equal(
    resolveReservationTourLanguage({
      preferredTourLanguages: ['en', 'ja'],
      customerLanguage: 'en',
    }),
    'ja'
  )
  assert.equal(
    resolveReservationTourLanguage({
      customerLanguage: 'JA',
    }),
    'en'
  )
})

test('formatTourLanguageAdminLabel adds Japanese-guest note on English tours', () => {
  assert.equal(formatTourLanguageAdminLabel('en', 'JA'), '영어 (일본인)')
  assert.equal(formatTourLanguageAdminLabel('en', 'JA', 'en'), 'English (Japanese guest)')
  assert.equal(formatTourLanguageAdminLabel('ja', 'JA'), '일본어')
  assert.equal(formatTourLanguageAdminLabel('ko', 'KR'), '한국어')
  assert.equal(formatTourLanguageAdminLabel('en', 'ES'), '영어')
})

test('reservationOpsLanguageBucket uses stored tour language first', () => {
  assert.equal(reservationOpsLanguageBucket('ja', 'EN'), 'ja')
  assert.equal(reservationOpsLanguageBucket(null, 'JA'), 'en')
  assert.equal(reservationOpsLanguageBucket(null, 'KR'), 'ko')
})

test('pickTourLanguageFromPreferredList prefers Japanese then Korean', () => {
  assert.equal(pickTourLanguageFromPreferredList(['en', 'ko']), 'ko')
  assert.equal(pickTourLanguageFromPreferredList(['en']), 'en')
  assert.equal(pickTourLanguageFromPreferredList([]), null)
})
