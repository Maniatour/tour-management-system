import fs from 'fs'

const path = 'src/app/[locale]/products/[id]/page.tsx'
const lines = fs.readFileSync(path, 'utf8').split('\n')

const newBlock = `
  useEffect(() => {
    if (!productId) return

    let cancelled = false

    const loadProductData = async () => {
      setLoading(true)
      setError(null)

      const data = await fetchProductPageData(productId, locale, isEnglish)
      if (cancelled) return

      setProduct(data.product)
      setProductDetails(data.productDetails)
      setTourCourses(data.tourCourses)
      setProductChoices(data.productChoices)
      setProductMedia(data.productMedia)
      setTourCoursePhotos(data.tourCoursePhotos)
      setError(data.error)
      setLoading(false)
    }

    loadProductData()

    return () => {
      cancelled = true
    }
  }, [productId, locale, isEnglish])
`.trim().split('\n')

const start = lines.findIndex((l) => l.includes('Navigation에서 장바구니 결제'))
const end = lines.findIndex((l) => l.includes('이미지 배열이 변경되면'))

if (start === -1 || end === -1) {
  console.error('markers not found', start, end)
  process.exit(1)
}

const out = [...lines.slice(0, start), ...newBlock, ...lines.slice(end)]
fs.writeFileSync(path, out.join('\n'))
console.log('replaced lines', start, end)
