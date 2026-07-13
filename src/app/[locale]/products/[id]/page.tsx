'use client'

import { useParams } from 'next/navigation'
import ProductDetailPageContent from '@/components/product/ProductDetailPageContent'

export default function ProductDetailPage() {
  const params = useParams()
  const productId = params.id as string

  return <ProductDetailPageContent productId={productId} />
}
