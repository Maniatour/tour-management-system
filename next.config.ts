import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig = {
	eslint: {
		ignoreDuringBuilds: true
	},
	typescript: {
		ignoreBuildErrors: true
	},
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'tyilwbytyuqrhxekjxcd.supabase.co',
				port: '',
				pathname: '/storage/v1/object/public/**',
			},
		],
	},
	env: {
		NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
	}
}

export default withNextIntl(nextConfig)
