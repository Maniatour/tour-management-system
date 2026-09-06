/**
 * Windows / 로컬 dev 런처.
 * 기본: Turbopack (`npm run dev`). 배포 빌드는 package.json 의 `next build --webpack` 그대로.
 * 폴백: `npm run dev:webpack` — i18n HMR 이상하거나 open -4094 재발 시.
 */
const path = require('path')
const { spawn, execSync } = require('child_process')
const { ensureWinDevDistDir } = require('./win-dev-dist-dir.cjs')
require('./patch-tailwind-enoent.cjs')

function parseDevPort(argv) {
  const portIdx = argv.findIndex((arg) => arg === '-p' || arg === '--port')
  if (portIdx >= 0 && argv[portIdx + 1]) {
    const parsed = parseInt(argv[portIdx + 1], 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  const portArg = argv.find((arg) => /^--port=\d+$/.test(arg))
  if (portArg) {
    const parsed = parseInt(portArg.split('=')[1], 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  const fromEnv = parseInt(process.env.PORT || '3000', 10)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 3000
}

function parseBundler(argv) {
  const envBundler = String(process.env.NEXT_DEV_BUNDLER || '').toLowerCase()
  if (argv.includes('--webpack')) return 'webpack'
  if (argv.includes('--turbo') || argv.includes('--turbopack')) return 'turbo'
  if (envBundler === 'webpack') return 'webpack'
  if (envBundler === 'turbo' || envBundler === 'turbopack') return 'turbo'
  return 'turbo'
}

function stripLauncherFlags(argv) {
  return argv.filter(
    (arg) =>
      arg !== '--webpack' &&
      arg !== '--turbo' &&
      arg !== '--turbopack' &&
      arg !== '--'
  )
}

function sleepSync(ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    /* spin */
  }
}

function findListeningPids(port) {
  const selfPid = String(process.pid)
  const portSuffix = `:${port}`
  const pids = new Set()

  if (process.platform !== 'win32') {
    try {
      const out = execSync(`lsof -iTCP:${port} -sTCP:LISTEN -t`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      for (const pid of out.trim().split(/\s+/)) {
        if (pid && pid !== selfPid) pids.add(pid)
      }
    } catch {
      /* empty */
    }
    return [...pids]
  }

  try {
    const out = execSync('netstat -ano -p tcp', {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    for (const line of out.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue
      const parts = line.trim().split(/\s+/)
      if (parts.length < 5) continue
      const local = parts[1] || ''
      const colon = local.lastIndexOf(':')
      if (colon < 0) continue
      if (local.slice(colon) !== portSuffix) continue
      const pid = parts[parts.length - 1]
      if (/^\d+$/.test(pid) && pid !== '0' && pid !== selfPid) pids.add(pid)
    }
  } catch {
    /* empty */
  }
  return [...pids]
}

function isNodePid(pid) {
  if (process.platform !== 'win32') {
    try {
      const out = execSync(`ps -p ${pid} -o comm=`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      return /node/i.test(out)
    } catch {
      return false
    }
  }
  try {
    const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return /node\.exe/i.test(out)
  } catch {
    return false
  }
}

function killPid(pid) {
  if (process.platform !== 'win32') {
    try {
      process.kill(Number(pid), 'SIGTERM')
    } catch {
      /* empty */
    }
    return
  }
  try {
    execSync(`taskkill /PID ${pid} /F`, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore'],
    })
  } catch {
    /* empty */
  }
}

function freeDevPort(port) {
  if (process.env.NEXT_DEV_KILL_PORT === '0') return
  const pids = findListeningPids(port)
  if (pids.length === 0) return
  for (const pid of pids) {
    if (!isNodePid(pid)) {
      console.warn(`[tms dev] port ${port} in use by PID ${pid} (not node) — leave it`)
      continue
    }
    console.warn(`[tms dev] freeing port ${port} (node PID ${pid})`)
    killPid(pid)
  }
  sleepSync(400)
}

const root = path.join(__dirname, '..')
const rawArgv = process.argv.slice(2)
const bundler = parseBundler(rawArgv)
const extraArgs = stripLauncherFlags(rawArgv)
const devPort = parseDevPort(rawArgv)

process.env.PORT = String(devPort)
process.env.NEXT_DEV_BUNDLER = bundler

const usePolling =
  process.env.NEXT_DEV_POLLING === '1' ||
  (bundler === 'webpack' && process.env.NEXT_DEV_POLLING !== '0')

if (usePolling) {
  process.env.WATCHPACK_POLLING = 'true'
  process.env.CHOKIDAR_USEPOLLING = 'true'
} else {
  delete process.env.WATCHPACK_POLLING
  delete process.env.CHOKIDAR_USEPOLLING
  process.env.NEXT_DEV_POLLING = process.env.NEXT_DEV_POLLING || '0'
}

freeDevPort(devPort)

const winDistDir = ensureWinDevDistDir()
const nodeModules = path.join(root, 'node_modules')
const nextCli = path.join(nodeModules, 'next', 'dist', 'bin', 'next')
const fsRetryPreload = path.join(__dirname, 'fs-win-retry.cjs').replace(/\\/g, '/')
const requireFlag = `--require=${fsRetryPreload}`
const heapFlag = /max-old-space-size/i.test(process.env.NODE_OPTIONS || '')
  ? ''
  : '--max-old-space-size=8192'

const nodeOptions = [process.env.NODE_OPTIONS, heapFlag, requireFlag].filter(Boolean).join(' ').trim()

const webpackParallelism =
  process.env.NEXT_DEV_WEBPACK_PARALLELISM ||
  String(Math.min(4, Math.max(2, require('node:os').cpus()?.length || 2)))

const autoWarmup =
  process.env.NEXT_DEV_WARMUP === '1' ||
  (bundler === 'turbo' && process.env.NEXT_DEV_WARMUP !== '0')

const env = {
  ...process.env,
  PORT: String(devPort),
  NODE_PATH: nodeModules,
  NEXT_DEV_BUNDLER: bundler,
  NEXT_DEV_WEBPACK_PARALLELISM: webpackParallelism,
  NEXT_DEV_POLLING: usePolling ? '1' : '0',
  ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
}

if (process.platform === 'win32') {
  console.warn(
    `[tms dev] bundler: ${bundler}  distDir: ${winDistDir || '.next'}\n` +
      `  polling: ${usePolling ? 'on' : 'off'}  warmup: ${autoWarmup ? 'auto' : 'off'}\n` +
      (bundler === 'webpack'
        ? `  webpack parallelism: ${webpackParallelism} (override: NEXT_DEV_WEBPACK_PARALLELISM)\n`
        : '  배포 빌드는 next build --webpack 유지. i18n HMR / -4094 이면 npm run dev:webpack\n') +
      '  - 워밍업 끄기: NEXT_DEV_WARMUP=0 npm run dev\n' +
      '  - 포트 점유 유지: NEXT_DEV_KILL_PORT=0 npm run dev\n' +
      '  - polling 켜기: NEXT_DEV_POLLING=1 npm run dev\n' +
      '  - Defender 제외(관리자): npm run defender:exclude\n' +
      '  - 캐시 초기화 후 시작: npm run dev:win\n' +
      '  - 같은 localhost 탭이 많으면 Compiling 이 공유됨 — 탭·창은 최소화 권장\n' +
      '  - 완전 분리: npm run dev:3001'
  )
}

const nextArgs =
  bundler === 'webpack'
    ? [nextCli, 'dev', '--webpack', ...extraArgs]
    : [nextCli, 'dev', '--turbopack', ...extraArgs]

const child = spawn(process.execPath, nextArgs, {
  cwd: root,
  stdio: 'inherit',
  env,
  shell: false,
})

let warmupChild = null
if (autoWarmup) {
  warmupChild = spawn(process.execPath, [path.join(__dirname, 'dev-warmup.cjs')], {
    cwd: root,
    stdio: 'inherit',
    env,
    shell: false,
  })
}

function shutdownWarmup() {
  if (!warmupChild || warmupChild.killed) return
  try {
    warmupChild.kill('SIGTERM')
  } catch {
    /* empty */
  }
}

child.on('exit', (code, signal) => {
  shutdownWarmup()
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
