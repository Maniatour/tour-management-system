/**
 * tour-photos-xxx 개별 버킷 정리 (Storage API 사용)
 *
 * 1) 각 tour-photos-xxx 버킷의 파일을 tour-photos/{투어ID}/ 아래로 복사
 * 2) 복사 후 해당 버킷 비우기 및 삭제
 *
 * 사용법:
 *   node scripts/cleanup-tour-photos-buckets.js
 *
 * 필요: .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const MAIN_BUCKET = 'tour-photos'

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 를 .env.local 에 설정해주세요.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function listAllObjectPaths(bucketId, folderPath = '') {
  const { data: items, error } = await supabase.storage.from(bucketId).list(folderPath, { limit: 1000 })
  if (error) {
    console.warn(`  ⚠ list 경고 (${folderPath}):`, error.message)
    return []
  }
  const paths = []
  for (const item of items || []) {
    if (!item.name) continue
    const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name
    if (item.id == null) {
      const sub = await listAllObjectPaths(bucketId, fullPath)
      paths.push(...sub)
    } else {
      paths.push(fullPath)
    }
  }
  return paths
}

/** tour-photos-xxx 버킷의 모든 파일을 tour-photos/{tourId}/ 로 복사 */
async function copyBucketToMain(sourceBucketId, tourId) {
  const filePaths = await listAllObjectPaths(sourceBucketId)
  if (filePaths.length === 0) {
    console.log(`  📂 복사할 파일 없음`)
    return
  }
  console.log(`  📂 복사할 파일 ${filePaths.length}개`)
  let ok = 0
  let fail = 0
  for (const filePath of filePaths) {
    try {
      const { data: blob, error: downErr } = await supabase.storage
        .from(sourceBucketId)
        .download(filePath)
      if (downErr || !blob) {
        console.warn(`  ⚠ 다운로드 실패 ${filePath}:`, downErr?.message)
        fail++
        continue
      }
      const destPath = `${tourId}/${filePath}`
      const { error: upErr } = await supabase.storage
        .from(MAIN_BUCKET)
        .upload(destPath, blob, { upsert: true, contentType: blob.type || 'image/jpeg' })
      if (upErr) {
        console.warn(`  ⚠ 업로드 실패 ${destPath}:`, upErr.message)
        fail++
      } else {
        ok++
        if (ok <= 5 || ok % 50 === 0 || ok === filePaths.length) {
          console.log(`  ✓ 복사 ${ok}/${filePaths.length}: ${filePath} → ${destPath}`)
        }
      }
    } catch (e) {
      console.warn(`  ⚠ 예외 ${filePath}:`, e.message)
      fail++
    }
  }
  console.log(`  📊 복사 결과: 성공 ${ok}, 실패 ${fail}`)
}

async function emptyBucket(bucketId) {
  const paths = await listAllObjectPaths(bucketId)
  if (paths.length === 0) return
  const batchSize = 1000
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize)
    const { error } = await supabase.storage.from(bucketId).remove(batch)
    if (error) {
      console.warn(`  ⚠ remove 경고 (${batch.length}개):`, error.message)
    } else {
      console.log(`  🗑 삭제: ${batch.length}개 파일`)
    }
  }
}

async function main() {
  console.log('📋 버킷 목록 조회 중...')
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()
  if (listError) {
    console.error('❌ 버킷 목록 조회 실패:', listError.message)
    process.exit(1)
  }

  const toRemove = (buckets || []).filter(
    (b) => b.name && b.name.startsWith('tour-photos-') && b.name !== 'tour-photos'
  )
  if (toRemove.length === 0) {
    console.log('✅ 삭제할 tour-photos-xxx 버킷이 없습니다.')
    return
  }

  console.log(`🗂 처리 대상 버킷 ${toRemove.length}개:`, toRemove.map((b) => b.name).join(', '))
  console.log(`   → 각 버킷 파일을 ${MAIN_BUCKET}/{투어ID}/ 로 복사 후 버킷 삭제\n`)

  for (const bucket of toRemove) {
    const bucketId = bucket.id || bucket.name
    const tourId = bucketId.replace(/^tour-photos-/, '')
    console.log(`\n📁 처리 중: ${bucketId} (tourId: ${tourId})`)
    await copyBucketToMain(bucketId, tourId)
    await emptyBucket(bucketId)
    const { error: delErr } = await supabase.storage.deleteBucket(bucketId)
    if (delErr) {
      console.error(`  ❌ 버킷 삭제 실패:`, delErr.message)
    } else {
      console.log(`  ✅ 버킷 삭제됨: ${bucketId}`)
    }
  }

  console.log('\n🎉 tour-photos-xxx 버킷 정리 완료. 파일은 tour-photos/{투어ID}/ 에 복사되어 있습니다.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
