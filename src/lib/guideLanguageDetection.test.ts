import assert from 'node:assert/strict'
import test from 'node:test'
import {
  convertLanguageCodeToLocale,
  doesGuideSupportLanguage,
  getGuideSupportedLocales,
  resolveGuideAppLocale,
  tryConvertLanguageCodeToLocale,
} from './guideLanguageDetection'

test('tryConvertLanguageCodeToLocale maps app locales and ignores ES/FR', () => {
  assert.equal(tryConvertLanguageCodeToLocale('KR'), 'ko')
  assert.equal(tryConvertLanguageCodeToLocale('JP'), 'ja')
  assert.equal(tryConvertLanguageCodeToLocale('en-US'), 'en')
  assert.equal(tryConvertLanguageCodeToLocale('ES'), null)
  assert.equal(tryConvertLanguageCodeToLocale('FR'), null)
  assert.equal(tryConvertLanguageCodeToLocale('DE'), null)
  assert.equal(tryConvertLanguageCodeToLocale('RU'), null)
})

test('convertLanguageCodeToLocale still defaults unknown codes to ko without treating ES as supported', () => {
  assert.equal(convertLanguageCodeToLocale('ES'), 'ko')
  assert.equal(convertLanguageCodeToLocale('FR'), 'ko')
  assert.equal(convertLanguageCodeToLocale('EN'), 'en')
})

test('doesGuideSupportLanguage does not count ES/FR as Korean', () => {
  const member = { languages: ['ES', 'FR'] }
  assert.equal(doesGuideSupportLanguage(member, 'ko'), false)
  assert.equal(doesGuideSupportLanguage(member, 'en'), false)
  assert.equal(doesGuideSupportLanguage(member, 'ja'), false)
})

test('getGuideSupportedLocales keeps English when mixed with Spanish', () => {
  assert.deepEqual(getGuideSupportedLocales({ languages: ['ES', 'EN'] }), ['en'])
  assert.deepEqual(getGuideSupportedLocales({ languages: ['KR', 'ES'] }), ['ko'])
})

test('resolveGuideAppLocale prefers header selection over team profile language', () => {
  const koreanGuide = { languages: ['KR'] }
  assert.equal(resolveGuideAppLocale(koreanGuide, 'guide@test.com', 'en'), 'en')
  assert.equal(resolveGuideAppLocale(koreanGuide, 'guide@test.com', 'ko'), 'ko')
  assert.equal(resolveGuideAppLocale(koreanGuide, 'guide@test.com', null), 'ko')
  assert.equal(resolveGuideAppLocale({ languages: ['EN'] }, 'guide@test.com', null), 'en')
  assert.equal(resolveGuideAppLocale({ languages: ['EN'] }, 'guide@test.com', 'ko'), 'ko')
})
