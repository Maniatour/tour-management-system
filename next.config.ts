import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig = {
	// 빌드 최적화 설정
	eslint: {
		ignoreDuringBuilds: true // 빌드 시 ESLint 검사 비활성화 (개발 시에만 체크)
	},
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
	
	// 실험적 기능 활성화
	experimental: {
		optimizeCss: true,
		scrollRestoration: true,
		esmExternals: true,
		// CSS preload 최적화
		optimizePackageImports: ['@supabase/supabase-js'],
		// CSS preload 경고 해결
		disableOptimizedLoading: false,
	},
	
	// 웹팩 최적화
	webpack: (config: any, { isServer, dev }: { isServer: boolean; dev: boolean }) => {
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

export default withNextIntl(nextConfig)
