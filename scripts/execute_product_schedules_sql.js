const fs = require('fs');
const path = require('path');

async function executeSQL() {
  try {
    // SQL 파일 읽기
    const sqlPath = path.join(__dirname, 'create_product_schedules_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // API 엔드포인트 호출
    const response = await fetch('http://localhost:3000/api/test-sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql })
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ product_schedules 테이블이 성공적으로 생성되었습니다.');
      console.log('Result:', result.data);
    } else {
      console.error('❌ 테이블 생성 실패:', result.error);
    }

  } catch (error) {
    console.error('❌ 스크립트 실행 오류:', error);
  }
}

executeSQL();
