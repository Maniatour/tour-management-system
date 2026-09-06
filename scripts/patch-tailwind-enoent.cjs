'use strict'

/** Tailwind 3 on Windows: glob can list a file that was just deleted, then statSync throws ENOENT. */
const fs = require('node:fs')
const path = require('node:path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'tailwindcss',
  'lib',
  'lib',
  'content.js'
)

try {
  let source = fs.readFileSync(target, 'utf8')
  if (!source.includes("err.code === 'ENOENT'")) {
    const from = '        let modified = _fs.default.statSync(file).mtimeMs;'
    const to = `        let modified;
        try {
            modified = _fs.default.statSync(file).mtimeMs;
        } catch (err) {
            if (err && err.code === 'ENOENT') continue;
            throw err;
        }`
    if (source.includes(from)) {
      fs.writeFileSync(target, source.replace(from, to))
    }
  }
} catch {
  /* ignore */
}
