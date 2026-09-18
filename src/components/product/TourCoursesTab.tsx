'use client'

import ProductTourCoursesWorkspace from '@/components/tour-courses/ProductTourCoursesWorkspace'

interface TourCoursesTabProps {
  productId: string
  isNewProduct: boolean
}

export default function TourCoursesTab({ productId, isNewProduct }: TourCoursesTabProps) {
  return (
    <ProductTourCoursesWorkspace productId={productId} isNewProduct={isNewProduct} />
  )
}
