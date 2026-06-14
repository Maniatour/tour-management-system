'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const root = path.join(__dirname, '..')

const cacheRoot = path.join(root, 'node_modules', '.cache')
const portCaches = fs.existsSync(cacheRoot)
  ? fs
      .readdirSync(cacheRoot)
      .filter((name) => name === 'tms-next-dev' || name.startsWith('tms-next-dev-'))
      .map((name) => path.join(cacheRoot, name))
  : []

const targets = [
  path.join(root, '.next'),
  path.join(root, '.tms-next-dev'),
  path.join(root, '..', '.tms-next-dev'),
  ...portCaches,
  path.join(os.homedir(), '.cache', 'tms-next-dev'),
  path.join(os.tmpdir(), 'tms-next-dev'),
  path.join(root, 'out'),
  path.join(root, 'dist'),
]

function removeDir(target) {
  if (!fs.existsSync(target)) return
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  console.log(`[clean:win] removed ${target}`)
}

for (const target of targets) {
  try {
    removeDir(target)
  } catch (err) {
    console.warn(`[clean:win] failed to remove ${target}:`, err.message)
  }
}
