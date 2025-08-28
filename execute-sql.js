const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase 클라이언트 생성
const supabaseUrl = 'https://tyilwbytyuqrhxekjxcd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5aWx3Ynl0eXVxcmh4ZWtqeGNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM1MzUxOSwiZXhwIjoyMDcxOTI5NTE5fQ.p3eom_moz5R_xLt66eNI1ORlRNq5OM52AnLEIpU3_Os';

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeSQL() {
  try {
    console.log('🚀 Supabase SQL 실행 시작...');
    
    // SQL 파일 읽기
    const sqlContent = fs.readFileSync('update-products-pricing.sql', 'utf8');
    console.log('📖 SQL 파일 읽기 완료');
    
    // SQL 문장들을 세미콜론으로 분리
    const sqlStatements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 총 ${sqlStatements.length}개의 SQL 문장을 실행합니다...`);
    
    // 각 SQL 문장 실행
    for (let i = 0; i < sqlStatements.length; i++) {
      const sql = sqlStatements[i];
      if (sql.trim()) {
        console.log(`\n🔧 SQL ${i + 1} 실행 중...`);
        console.log(`SQL: ${sql.substring(0, 100)}...`);
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
          
          if (error) {
            console.log(`❌ SQL ${i + 1} 실행 실패:`, error.message);
          } else {
            console.log(`✅ SQL ${i + 1} 실행 성공`);
          }
        } catch (err) {
          console.log(`❌ SQL ${i + 1} 실행 중 오류:`, err.message);
        }
      }
    }
    
    console.log('\n🎉 SQL 실행 완료!');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

// 실행
executeSQL();
