-- 체크리스트 자동 리셋 함수들 생성

-- 일일 리셋 함수 (매일 오전 2시 PST)
CREATE OR REPLACE FUNCTION reset_daily_todos()
RETURNS void AS $$
BEGIN
  -- 일일 카테고리의 모든 todo를 미완료로 리셋
  UPDATE op_todos 
  SET completed = false, completed_at = null
  WHERE category = 'daily';
  
  -- 리셋 기록을 로그에 남김
  INSERT INTO todo_click_logs (todo_id, user_email, action, timestamp)
  SELECT 
    id, 
    'system@auto-reset.com',
    'uncompleted',
    NOW()
  FROM op_todos 
  WHERE category = 'daily';
END;
$$ LANGUAGE plpgsql;

-- 주간 리셋 함수 (월요일 오전 2시 PST)
CREATE OR REPLACE FUNCTION reset_weekly_todos()
RETURNS void AS $$
BEGIN
  -- 주간 카테고리의 모든 todo를 미완료로 리셋
  UPDATE op_todos 
  SET completed = false, completed_at = null
  WHERE category = 'weekly';
  
  -- 리셋 기록을 로그에 남김
  INSERT INTO todo_click_logs (todo_id, user_email, action, timestamp)
  SELECT 
    id, 
    'system@auto-reset.com',
    'uncompleted',
    NOW()
  FROM op_todos 
  WHERE category = 'weekly';
END;
$$ LANGUAGE plpgsql;

-- 월간 리셋 함수 (1일 오전 2시 PST)
CREATE OR REPLACE FUNCTION reset_monthly_todos()
RETURNS void AS $$
BEGIN
  -- 월간 카테고리의 모든 todo를 미완료로 리셋
  UPDATE op_todos 
  SET completed = false, completed_at = null
  WHERE category = 'monthly';
  
  -- 리셋 기록을 로그에 남김
  INSERT INTO todo_click_logs (todo_id, user_email, action, timestamp)
  SELECT 
    id, 
    'system@auto-reset.com',
    'uncompleted',
    NOW()
  FROM op_todos 
  WHERE category = 'monthly';
END;
$$ LANGUAGE plpgsql;

-- 연간 리셋 함수 (1월 1일 오전 2시 PST)
CREATE OR REPLACE FUNCTION reset_yearly_todos()
RETURNS void AS $$
BEGIN
  -- 연간 카테고리의 모든 todo를 미완료로 리셋
  UPDATE op_todos 
  SET completed = false, completed_at = null
  WHERE category = 'yearly';
  
  -- 리셋 기록을 로그에 남김
  INSERT INTO todo_click_logs (todo_id, user_email, action, timestamp)
  SELECT 
    id, 
    'system@auto-reset.com',
    'uncompleted',
    NOW()
  FROM op_todos 
  WHERE category = 'yearly';
END;
$$ LANGUAGE plpgsql;

-- 통합 리셋 함수 (모든 카테고리 리셋)
CREATE OR REPLACE FUNCTION reset_all_todos()
RETURNS void AS $$
BEGIN
  -- 모든 카테고리의 todo를 미완료로 리셋
  UPDATE op_todos 
  SET completed = false, completed_at = null;
  
  -- 리셋 기록을 로그에 남김
  INSERT INTO todo_click_logs (todo_id, user_email, action, timestamp)
  SELECT 
    id, 
    'system@auto-reset.com',
    'uncompleted',
    NOW()
  FROM op_todos;
END;
$$ LANGUAGE plpgsql;

-- 스케줄링을 위한 이벤트 트리거 (PostgreSQL에서는 pg_cron 확장 필요)
-- 실제 운영 환경에서는 외부 스케줄러(cron, GitHub Actions 등)를 사용하는 것이 권장됩니다.

-- 예시: pg_cron을 사용한 스케줄링 (확장이 설치된 경우)
-- SELECT cron.schedule('daily-reset', '0 2 * * *', 'SELECT reset_daily_todos();');
-- SELECT cron.schedule('weekly-reset', '0 2 * * 1', 'SELECT reset_weekly_todos();');
-- SELECT cron.schedule('monthly-reset', '0 2 1 * *', 'SELECT reset_monthly_todos();');
-- SELECT cron.schedule('yearly-reset', '0 2 1 1 *', 'SELECT reset_yearly_todos();');

-- 수동 리셋을 위한 함수들
CREATE OR REPLACE FUNCTION manual_reset_todos(category_name text)
RETURNS text AS $$
BEGIN
  CASE category_name
    WHEN 'daily' THEN
      PERFORM reset_daily_todos();
      RETURN '일일 체크리스트가 리셋되었습니다.';
    WHEN 'weekly' THEN
      PERFORM reset_weekly_todos();
      RETURN '주간 체크리스트가 리셋되었습니다.';
    WHEN 'monthly' THEN
      PERFORM reset_monthly_todos();
      RETURN '월간 체크리스트가 리셋되었습니다.';
    WHEN 'yearly' THEN
      PERFORM reset_yearly_todos();
      RETURN '연간 체크리스트가 리셋되었습니다.';
    WHEN 'all' THEN
      PERFORM reset_all_todos();
      RETURN '모든 체크리스트가 리셋되었습니다.';
    ELSE
      RETURN '잘못된 카테고리입니다. (daily, weekly, monthly, yearly, all 중 하나를 선택하세요)';
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- RLS 정책 추가 (시스템 함수는 모든 사용자가 실행 가능하도록)
CREATE POLICY "Allow manual reset for team members" ON todo_click_logs
  FOR INSERT WITH CHECK (
    user_email = 'system@auto-reset.com' OR
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email'
    )
  );
