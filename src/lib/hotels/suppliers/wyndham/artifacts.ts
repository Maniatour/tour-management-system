import fs from 'node:fs/promises'
import path from 'node:path'

const ARTIFACTS_ROOT =
  process.env.WYNDHAM_ARTIFACTS_DIR ||
  path.join(process.cwd(), 'automation', 'wyndham', 'artifacts')

export type WyndhamArtifactMeta = {
  dir: string
  screenshotPath?: string
  logPath: string
}

/**
 * Persist screenshots + logs when Wyndham automation fails or needs manual help.
 */
export async function createWyndhamArtifactDir(
  label: string
): Promise<WyndhamArtifactMeta> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = path.join(ARTIFACTS_ROOT, `${stamp}-${sanitize(label)}`)
  await fs.mkdir(dir, { recursive: true })
  const logPath = path.join(dir, 'automation.log')
  await fs.writeFile(logPath, `Wyndham artifact started: ${label}\n`, 'utf8')
  return { dir, logPath }
}

export async function appendWyndhamLog(
  meta: WyndhamArtifactMeta,
  message: string
): Promise<void> {
  const line = `[${new Date().toISOString()}] ${message}\n`
  await fs.appendFile(meta.logPath, line, 'utf8')
}

export async function saveWyndhamScreenshot(
  meta: WyndhamArtifactMeta,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: { screenshot: (opts: any) => Promise<Buffer> },
  name = 'failure.png'
): Promise<string> {
  const screenshotPath = path.join(meta.dir, name)
  await page.screenshot({ path: screenshotPath, fullPage: true })
  meta.screenshotPath = screenshotPath
  await appendWyndhamLog(meta, `Screenshot saved: ${screenshotPath}`)
  return screenshotPath
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 64)
}
