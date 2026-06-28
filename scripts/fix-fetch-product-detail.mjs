import fs from 'fs'

let content = fs.readFileSync('src/lib/fetchProductDetail.ts', 'utf8')

// Fix broken assignment trailing parens from setState conversion
content = content.replace(/product = productData as unknown as Product\)/g, 'product = productData as unknown as Product')
content = content.replace(/productDetails = detailsData\)/g, 'productDetails = detailsData')
content = content.replace(/tourCourses = sortedData\)/g, 'tourCourses = sortedData')
content = content.replace(/tourCourses = \[\]\)/g, 'tourCourses = []')
content = content.replace(/productChoices = flattenedChoices\)/g, 'productChoices = flattenedChoices')
content = content.replace(/productChoices = \[\]\)/g, 'productChoices = []')
content = content.replace(/tourCoursesMap = courseMap\)/g, 'tourCoursesMap = courseMap')

content = content.replace(/setProductDetails\(/g, 'productDetails = ')
content = content.replace(/setTourCourses\(/g, 'tourCourses = ')
content = content.replace(/setProductChoices\(/g, 'productChoices = ')

// Fix broken tourCoursePhotos map
content = content.replace(
  /tourCoursePhotos = photosData\.map\(\(p => \(\{([\s\S]*?)\n        \}\n      \}/,
  'tourCoursePhotos = photosData.map((p) => ({$1\n          }))'
)

// Remove leftover console.log object blocks
content = content.split('\n').filter((line) => {
  const t = line.trim()
  if (t.startsWith('console.log(')) return false
  if (t === 'mapSize: courseMap.size,') return false
  if (t === 'courseIds: Array.from(courseMap.keys())') return false
  if (t === '})') {
    // might remove valid - check context - skip aggressive filter
  }
  return true
}).join('\n')

// Remove orphan lines from removed console.log
content = content.replace(/\n\s*mapSize: courseMap\.size,\n\s*courseIds: Array\.from\(courseMap\.keys\(\)\)\n\s*\}\)\n/g, '\n')

fs.writeFileSync('src/lib/fetchProductDetail.ts', content)
console.log('fixed')
