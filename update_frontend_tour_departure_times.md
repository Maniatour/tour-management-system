# 투어 출발 시간 다중 선택 기능 업데이트 가이드

## 1. 데이터베이스 변경사항
- `products.tour_departure_time` (단일) → `products.tour_departure_times` (JSON 배열)
- 형식: `["09:00", "14:00", "18:00"]`

## 2. 프론트엔드 수정이 필요한 파일들

### A. BasicInfoTab.tsx 수정
```typescript
// 기존: 단일 시간 입력
tourDepartureTime?: string

// 새로운: 다중 시간 선택 (배열)
tourDepartureTimes?: string[]
```

### B. UI 변경사항
1. 시간 입력 필드를 다중 선택 UI로 변경
2. 시간 추가/제거 버튼 추가
3. 선택된 시간 목록 표시

## 3. 수정 코드 예시

### BasicInfoTab.tsx에서 시간 관리 섹션 추가
```typescript
// 투어 출발 시간 관리
<div className="space-y-3">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {t('tourDepartureTimes')} (다중 선택)
  </label>
  
  {/* 시간 추가 입력 */}
  <div className="flex gap-2">
    <input
      type="time"
      value={newDepartureTime}
      onChange={(e) => setNewDepartureTime(e.target.value)}
      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
    />
    <button
      type="button"
      onClick={addDepartureTime}
      disabled={!newDepartureTime}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
    >
      추가
    </button>
  </div>
  
  {/* 선택된 시간 목록 */}
  <div className="flex flex-wrap gap-2">
    {formData.tourDepartureTimes?.map((time, index) => (
      <div key={index} className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
        <span>{time}</span>
        <button
          type="button"
          onClick={() => removeDepartureTime(index)}
          className="ml-2 text-red-600 hover:text-red-800"
        >
          ×
        </button>
      </div>
    ))}
  </div>
</div>
```

### 시간 관리 함수들
```typescript
const [newDepartureTime, setNewDepartureTime] = useState('')

const addDepartureTime = () => {
  if (newDepartureTime && !formData.tourDepartureTimes?.includes(newDepartureTime)) {
    setFormData({
      ...formData,
      tourDepartureTimes: [...(formData.tourDepartureTimes || []), newDepartureTime]
    })
    setNewDepartureTime('')
  }
}

const removeDepartureTime = (index: number) => {
  setFormData({
    ...formData,
    tourDepartureTimes: formData.tourDepartureTimes?.filter((_, i) => i !== index) || []
  })
}
```

### 데이터 저장 부분 수정
```typescript
// 데이터베이스 저장 시 JSON 배열로 변환
tour_departure_times: formData.tourDepartureTimes ? JSON.stringify(formData.tourDepartureTimes) : null
```

### 데이터 로드 부분 수정
```typescript
// 데이터베이스에서 로드 시 JSON 배열을 파싱
tourDepartureTimes: productData.tour_departure_times ? 
  JSON.parse(productData.tour_departure_times) : []
```

## 4. 투어 스케줄에서 사용

### 투어 생성 시 출발 시간 선택
```typescript
// 사용 가능한 출발 시간을 Supabase에서 가져오기
const getAvailableDepartureTimes = async (productId: string) => {
  const { data } = await supabase
    .from('products')
    .select('tour_departure_times')
    .eq('id', productId)
    .single()
  
  return data.tour_departure_times || []
}
```

## 5. 다국어 번역 추가
```json
// ko.json
"tourDepartureTimes": "투어 출발 시간들",
"addDepartureTime": "출발 시간 추가",
"removeDepartureTime": "출발 시간 제거",

// en.json  
"tourDepartureTimes": "Tour Departure Times",
"addDepartureTime": "Add Departure Time",
"removeDepartureTime": "Remove Departure Time"
```
