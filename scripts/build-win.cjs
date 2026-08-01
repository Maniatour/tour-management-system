/**
 * Windows 로컬 저메모리 프로덕션 빌드.
 * type-check와 next build를 순차 실행해 프로세스별 힙 피크를 분산한다.
 */
const path = require('path')
const { spawn } = require('child_process')

const root = path.join(__dirname, '..')
const nextCli = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next')
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const extraArgs = process.argv.slice(2)
const skipTypeCheck = process.env.BUILD_SKIP_TYPECHECK === '1'

const nodeOptions = [
	process.env.NODE_OPTIONS,
	'--max-old-space-size=6144',
]
	.filter(Boolean)
	.join(' ')
	.trim()

const buildEnv = {
	...process.env,
	BUILD_LOW_MEMORY: '1',
	NODE_PATH: path.join(root, 'node_modules'),
	...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
}

function run(command, args, env) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: root,
			stdio: 'inherit',
			env,
			shell: false,
		})
		child.on('error', reject)
		child.on('exit', (code, signal) => {
			if (signal) {
				reject(new Error(`Process killed by signal ${signal}`))
				return
			}
			if (code !== 0) {
				reject(new Error(`Exit code ${code}`))
				return
			}
			resolve()
		})
	})
}

async function main() {
	if (!skipTypeCheck) {
		console.log('[tms build] Running type-check...')
		await run(npmCmd, ['run', 'type-check'], buildEnv)
	}

	console.log('[tms build] Running next build --webpack (low-memory mode)...')
	await run(process.execPath, [nextCli, 'build', '--webpack', ...extraArgs], buildEnv)
}

main().catch((error) => {
	console.error('[tms build] Failed:', error.message)
	process.exit(1)
})
