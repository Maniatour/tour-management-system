import assert from 'node:assert/strict'
import test from 'node:test'
import { guideOfflineShellPaths, guideShellCacheUrl, isGuideAppPathname } from './guideAppShell'

test('isGuideAppPathname matches guide routes only', () => {
  assert.equal(isGuideAppPathname('/ko/guide'), true)
  assert.equal(isGuideAppPathname('/ko/guide/'), true)
  assert.equal(isGuideAppPathname('/en/guide/tour-materials'), true)
  assert.equal(isGuideAppPathname('/zh-CN/guide/tours'), true)
  assert.equal(isGuideAppPathname('/ko/admin'), false)
  assert.equal(isGuideAppPathname('/ko/travel-guide'), false)
  assert.equal(isGuideAppPathname('/guide'), false)
})

test('guideShellCacheUrl keeps html and rsc apart', () => {
  const html = guideShellCacheUrl('https://kovegas.com/ko/guide/tour-materials?x=1#a', 'html')
  const rsc = guideShellCacheUrl('https://kovegas.com/ko/guide/tour-materials?x=1#a', 'rsc')
  assert.equal(html, 'https://kovegas.com/ko/guide/tour-materials?x=1')
  assert.equal(rsc, 'https://kovegas.com/ko/guide/tour-materials?x=1&__guide_sw=rsc')
  assert.notEqual(html, rsc)
})

test('guideOfflineShellPaths includes home and narration', () => {
  assert.deepEqual(guideOfflineShellPaths('ko'), ['/ko/guide', '/ko/guide/tour-materials'])
})
