import type { MetadataRoute } from 'next'
import { getCustomerSiteUrl } from '@/lib/customerSeo'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getCustomerSiteUrl()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/*/admin/',
          '/*/guide/',
          '/*/dashboard/',
          '/*/auth/',
          '/*/rebook/',
          '/*/pay/',
          '/*/photos/',
          '/*/employee-contract/',
          '/*/sop/',
          '/*/off-schedule/',
          '/*/booking/confirmation',
          '/*/travel-guide/write',
          '/~offline',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
