import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApiAuth } from '@/lib/api-security';
import { createServerSupabase } from '@/lib/supabase-server';
import { resolveOperatorId } from '@/lib/operators/scopeQuery';

/**
 * POST /api/update-products-name-en
 * Staff-only one-shot helper: fill null name_en from Korean name patterns.
 * Body: { confirm: true, operatorId?: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request);
  if (!auth.ok) return auth.response;

  let body: { confirm?: boolean; operatorId?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (body.confirm !== true) {
    return NextResponse.json(
      {
        error: 'confirm: true required',
        hint: 'POST { "confirm": true, "operatorId": "<uuid>" }',
      },
      { status: 400 }
    );
  }

  const operatorId = resolveOperatorId(body.operatorId);
  const supabase = await createServerSupabase();

  try {
    const updates = [
      { pattern: '%그랜드서클%1박%2일%', name_en: 'Grand Circle 1 Night 2 Days Tour' },
      { pattern: '%그랜드서클%당일%', name_en: 'Grand Circle Day Tour' },
      { pattern: '%그랜드서클%3박%4일%', name_en: 'Grand Circle 3 Nights 4 Days Tour' },
      { pattern: '%그랜드서클%', name_en: 'Grand Circle Tour' },
      { pattern: '%도깨비%일출%엔텔롭%', name_en: 'Goblin Grand Canyon Sunrise Tour + Antelope Canyon' },
      { pattern: '%도깨비%일출%앤텔롭%', name_en: 'Goblin Grand Canyon Sunrise Tour + Antelope Canyon' },
      { pattern: '%도깨비%일출%', name_en: 'Goblin Grand Canyon Sunrise Tour' },
      { pattern: '%도깨비%', name_en: 'Goblin Tour' },
      { pattern: '%야경투어%', name_en: 'Night Tour' },
      { pattern: '%웨스트림%', name_en: 'West Rim Tour' },
      { pattern: '%공항%픽업%', name_en: 'Airport Pickup Service' },
      { pattern: '%불의%계곡%', name_en: 'Valley of Fire Tour' },
      { pattern: '%모뉴먼트%밸리%', name_en: 'Monument Valley Tour' },
      { pattern: '%자이언%캐니언%', name_en: 'Zion Canyon Tour' },
      { pattern: '%브라이스%캐니언%', name_en: 'Bryce Canyon Tour' },
      { pattern: '%앤텔롭%캐니언%', name_en: 'Antelope Canyon Tour' },
      { pattern: '%엔텔롭%캐니언%', name_en: 'Antelope Canyon Tour' },
      { pattern: '%앤틸롭%캐니언%', name_en: 'Antelope Canyon Tour' },
      { pattern: '%그랜드캐년%', name_en: 'Grand Canyon Tour' },
      { pattern: '%라스베가스%', name_en: 'Las Vegas Tour' },
      { pattern: '%후버댐%', name_en: 'Hoover Dam Tour' },
      { pattern: '%데쓰밸리%', name_en: 'Death Valley Tour' },
      { pattern: '%2박%3일%', name_en: '2 Nights 3 Days Tour' },
      { pattern: '%3박%4일%', name_en: '3 Nights 4 Days Tour' },
    ];

    let updatedCount = 0;

    for (const update of updates) {
      const { data, error } = await supabase
        .from('products')
        .update({ name_en: update.name_en })
        .like('name', update.pattern)
        .is('name_en', null)
        .eq('operator_id', operatorId)
        .select('id');

      if (error) {
        console.error(`Error updating products with pattern ${update.pattern}:`, error);
      } else {
        updatedCount += data?.length ?? 0;
      }
    }

    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, name_en, category')
      .eq('operator_id', operatorId)
      .not('name_en', 'is', null)
      .order('category', { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      operatorId,
      updatedCount,
      products: products?.slice(0, 20),
    });
  } catch (error) {
    console.error('Error updating products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
