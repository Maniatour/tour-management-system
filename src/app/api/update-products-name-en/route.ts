import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Update products with English names
    const updates = [
      // Grand Circle Tours
      { pattern: '%그랜드서클%1박%2일%', name_en: 'Grand Circle 1 Night 2 Days Tour' },
      { pattern: '%그랜드서클%당일%', name_en: 'Grand Circle Day Tour' },
      { pattern: '%그랜드서클%3박%4일%', name_en: 'Grand Circle 3 Nights 4 Days Tour' },
      { pattern: '%그랜드서클%', name_en: 'Grand Circle Tour' },
      
      // Goblin Tours
      { pattern: '%도깨비%일출%엔텔롭%', name_en: 'Goblin Grand Canyon Sunrise Tour + Antelope Canyon' },
      { pattern: '%도깨비%일출%앤텔롭%', name_en: 'Goblin Grand Canyon Sunrise Tour + Antelope Canyon' },
      { pattern: '%도깨비%일출%', name_en: 'Goblin Grand Canyon Sunrise Tour' },
      { pattern: '%도깨비%', name_en: 'Goblin Tour' },
      
      // Night Tours
      { pattern: '%야경투어%', name_en: 'Night Tour' },
      
      // West Rim Tours
      { pattern: '%웨스트림%', name_en: 'West Rim Tour' },
      
      // Airport Services
      { pattern: '%공항%픽업%', name_en: 'Airport Pickup Service' },
      
      // Valley Tours
      { pattern: '%불의%계곡%', name_en: 'Valley of Fire Tour' },
      { pattern: '%모뉴먼트%밸리%', name_en: 'Monument Valley Tour' },
      
      // Canyon Tours
      { pattern: '%자이언%캐니언%', name_en: 'Zion Canyon Tour' },
      { pattern: '%브라이스%캐니언%', name_en: 'Bryce Canyon Tour' },
      { pattern: '%앤텔롭%캐니언%', name_en: 'Antelope Canyon Tour' },
      { pattern: '%엔텔롭%캐니언%', name_en: 'Antelope Canyon Tour' },
      { pattern: '%앤틸롭%캐니언%', name_en: 'Antelope Canyon Tour' },
      
      // Grand Canyon Tours
      { pattern: '%그랜드캐년%', name_en: 'Grand Canyon Tour' },
      
      // Las Vegas Tours
      { pattern: '%라스베가스%', name_en: 'Las Vegas Tour' },
      
      // Hoover Dam Tours
      { pattern: '%후버댐%', name_en: 'Hoover Dam Tour' },
      
      // Death Valley Tours
      { pattern: '%데쓰밸리%', name_en: 'Death Valley Tour' },
      
      // Multi-day Tours
      { pattern: '%2박%3일%', name_en: '2 Nights 3 Days Tour' },
      { pattern: '%3박%4일%', name_en: '3 Nights 4 Days Tour' }
    ];

    let updatedCount = 0;
    
    for (const update of updates) {
      const { data, error } = await supabase
        .from('products')
        .update({ name_en: update.name_en })
        .like('name', update.pattern)
        .is('name_en', null);
      
      if (error) {
        console.error(`Error updating products with pattern ${update.pattern}:`, error);
      } else {
        updatedCount += data?.length || 0;
        console.log(`Updated ${data?.length || 0} products with pattern ${update.pattern}`);
      }
    }

    // Get updated products to verify
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, name_en, category')
      .not('name_en', 'is', null)
      .order('category', { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      updatedCount,
      products: products?.slice(0, 20) // Show first 20 products
    });

  } catch (error) {
    console.error('Error updating products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
