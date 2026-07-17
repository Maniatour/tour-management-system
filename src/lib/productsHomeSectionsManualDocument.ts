import {
  newSopId,
  prefillSortOrders,
  type SopCategory,
  type SopChecklistItem,
  type SopDocument,
  type SopSection,
} from '@/types/sopStructure'

export const PRODUCTS_HOME_SECTIONS_MANUAL_SLUG = 'system-admin-products-home-sections'

function checks(items: Array<{ ko: string; en: string }>): SopChecklistItem[] {
  const ids = items.map(() => newSopId())
  return items.map((it, i) => ({
    id: ids[i]!,
    title_ko: it.ko,
    title_en: it.en,
    sort_order: i,
    parent_id: null,
  }))
}

function cat(
  title_ko: string,
  title_en: string,
  content_ko: string,
  content_en: string,
  sort_order: number,
  checklist?: SopChecklistItem[]
): SopCategory {
  return {
    id: newSopId(),
    title_ko,
    title_en,
    content_ko,
    content_en,
    sort_order,
    ...(checklist?.length ? { checklist_items: checklist } : {}),
  }
}

function sec(title_ko: string, title_en: string, sort_order: number, categories: SopCategory[]): SopSection {
  return { id: newSopId(), title_ko, title_en, sort_order, categories }
}

const VERIFY_CHECKLIST = checks([
  {
    ko: '상품 상태가 「활성(active)」인지 확인',
    en: 'Confirm product status is Active',
  },
  {
    ko: '상품 태그에 홈 카드 「연결 태그」 문자열이 포함되는지 확인',
    en: 'Confirm product tags include the home card connection-tag string',
  },
  {
    ko: '고객 홈에서 카드 클릭 → /products?tag=... 목록에 해당 상품이 보이는지 확인',
    en: 'On customer home, click the card and verify the product appears in /products?tag=...',
  },
  {
    ko: '안 보이면 태그 번역 관리·상품 기본정보의 태그 키/표기를 다시 맞춤',
    en: 'If missing, realign tag keys/labels in Tag Translation and Basic Info',
  },
])

/** 상품 관리 — 홈 Explore Top Destinations / Choose Your Adventure 노출 가이드 */
export const productsHomeSectionsManualDocument: SopDocument = prefillSortOrders({
  title_ko: '홈 목적지·어드벤처에 상품 노출하기',
  title_en: 'Show products in home Destinations & Adventure',
  sections: [
    sec('핵심 요약', 'Quick summary', 0, [
      cat(
        '이 메뉴얼이 다루는 것',
        'What this manual covers',
        `고객 홈의 두 섹션은 **상품 카드 목록이 아니라**, 목적지·카테고리 **바로가기 카드**입니다.

| 홈 섹션 | 역할 |
|---------|------|
| **Explore Top Destinations** | 목적지(그랜드캐년, 앤텔롭 등) 카드 |
| **Choose Your Adventure** | 여행 스타일·카테고리(당일, 헬기 등) 카드 |

고객이 카드를 누르면 \`/products?tag=연결태그\` 로 이동하고, **상품의 tags에 그 문자열이 포함된 활성 상품**만 목록에 나타납니다.

**한 줄 설정법**
1. 홈 카드의 **연결 태그**를 확인한다  
2. 상품 관리 → 상품 수정 → **기본 정보 → 태그**에 같은 문자열이 들어가게 한다  
3. 상품 **상태 = 활성**으로 저장한다`,
        `The two home sections are **shortcut cards**, not a direct product grid.

| Home section | Role |
|--------------|------|
| **Explore Top Destinations** | Destination cards (Grand Canyon, Antelope, etc.) |
| **Choose Your Adventure** | Travel-style / category cards (day tour, helicopter, etc.) |

Clicking a card goes to \`/products?tag={connectionTag}\`. Only **active** products whose **tags** contain that string appear.

**One-line setup**
1. Check the card’s **connection tag**  
2. On the product → **Basic Info → Tags**, include a matching string  
3. Save with status **Active**`,
        0
      ),
    ]),
    sec('상품에 태그 달기', 'Tag the product', 1, [
      cat(
        '상품 관리에서 설정',
        'Set tags in Products admin',
        `### 경로
**관리자 → 상품 관리 → 상품 선택 → 기본 정보 → 태그**

1. **태그 선택**에서 해당 목적지·카테고리 태그를 고릅니다.  
2. 필요하면 **태그 번역 관리**에서 한국어/영어 라벨을 정리합니다.  
3. **저장** 후 상품 상태를 **활성(active)** 으로 둡니다.  
4. 초안(draft)·비활성(inactive) 상품은 고객 목록에 나오지 않습니다.

### 매칭 규칙 (중요)
목록 필터는 상품 \`tags\` 배열의 각 값에 대해  
\`태그값.includes(연결태그)\` (대소문자 무시) 로 검사합니다.

| 홈 연결 태그 예 | 상품 태그에 있으면 표시 |
|----------------|-------------------------|
| \`그랜드캐년\` | \`그랜드캐년\`, \`그랜드캐년투어\` 등 |
| \`시티\` | \`시티\`, \`시티투어\` 등 |
| \`grand_canyon\` | \`grand_canyon\` 키가 포함된 경우 |

**팁:** 영문 태그 키만 쓰는 상품이면, 홈 카드 **연결 태그**도 그 키(예: \`grand_canyon\`)에 맞추거나, 상품에 한국어 태그를 함께 넣으세요.`,
        `### Path
**Admin → Products → open product → Basic Info → Tags**

1. Select the destination/category tags.  
2. Optionally tidy KO/EN labels in **Tag Translation**.  
3. **Save** and keep status **Active**.  
4. Draft/inactive products do not appear on the customer listing.

### Matching rule (important)
The listing checks each value in the product \`tags\` array with  
\`tag.includes(connectionTag)\` (case-insensitive).

| Example connection tag | Product shows if tags include |
|------------------------|-------------------------------|
| \`그랜드캐년\` | \`그랜드캐년\`, \`그랜드캐년투어\`, etc. |
| \`시티\` | \`시티\`, \`시티투어\`, etc. |
| \`grand_canyon\` | keys containing \`grand_canyon\` |

**Tip:** If products only use English keys, set the home card connection tag to that key (e.g. \`grand_canyon\`) or also add a Korean tag on the product.`,
        0
      ),
    ]),
    sec('Explore Top Destinations', 'Explore Top Destinations', 2, [
      cat(
        '기본 연결 태그 (목적지)',
        'Default destination connection tags',
        `홈에 보이는 목적지 카드는 기본적으로 아래 **연결 태그**로 상품을 찾습니다.  
(고객 페이지 편집에서 이름·이미지·태그를 바꿀 수 있습니다.)

| 목적지 (기본) | 연결 태그 |
|---------------|-----------|
| Las Vegas / 시티 | \`시티\` |
| Grand Canyon | \`그랜드캐년\` |
| Antelope Canyon | \`앤텔롭\` |
| Zion | \`자이언\` |
| Bryce Canyon | \`브라이스\` |
| Horseshoe Bend | \`홀슈\` |
| Death Valley | \`데스밸리\` |
| Valley of Fire | \`불의\` |
| Monument Valley | \`모뉴먼트\` |
| Sedona | \`세도나\` |

**상품을 특정 목적지에 보이게 하려면**  
해당 행의 연결 태그가 상품 태그에 포함되도록 설정하세요.`,
        `Destination cards use these default **connection tags** (editable in customer-page settings).

| Destination (default) | Connection tag |
|-----------------------|----------------|
| Las Vegas / City | \`시티\` |
| Grand Canyon | \`그랜드캐년\` |
| Antelope Canyon | \`앤텔롭\` |
| Zion | \`자이언\` |
| Bryce Canyon | \`브라이스\` |
| Horseshoe Bend | \`홀슈\` |
| Death Valley | \`데스밸리\` |
| Valley of Fire | \`불의\` |
| Monument Valley | \`모뉴먼트\` |
| Sedona | \`세도나\` |

**To show a product under a destination**, make sure that connection tag is contained in the product’s tags.`,
        0
      ),
    ]),
    sec('Choose Your Adventure', 'Choose Your Adventure', 3, [
      cat(
        '기본 연결 태그 (어드벤처)',
        'Default adventure connection tags',
        `여행 스타일 카드 기본 연결 태그입니다.

| 카테고리 (기본) | 연결 태그 |
|-----------------|-----------|
| Antelope Canyon | \`앤텔롭\` |
| Grand Canyon | \`그랜드캐년\` |
| 근교 투어 | \`근교\` |
| 당일 투어 | \`당일\` |
| 숙박 투어 | \`숙박\` |
| 시티 투어 | \`시티\` |
| 헬기 투어 | \`헬기\` |
| 경비행기 | \`경비행기\` |
| 버스 투어 | \`버스\` |
| 프리미엄 | \`프리미엄\` |
| 공연 티켓 | \`공연\` |
| 어트랙션 | \`어트랙션\` |
| 이벤트 | \`이벤트\` |
| 쿠폰 | \`쿠폰\` |
| 여행자 보험 | \`여행자보험\` |
| 컨벤션 지원 | \`컨벤션\` |

한 상품에 **여러 태그**를 달면, 여러 Adventure / Destination 카드에서 동시에 노출될 수 있습니다.`,
        `Default adventure-card connection tags:

| Category (default) | Connection tag |
|--------------------|----------------|
| Antelope Canyon | \`앤텔롭\` |
| Grand Canyon | \`그랜드캐년\` |
| Suburban | \`근교\` |
| Day tour | \`당일\` |
| Overnight | \`숙박\` |
| City tour | \`시티\` |
| Helicopter | \`헬기\` |
| Light aircraft | \`경비행기\` |
| Bus tour | \`버스\` |
| Premium | \`프리미엄\` |
| Show tickets | \`공연\` |
| Attraction | \`어트랙션\` |
| Event | \`이벤트\` |
| Coupon | \`쿠폰\` |
| Travel insurance | \`여행자보험\` |
| Convention support | \`컨벤션\` |

A product with **multiple tags** can appear under several Adventure / Destination cards.`,
        0
      ),
    ]),
    sec('홈 카드 자체 편집', 'Edit the home cards', 4, [
      cat(
        '고객 페이지에서 섹션 설정',
        'Configure sections on the customer page',
        `카드에 보이는 **이름·이미지·연결 태그**를 바꾸려면 상품 태그가 아니라 **홈 섹션 설정**을 수정합니다.

### 경로
1. 고객용 홈페이지를 **편집/미리보기** 모드로 엽니다.  
2. **Explore Top Destinations** 또는 **Choose Your Adventure** 존을 클릭합니다.  
3. 아래를 편집한 뒤 저장합니다.

| 항목 | 설명 |
|------|------|
| 이름 (한/영) | 카드에 표시되는 제목 |
| **연결 태그** | 클릭 시 \`/products?tag=...\` 에 쓰이는 검색 문자열 |
| 이미지 / 아이콘 | 카드 비주얼 |

**주의:** 연결 태그를 바꾸면, 기존에 맞춰 둔 상품 태그도 같이 맞춰야 목록에 계속 나옵니다.`,
        `To change card **names, images, and connection tags**, edit the **home section settings** (not only product tags).

### Path
1. Open the customer homepage in **edit/preview** mode.  
2. Click the **Explore Top Destinations** or **Choose Your Adventure** zone.  
3. Edit and save:

| Field | Meaning |
|-------|---------|
| Name (KO/EN) | Title on the card |
| **Connection tag** | String used in \`/products?tag=...\` |
| Image / icon | Card visual |

**Note:** If you change the connection tag, update product tags to match or products will disappear from that list.`,
        0
      ),
    ]),
    sec('확인 체크리스트', 'Verification checklist', 5, [
      cat(
        '노출이 안 될 때',
        'If a product does not appear',
        `아래를 순서대로 확인하세요.`,
        `Check the following in order.`,
        0,
        VERIFY_CHECKLIST
      ),
    ]),
  ],
})

export const productsHomeSectionsManualTitles = {
  ko: '홈 Destinations · Adventure 상품 노출',
  en: 'Home Destinations · Adventure product visibility',
} as const
