'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

function devDistDirBaseName() {
  if (process.env.NEXT_DEV_DIST_DIR?.trim()) {
    return null
  }
  const port = String(process.env.PORT || '3000').trim() || '3000'
  // 기본 3000은 기존 경로 유지. 다른 포트는 캐시·HMR 간섭 방지용으로 분리.
  return port === '3000' ? 'tms-next-dev' : `tms-next-dev-${port}`
}

function resolveWinDevDistDirAbs() {
  if (process.env.NEXT_DEV_DIST_DIR?.trim()) {
    return path.resolve(process.env.NEXT_DEV_DIST_DIR.trim())
  }
  const base = devDistDirBaseName()
  if (process.env.NEXT_DEV_USE_HOMECACHE === '1') {
    return path.join(os.homedir(), '.cache', base ?? 'tms-next-dev')
  }
  // Defender·OneDrive가 node_modules는 덜 스캔하는 경우가 많음
  return path.join(process.cwd(), 'node_modules', '.cache', base ?? 'tms-next-dev')
}

/** Next.js distDir — 프로젝트 기준 상대 경로(절대 경로는 cwd와 이중 결합됨) */
function getWinDevDistDirRel() {
  const abs = resolveWinDevDistDirAbs()
  return path.relative(process.cwd(), abs) || abs
}

function ensureWinDevDistDir() {
  if (process.platform !== 'win32') return null
  const abs = resolveWinDevDistDirAbs()
  fs.mkdirSync(abs, { recursive: true })
  return abs
}

module.exports = {
  resolveWinDevDistDirAbs,
  getWinDevDistDirRel,
  ensureWinDevDistDir,
}
