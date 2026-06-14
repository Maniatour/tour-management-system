'use strict'

/**
 * Windows dev: Defender·webpack 동시 I/O로 fs open/read UNKNOWN(-4094)가 나면 재시도.
 * NODE_OPTIONS --require 로 선로드 — Module._load 로 next 번들 내부 require('fs')도 패치.
 */
const Module = require('node:module')
const fs = require('node:fs')

const RETRYABLE_CODES = new Set(['UNKNOWN', 'EBUSY', 'EPERM', 'EACCES'])
const RETRYABLE_ERRNOS = new Set([-4094, -4082, -4048])

function isRetryable(err) {
  if (!err || typeof err !== 'object') return false
  return RETRYABLE_CODES.has(err.code) || RETRYABLE_ERRNOS.has(err.errno)
}

function sleepSync(ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    /* spin */
  }
}

function withRetrySync(fn, args, maxAttempts = 60) {
  let lastErr
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return fn.apply(fs, args)
    } catch (err) {
      lastErr = err
      if (!isRetryable(err) || attempt === maxAttempts - 1) throw err
      sleepSync(80 + 60 * attempt)
    }
  }
  throw lastErr
}

function patchSync(name) {
  const original = fs[name].bind(fs)
  fs[name] = (...args) => withRetrySync(original, args)
}

patchSync('openSync')
patchSync('readFileSync')
patchSync('readSync')
patchSync('statSync')
patchSync('accessSync')
patchSync('copyFileSync')

const originalOpen = fs.open.bind(fs)
fs.open = (...args) => {
  const callback = args[args.length - 1]
  if (typeof callback !== 'function') {
    return withRetrySync(originalOpen, args)
  }

  const openArgs = args.slice(0, -1)
  let attempt = 0

  const run = () => {
    originalOpen(...openArgs, (err, fd) => {
      if (err && isRetryable(err) && attempt < 59) {
        attempt += 1
        setTimeout(run, 80 + 60 * attempt)
        return
      }
      callback(err, fd)
    })
  }

  run()
}

const originalReadFile = fs.readFile.bind(fs)
fs.readFile = (...args) => {
  const callback = args[args.length - 1]
  if (typeof callback !== 'function') {
    return withRetrySync(originalReadFile, args)
  }

  const readArgs = args.slice(0, -1)
  let attempt = 0

  const run = () => {
    originalReadFile(...readArgs, (err, data) => {
      if (err && isRetryable(err) && attempt < 59) {
        attempt += 1
        setTimeout(run, 80 + 60 * attempt)
        return
      }
      callback(err, data)
    })
  }

  run()
}

const fsp = require('node:fs/promises')

async function withRetryAsync(fn, args, maxAttempts = 60) {
  let lastErr
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn(...args)
    } catch (err) {
      lastErr = err
      if (!isRetryable(err) || attempt === maxAttempts - 1) throw err
      await new Promise((resolve) => setTimeout(resolve, 80 + 60 * attempt))
    }
  }
  throw lastErr
}

;['open', 'readFile', 'stat', 'access', 'copyFile'].forEach((method) => {
  const original = fsp[method].bind(fsp)
  fsp[method] = (...args) => withRetryAsync(original, args)
})

const originalLoad = Module._load
Module._load = function tmsPatchedLoad(request, parent, isMain) {
  if (request === 'fs' || request === 'node:fs') return fs
  if (request === 'fs/promises' || request === 'node:fs/promises') return fsp
  return originalLoad.call(this, request, parent, isMain)
}
