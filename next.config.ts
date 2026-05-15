import { randomUUID } from 'node:crypto'
import withSerwistInit from '@serwist/next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const revision =
	process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_REF ?? randomUUID()

const withSerwist = withSerwistInit({
	swSrc: 'src/app/sw.ts',
	swDest: 'public/sw.js',
	register: false,
	// next dev는 정적 해시가 빌드와 달라 프리캐시 404(bad-precaching-response)가 난다.
	disable: process.env.NODE_ENV === 'development',
	additionalPrecacheEntries: [{ url: '/~offline', revision }],
})

const nextConfig = {
	// tesseract.js는 worker 스크립트 경로를 번들에 넣으면 __dirname 이 깨져 MODULE_NOT_FOUND 발생
	serverExternalPackages: ['tesseract.js', 'tesseract.js-core'],

	// 빌드 최적화 설정
	typescript: {
		ignoreBuildErrors: true // 빌드 시 TypeScript 에러 무시 (개발 시에만 체크)
	},
	
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
		// CSS preload 최적화
		NEXT_DISABLE_CSS_PRELOAD: 'true',
	},
	
	// 압축 최적화
	compress: true,
	
	// 실험적 기능 활성화 (optimizeCss는 dev에서 .next CSS 동시 I/O를 늘려 Windows -4094 유발 가능)
	experimental: {
		optimizeCss: process.env.NODE_ENV === 'production',
		scrollRestoration: true,
		esmExternals: true,
		optimizePackageImports: ['@supabase/supabase-js'],
		disableOptimizedLoading: false,
	},

	// webpack dev: 동시 컴파일 페이지 수 제한 → layout.js 등 청크 open 경합 완화
	onDemandEntries: {
		maxInactiveAge: 60 * 1000,
		pagesBufferLength: 2,
	},
	
	// 웹팩 최적화
	webpack: (config: any, { isServer, dev }: { isServer: boolean; dev: boolean }) => {
		// Windows: Defender·OneDrive 등과 Webpack 디스크 캐시(rename)·.next 산출물이 겹치면
		// PackFileCache ENOENT / open UNKNOWN(-4094) 등이 난다. 개발만 디스크 캐시 끔(컴파일은 다소 느려질 수 있음).
		if (dev && process.platform === 'win32') {
			// 메모리 캐시만으로도 -4094가 나면 디스크 Pack 캐시 완전 비활성화(느리지만 안정).
			// NEXT_DEV_WEBPACK_DISK_CACHE=1 이면 메모리 캐시만 사용.
			config.cache =
				process.env.NEXT_DEV_WEBPACK_DISK_CACHE === '1'
					? { type: 'memory' }
					: false
			config.parallelism = 1
			config.watchOptions = {
				...config.watchOptions,
				poll: 1000,
				aggregateTimeout: 600,
				ignored: ['**/node_modules/**', '**/.git/**'],
			}
		}

		// CSS preload 최적화
		if (!isServer) {
			// CSS 파일의 불필요한 preload 방지
			config.plugins = config.plugins || [];
			config.plugins.push(
				new (require('webpack')).DefinePlugin({
					'process.env.NEXT_DISABLE_CSS_PRELOAD': JSON.stringify('true'),
				})
			);
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
