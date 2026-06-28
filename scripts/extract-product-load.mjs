import fs from 'fs'

const page = fs.readFileSync('src/app/[locale]/products/[id]/page.tsx', 'utf8').split('\n')
const start = 248
const end = 643
let body = page.slice(start, end).join('\n')

body = body.replace(/setLoading\(true\)\s*\n\s*setError\(null\)\s*\n\s*/g, '')
body = body.replace(/setProduct\(/g, 'product = ')
body = body.replace(/setProductDetails\(/g, 'productDetails = ')
body = body.replace(/setTourCourses\(/g, 'tourCourses = ')
body = body.replace(/setTourCoursesMap\(/g, 'tourCoursesMap = ')
body = body.replace(/setProductChoices\(/g, 'productChoices = ')
body = body.replace(/setProductMedia\(/g, 'productMedia = ')
body = body.replace(/setTourCoursePhotos\(/g, 'tourCoursePhotos = ')
body = body.replace(/setError\(([^)]+)\)\s*\n\s*return/g, 'return { ...empty, error: $1 }')

body = body
  .split('\n')
  .filter((l) => !l.trim().startsWith('console.log('))
  .join('\n')

fs.writeFileSync('scripts/_extracted-product-load.txt', body)
console.log('lines', body.split('\n').length)
