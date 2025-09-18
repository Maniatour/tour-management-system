-- 체크리스트 클릭 기록 테이블 생성
CREATE TABLE IF NOT EXISTS todo_click_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID NOT NULL REFERENCES op_todos(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('completed', 'uncompleted')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_todo_click_logs_todo_id ON todo_click_logs(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_click_logs_user_email ON todo_click_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_todo_click_logs_timestamp ON todo_click_logs(timestamp);

-- RLS 정책 설정
ALTER TABLE todo_click_logs ENABLE ROW LEVEL SECURITY;

-- 팀원만 읽기/쓰기 가능
CREATE POLICY "Team members can view todo click logs" ON todo_click_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Team members can insert todo click logs" ON todo_click_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email'
    )
  );
