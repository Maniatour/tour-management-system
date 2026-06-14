/**
 * Windows dev: distDir 이 프로젝트 밖(~/.cache/tms-next-dev)일 때도 next 패키지를 찾도록 NODE_PATH 설정.
 * Defender·IDE 와의 .next 경합(-4094) 회피용 distDir 과 MODULE_NOT_FOUND 를 함께 해결한다.
 */
const path = require('path')
const { spawn } = require('child_process')
const { ensureWinDevDistDir } = require('./win-dev-dist-dir.cjs')

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

const root = path.join(__dirname, '..')
const devPort = parseDevPort(process.argv.slice(2))
const winDistDir = ensureWinDevDistDir()
const nodeModules = path.join(root, 'node_modules')
const nextCli = path.join(nodeModules, 'next', 'dist', 'bin', 'next')
const fsRetryPreload = path.join(__dirname, 'fs-win-retry.cjs').replace(/\\/g, '/')
const requireFlag = `--require=${fsRetryPreload}`

const nodeOptions = [process.env.NODE_OPTIONS, requireFlag].filter(Boolean).join(' ').trim()

const env = {
  ...process.env,
  PORT: String(devPort),
  NODE_PATH: nodeModules,
  WATCHPACK_POLLING: 'true',
  CHOKIDAR_USEPOLLING: 'true',
  ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
}

const extraArgs = process.argv.slice(2)

if (process.platform === 'win32' && winDistDir) {
  console.warn(
    `[tms dev] Windows distDir: ${winDistDir}\n` +
      '  -4094(open) 발생 시 Windows Defender 제외: node_modules\\.cache\\tms-next-dev\n' +
      '    (관리자 PowerShell) Add-MpPreference -ExclusionPath "' +
      path.join(root, 'node_modules', '.cache', 'tms-next-dev') +
      '"\n' +
      '  - 프로젝트 .next 사용: NEXT_DEV_USE_PROJECT_DIST=1 npm run dev\n' +
      '  - open -4094 재발 시: NEXT_DEV_WIN_EMIT_SETTLE_MS=2500 npm run dev\n' +
      '  - 동시 탭·페이지 더 유지: NEXT_DEV_PAGES_BUFFER_LENGTH=32 npm run dev\n' +
      '  - 캐시 초기화 후 시작: npm run dev:win\n' +
      '  - 같은 localhost에 브라우저 창/탭이 여러 개면 한쪽 이동·새로고침 시 다른 창에도 Compiling 표시가 뜰 수 있음(HMR 공유)\n' +
      '  - 완전 분리: npm run dev:3001 (별도 포트·캐시)'
  )
}

const child = spawn(process.execPath, [nextCli, 'dev', '--webpack', ...extraArgs], {
  cwd: root,
  stdio: 'inherit',
  env,
  shell: false,
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
