import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import withSerwistInit from '@serwist/next'
import createNextIntlPlugin from 'next-intl/plugin'

const require = createRequire(import.meta.url)
const { getWinDevDistDirRel } = require('./scripts/win-dev-dist-dir.cjs') as {
	getWinDevDistDirRel: () => string
}

/** Windows dev: homedir/.cache 상대 distDir — IDE·OneDrive·TEMP 경합으로 open -4094 완화. NODE_PATH는 scripts/dev-win.cjs. */
const WIN_DEV_DIST_DIR = getWinDevDistDirRel()
const useWinDevDistDir =
	process.platform === 'win32' &&
	process.env.NODE_ENV !== 'production' &&
	process.env.NEXT_DEV_USE_PROJECT_DIST !== '1'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const revision =
	process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_REF ?? randomUUID()

/** dev 전용: 여러 탭·페이지 동시 사용 시 컴파일 캐시 유지 (NEXT_DEV_PAGES_BUFFER_LENGTH 등으로 조정) */
const DEV_PAGES_BUFFER_LENGTH = Math.max(
	2,
	parseInt(process.env.NEXT_DEV_PAGES_BUFFER_LENGTH ?? '24', 10) || 24
)
const DEV_MAX_INACTIVE_AGE_MS = Math.max(
	60_000,
	parseInt(process.env.NEXT_DEV_MAX_INACTIVE_AGE_MS ?? String(15 * 60 * 1000), 10) ||
		15 * 60 * 1000
)

const withSerwist = withSerwistInit({
	swSrc: 'src/app/sw.ts',
	swDest: 'public/sw.js',
	register: false,
	// next dev는 정적 해시가 빌드와 달라 프리캐시 404(bad-precaching-response)가 난다.
	disable: process.env.NODE_ENV === 'development',
	additionalPrecacheEntries: [{ url: '/~offline', revision }],
})

const nextConfig = {
	...(useWinDevDistDir ? { distDir: WIN_DEV_DIST_DIR } : {}),

	// Next 16 dev: `app/admin` 페이지와 `app/api/admin` API가 동시에 있으면 /api/admin/* 가 404 나는 경우가 있음
	// 동일하게 `app/admin` 과 `app/[locale]/admin` 이 함께 있으면 /ko/admin/* 하위 페이지가 전부 404 — MDGC 유틸은 app/mdgc-tools 로 분리
	// `[locale]/admin/team-chat` 페이지와 `app/api/team-chat/*` 가 같이 있으면 dev에서 일부 하위 API가 HTML 404가 나는 경우가 있음
	async rewrites() {
		return {
			beforeFiles: [
				{ source: '/api/admin/weather-status', destination: '/api/weather-status' },
				{ source: '/api/team-chat/unread-count', destination: '/api/team-chat-unread-count' },
			],
		}
	},

	// tesseract.js는 worker 스크립트 경로를 번들에 넣으면 __dirname 이 깨져 MODULE_NOT_FOUND 발생
	serverExternalPackages: ['tesseract.js', 'tesseract.js-core'],

	// 이미지 최적화
	images: {
		formats: ['image/webp', 'image/avif'] as ('image/webp' | 'image/avif')[],
		deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
		imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
		remotePatterns: [
			{
				protocol: 'https' as const,
				hostname: 'tyilwbytyuqrhxekjxcd.supabase.co',
				port: '',
				pathname: '/storage/v1/object/public/**',
			},
		],
		// 개발 환경에서 이미지 최적화 비활성화 (선택사항 - 에러 발생 시)
		// unoptimized: process.env.NODE_ENV === 'development',
	},
	
	// 환경 변수
	env: {
		NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
		NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
	},
	
	// 압축 최적화
	compress: true,
	
	// 실험적 기능 활성화 (optimizeCss는 dev에서 .next CSS 동시 I/O를 늘려 Windows -4094 유발 가능)
	experimental: {
		optimizeCss: process.env.NODE_ENV === 'production',
		scrollRestoration: true,
		esmExternals: true,
		// barrel import → 직접 import 변환으로 초기 번들·컴파일 부담 완화
		optimizePackageImports: [
			'@supabase/supabase-js',
			'lucide-react',
			'date-fns',
			'dayjs',
			'recharts',
			'react-icons',
			'react-hook-form',
			'@hello-pangea/dnd',
			'@radix-ui/react-alert-dialog',
			'@radix-ui/react-checkbox',
			'@radix-ui/react-dialog',
			'@radix-ui/react-label',
			'@radix-ui/react-select',
			'@radix-ui/react-slot',
			'@tiptap/react',
			'@tiptap/starter-kit',
			'@tiptap/extension-link',
			'@tiptap/extension-placeholder',
			'@tiptap/extension-underline',
		],
		disableOptimizedLoading: false,
	},

	// dev: 여러 admin 탭·페이지를 동시에 열어도 재컴파일 최소화 (prod 빌드에는 영향 없음)
	onDemandEntries: {
		maxInactiveAge: DEV_MAX_INACTIVE_AGE_MS,
		pagesBufferLength: DEV_PAGES_BUFFER_LENGTH,
	},
	
	// 웹팩 최적화
	webpack: (config: any, { isServer, dev }: { isServer: boolean; dev: boolean }) => {
		// Windows: Defender·OneDrive 등과 Webpack 디스크 캐시(rename)·.next 산출물이 겹치면
		// PackFileCache ENOENT / open UNKNOWN(-4094) 등이 난다. 개발만 디스크 캐시 끔(컴파일은 다소 느려질 수 있음).
		if (dev && process.platform === 'win32') {
			// 기본: 메모리 캐시(디스크 Pack 캐시 -4094 회피 + 재컴파일 속도).
			// -4094 지속 시 NEXT_DEV_WEBPACK_DISK_CACHE=0 으로 디스크 캐시 완전 비활성화.
			config.cache =
				process.env.NEXT_DEV_WEBPACK_DISK_CACHE === '0'
					? false
					: { type: 'memory' }
			config.parallelism = Math.max(
				1,
				parseInt(process.env.NEXT_DEV_WEBPACK_PARALLELISM ?? '2', 10) || 2
			)
			config.watchOptions = {
				...config.watchOptions,
				poll: 1000,
				aggregateTimeout: 600,
				ignored: [
					'**/node_modules/**',
					'**/.git/**',
					'**/.tms-next-dev/**',
					'**/.cache/tms-next-dev*/**',
					'**/node_modules/.cache/tms-next-dev*/**',
				],
			}
			// emit 후 대기: 기본 0ms(페이지 이동 속도). open -4094 재발 시 NEXT_DEV_WIN_EMIT_SETTLE_MS=2500
			const emitSettleMs = Math.max(
				0,
				parseInt(process.env.NEXT_DEV_WIN_EMIT_SETTLE_MS ?? '0', 10) || 0
			)
			if (emitSettleMs > 0) {
				config.plugins = config.plugins ?? []
				config.plugins.push({
					apply(compiler: { hooks: { afterEmit: { tapAsync: Function } } }) {
						compiler.hooks.afterEmit.tapAsync(
							'TmsWinEmitSettle',
							(_compilation: unknown, callback: () => void) => {
								setTimeout(callback, emitSettleMs)
							}
						)
					},
				})
			}
			// dev 클라이언트 청크 분할 최소화 → layout.js 등 동시 open(-4094) 완화
			if (!isServer) {
				config.optimization = {
					...config.optimization,
					splitChunks: false,
					runtimeChunk: false,
				}
			}
		}

		// 프로덕션 빌드 최적화
		if (!dev) {
			// 청크 분할 최적화
			if (!isServer) {
				config.optimization.splitChunks = {
					chunks: 'all',
					minSize: 20000,
					maxSize: 244000,
					cacheGroups: {
						default: {
							minChunks: 2,
							priority: -20,
							reuseExistingChunk: true,
						},
						vendor: {
							test: /[\\/]node_modules[\\/]/,
							name: 'vendors',
							priority: -10,
							chunks: 'all',
						},
						react: {
							test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
							name: 'react',
							priority: 20,
							chunks: 'all',
						},
						supabase: {
							test: /[\\/]node_modules[\\/]@supabase[\\/]/,
							name: 'supabase',
							priority: 15,
							chunks: 'all',
						},
						lucide: {
							test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
							name: 'lucide',
							priority: 12,
							chunks: 'all',
						},
						recharts: {
							test: /[\\/]node_modules[\\/]recharts[\\/]/,
							name: 'recharts',
							priority: 12,
							chunks: 'all',
						},
						tiptap: {
							test: /[\\/]node_modules[\\/]@tiptap[\\/]/,
							name: 'tiptap',
							priority: 12,
							chunks: 'all',
						},
						styles: {
							name: 'styles',
							test: /\.(css|scss|sass)$/,
							chunks: 'all',
							enforce: true,
							priority: 10,
						},
					},
				}
			}
			
			// 번들 분석기 활성화 (선택사항)
			if (process.env.ANALYZE === 'true') {
				const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
				config.plugins.push(
					new BundleAnalyzerPlugin({
						analyzerMode: 'static',
						openAnalyzer: false,
					})
				)
			}
		}
		
		// 모듈 해상도 최적화
		config.resolve.alias = {
			...config.resolve.alias,
			'@': require('path').resolve(__dirname, 'src'),
		}
		
		return config
	}
}

export default withSerwist(withNextIntl(nextConfig))
