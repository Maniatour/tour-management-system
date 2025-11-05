# Self 채널 관리 가이드

## 현재 구조

```
SELF 채널 (활성)
├─ sub_channels: [Kakaotalk, Kakaotalk 1, Kakaotalk 2, Open Kakaotalk, ...]
└─ 개별 서브 채널들 (inactive 상태로 보존)
    ├─ M00004: Kakaotalk 1 (inactive)
    ├─ M00010: Kakaotalk (inactive)
    ├─ M00008: Blog (inactive)
    └─ ...
```

## 채널 관리 방법

### 1. 새로운 서브 채널 추가

#### 방법 1: SQL로 직접 추가
```sql
-- SELF 채널의 sub_channels 배열에 새 채널 추가
UPDATE channels
SET sub_channels = array_append(sub_channels, '새채널명')
WHERE id = 'SELF';

-- 새 서브 채널을 inactive 상태로 생성 (선택사항)
INSERT INTO channels (id, name, type, category, status, description)
VALUES ('새채널ID', '새채널명', 'Self', 'Own', 'inactive', '새 자체 채널')
ON CONFLICT (id) DO NOTHING;
```

#### 방법 2: 여러 채널 한번에 추가
```sql
UPDATE channels
SET sub_channels = sub_channels || ARRAY['새채널1', '새채널2', '새채널3']
WHERE id = 'SELF';
```

### 2. 서브 채널 제거

```sql
-- sub_channels 배열에서 특정 채널 제거
UPDATE channels
SET sub_channels = array_remove(sub_channels, '제거할채널명')
WHERE id = 'SELF';
```

### 3. 서브 채널 목록 조회

```sql
-- SELF 채널의 서브 채널 목록 확인
SELECT id, name, sub_channels, array_length(sub_channels, 1) as sub_channel_count
FROM channels
WHERE id = 'SELF';

-- 특정 서브 채널이 포함되어 있는지 확인
SELECT * FROM channels
WHERE id = 'SELF' AND 'Kakaotalk' = ANY(sub_channels);
```

### 4. 서브 채널별 데이터 조회

```sql
-- Kakaotalk 서브 채널을 통해 온 고객 조회
SELECT * FROM customers
WHERE channel_id = 'SELF' AND sub_channel = 'Kakaotalk';

-- Blog 서브 채널을 통해 온 예약 조회
SELECT * FROM reservations
WHERE channel_id = 'SELF' AND sub_channel = 'Blog';

-- 서브 채널별 예약 통계
SELECT 
    sub_channel,
    COUNT(*) as reservation_count,
    SUM(total_people) as total_people
FROM reservations
WHERE channel_id = 'SELF' AND sub_channel IS NOT NULL
GROUP BY sub_channel
ORDER BY reservation_count DESC;
```

## 애플리케이션에서 사용 방법

### 1. 채널 선택 UI

```typescript
// Self 채널 선택 시 서브 채널도 선택할 수 있도록
const [selectedChannel, setSelectedChannel] = useState('SELF');
const [selectedSubChannel, setSelectedSubChannel] = useState('');

// SELF 채널의 서브 채널 목록 가져오기
const selfChannel = channels.find(c => c.id === 'SELF');
const subChannels = selfChannel?.sub_channels || [];

// 예약 생성 시
const createReservation = async () => {
  await supabase.from('reservations').insert({
    channel_id: 'SELF',
    sub_channel: selectedSubChannel, // 'Kakaotalk', 'Blog' 등
    channel_rn: selectedSubChannel,  // 기존 필드도 함께 저장
    // ... 기타 필드
  });
};
```

### 2. 채널 목록 표시

```typescript
// 채널 목록에서 Self 채널은 서브 채널과 함께 표시
{channels.map(channel => {
  if (channel.id === 'SELF') {
    return (
      <div key={channel.id}>
        <h3>{channel.name}</h3>
        <p>서브 채널: {channel.sub_channels.join(', ')}</p>
      </div>
    );
  }
  return <ChannelCard key={channel.id} channel={channel} />;
})}
```

### 3. 통계 및 리포트

```typescript
// 서브 채널별 통계 조회
const getSubChannelStats = async () => {
  const { data } = await supabase
    .from('reservations')
    .select('sub_channel, count')
    .eq('channel_id', 'SELF')
    .not('sub_channel', 'is', null);
  
  // 서브 채널별 그룹화 및 집계
  return data.reduce((acc, item) => {
    acc[item.sub_channel] = (acc[item.sub_channel] || 0) + item.count;
    return acc;
  }, {});
};
```

## 일반적인 작업 예시

### 서브 채널 추가하기
```sql
-- 예: 'Email' 채널 추가
UPDATE channels
SET sub_channels = array_append(sub_channels, 'Email')
WHERE id = 'SELF';
```

### 서브 채널 이름 변경
```sql
-- 1. sub_channels 배열에서 이름 변경
UPDATE channels
SET sub_channels = array_replace(sub_channels, '구이름', '신이름')
WHERE id = 'SELF';

-- 2. customers와 reservations의 sub_channel도 업데이트
UPDATE customers
SET sub_channel = '신이름'
WHERE sub_channel = '구이름';

UPDATE reservations
SET sub_channel = '신이름', channel_rn = '신이름'
WHERE sub_channel = '구이름';
```

### 서브 채널 정렬
```sql
-- sub_channels 배열을 알파벳 순으로 정렬
UPDATE channels
SET sub_channels = (
    SELECT ARRAY_AGG(elem ORDER BY elem)
    FROM unnest(sub_channels) AS elem
)
WHERE id = 'SELF';
```

## 주의사항

1. **서브 채널 이름 변경**: `sub_channel` 필드가 있는 모든 테이블(customers, reservations)도 함께 업데이트해야 합니다.
2. **중복 방지**: 같은 이름이 배열에 중복되지 않도록 주의하세요.
3. **대소문자**: 채널 이름은 대소문자를 구분합니다. 일관성을 유지하세요.
4. **기존 데이터**: `sub_channel` 필드가 NULL인 레코드들은 마이그레이션 전 데이터일 수 있습니다. 필요시 수동으로 업데이트하세요.

## 데이터 정리

### sub_channel이 NULL인 레코드 확인
```sql
-- customers에서 sub_channel이 NULL이지만 channel_id가 SELF인 경우
SELECT * FROM customers
WHERE channel_id = 'SELF' AND sub_channel IS NULL;

-- reservations에서도 확인
SELECT * FROM reservations
WHERE channel_id = 'SELF' AND sub_channel IS NULL;
```

### 누락된 sub_channel 업데이트 (channel_rn 사용)
```sql
-- reservations에서 channel_rn이 있으면 sub_channel에 복사
UPDATE reservations
SET sub_channel = channel_rn
WHERE channel_id = 'SELF' 
  AND sub_channel IS NULL 
  AND channel_rn IS NOT NULL;
```

