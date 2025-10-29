import { supabase } from '@/lib/supabase';

// 하이브리드 시스템 타입 정의
interface ChoiceOption {
  id: string;
  option_key: string;
  option_name: string;
  option_name_ko: string;
  adult_price: number;
  child_price: number;
  infant_price: number;
  capacity: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

interface ProductChoice {
  id: string;
  choice_name: string;
  choice_name_ko: string;
  choice_type: 'single' | 'multiple' | 'quantity';
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  options: ChoiceOption[];
}

interface ProductOption {
  id: string;
  name: string;
  description: string;
  is_required: boolean;
  is_multiple: boolean;
  choice_name: string;
  choice_description: string;
  adult_price_adjustment: number;
  child_price_adjustment: number;
  infant_price_adjustment: number;
  is_default: boolean;
}

interface SelectedChoice {
  choice_id: string;
  choice_option_id: string;
  option_key: string;
  option_name_ko: string;
  quantity: number;
  total_price: number;
}

interface SelectedOption {
  option_id: string;
  option_name: string;
  quantity: number;
  total_price: number;
}

interface ReservationData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  adults: number;
  children: number;
  infants: number;
  productId: string;
  tourDate: string;
  channelId: string;
  notes: string;
  selectedChoices: SelectedChoice[];
  selectedOptions: SelectedOption[];
  totalPeople: number;
  choicesTotal: number;
  optionsTotal: number;
}

// 상품의 choices와 options 조회
export async function getProductChoicesAndOptions(productId: string) {
  try {
    // Choices 조회
    const { data: choices, error: choicesError } = await supabase
      .from('product_choices')
      .select(`
        id,
        choice_name,
        choice_name_ko,
        choice_type,
        is_required,
        min_selections,
        max_selections,
        sort_order,
        options:choice_options (
          id,
          option_key,
          option_name,
          option_name_ko,
          adult_price,
          child_price,
          infant_price,
          capacity,
          is_default,
          is_active,
          sort_order
        )
      `)
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    if (choicesError) {
      console.error('Choices 조회 오류:', choicesError);
      throw choicesError;
    }

    // Options 조회 (기존 product_options 테이블 사용)
    const { data: options, error: optionsError } = await supabase
      .from('product_options')
      .select(`
        id,
        name,
        description,
        is_required,
        is_multiple,
        choice_name,
        choice_description,
        adult_price_adjustment,
        child_price_adjustment,
        infant_price_adjustment,
        is_default
      `)
      .eq('product_id', productId)
      .order('name');

    if (optionsError) throw optionsError;

    return {
      success: true,
      choices: choices || [],
      options: options || []
    };

  } catch (error) {
    console.error('상품 choices/options 조회 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}

// 예약 저장 (하이브리드 시스템)
export async function saveReservationHybrid(data: ReservationData, reservationId?: string) {
  try {
    // 1. 예약 기본 정보 저장/업데이트
    const reservationData = {
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone,
      adults: data.adults,
      children: data.children,
      infants: data.infants,
      product_id: data.productId,
      tour_date: data.tourDate,
      channel_id: data.channelId,
      notes: data.notes,
      status: 'pending',
      total_people: data.totalPeople,
      choices_total: data.choicesTotal,
      options_total: data.optionsTotal,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let reservationResult;
    if (reservationId) {
      // 기존 예약 업데이트
      const { data: updatedReservation, error: updateError } = await supabase
        .from('reservations')
        .update(reservationData)
        .eq('id', reservationId)
        .select()
        .single();

      if (updateError) throw updateError;
      reservationResult = updatedReservation;
    } else {
      // 새 예약 생성
      const { data: newReservation, error: createError } = await supabase
        .from('reservations')
        .insert(reservationData)
        .select()
        .single();

      if (createError) throw createError;
      reservationResult = newReservation;
    }

    // 2. 기존 선택사항 삭제 (업데이트인 경우)
    if (reservationId) {
      const { error: deleteError } = await supabase
        .from('reservation_selections')
        .delete()
        .eq('reservation_id', reservationId);

      if (deleteError) throw deleteError;
    }

    // 3. 새로운 선택사항 저장
    const selectionsToInsert: any[] = [];

    // Choices 저장
    data.selectedChoices.forEach(choice => {
      selectionsToInsert.push({
        reservation_id: reservationResult.id,
        selection_type: 'choice',
        choice_id: choice.choice_id,
        choice_option_id: choice.choice_option_id,
        quantity: choice.quantity,
        total_price: choice.total_price
      });
    });

    // Options 저장
    data.selectedOptions.forEach(option => {
      selectionsToInsert.push({
        reservation_id: reservationResult.id,
        selection_type: 'option',
        option_id: option.option_id,
        quantity: option.quantity,
        total_price: option.total_price
      });
    });

    if (selectionsToInsert.length > 0) {
      const { error: selectionsError } = await supabase
        .from('reservation_selections')
        .insert(selectionsToInsert);

      if (selectionsError) throw selectionsError;
    }

    return {
      success: true,
      reservation: reservationResult,
      message: reservationId ? '예약이 수정되었습니다.' : '예약이 생성되었습니다.'
    };

  } catch (error) {
    console.error('예약 저장 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      message: '예약 저장에 실패했습니다.'
    };
  }
}

// 예약 조회 (하이브리드 시스템)
export async function getReservationHybrid(reservationId: string) {
  try {
    // 예약 기본 정보 조회
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select(`
        id,
        customer_name,
        customer_email,
        customer_phone,
        adults,
        children,
        infants,
        product_id,
        tour_date,
        channel_id,
        notes,
        status,
        total_people,
        choices_total,
        options_total,
        created_at,
        updated_at
      `)
      .eq('id', reservationId)
      .single();

    if (reservationError) throw reservationError;

    // 선택사항 조회
    const { data: selections, error: selectionsError } = await supabase
      .from('reservation_selections')
      .select(`
        selection_type,
        quantity,
        total_price,
        choice:product_choices!inner (
          choice_name,
          choice_name_ko,
          choice_type
        ),
        choice_option:choice_options!inner (
          option_key,
          option_name_ko,
          capacity
        ),
        option:product_options!inner (
          name,
          description,
          adult_price_adjustment,
          child_price_adjustment,
          infant_price_adjustment
        )
      `)
      .eq('reservation_id', reservationId);

    if (selectionsError) throw selectionsError;

    // 선택사항을 choices와 options로 분리
    const choices: SelectedChoice[] = [];
    const options: SelectedOption[] = [];

    (selections || []).forEach(selection => {
      if (selection.selection_type === 'choice') {
        choices.push({
          choice_id: selection.choice.id,
          choice_option_id: selection.choice_option.id,
          option_key: selection.choice_option.option_key,
          option_name_ko: selection.choice_option.option_name_ko,
          quantity: selection.quantity,
          total_price: selection.total_price
        });
      } else if (selection.selection_type === 'option') {
        options.push({
          option_id: selection.option.id,
          option_name: selection.option.name,
          quantity: selection.quantity,
          total_price: selection.total_price
        });
      }
    });

    return {
      success: true,
      reservation: {
        ...reservation,
        selectedChoices: choices,
        selectedOptions: options
      }
    };

  } catch (error) {
    console.error('예약 조회 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}

// 예약 목록 조회 (하이브리드 시스템)
export async function getReservationsHybrid(limit = 50, offset = 0) {
  try {
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select(`
        id,
        customer_name,
        customer_email,
        adults,
        children,
        infants,
        product_id,
        tour_date,
        channel_id,
        status,
        total_people,
        choices_total,
        options_total,
        created_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (reservationsError) throw reservationsError;

    // 각 예약의 선택사항 요약 조회
    const reservationsWithSelections = await Promise.all(
      (reservations || []).map(async (reservation) => {
        const { data: selectionsSummary } = await supabase
          .from('reservation_selections')
          .select(`
            selection_type,
            quantity,
            choice:product_choices!inner (
              choice_name_ko
            ),
            choice_option:choice_options!inner (
              option_name_ko
            ),
            option:product_options!inner (
              name
            )
          `)
          .eq('reservation_id', reservation.id);

        const choicesText = (selectionsSummary || [])
          .filter(s => s.selection_type === 'choice')
          .map(s => `${s.choice_option.option_name_ko} × ${s.quantity}`)
          .join(', ');

        const optionsText = (selectionsSummary || [])
          .filter(s => s.selection_type === 'option')
          .map(s => `${s.option.name} × ${s.quantity}`)
          .join(', ');

        return {
          ...reservation,
          choices_summary: choicesText,
          options_summary: optionsText
        };
      })
    );

    return {
      success: true,
      reservations: reservationsWithSelections
    };

  } catch (error) {
    console.error('예약 목록 조회 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}

// 기존 JSONB choices를 새로운 구조로 마이그레이션하는 함수
export async function migrateExistingChoicesToHybrid() {
  try {
    // 기존 products의 choices 데이터를 새로운 구조로 변환
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, choices')
      .not('choices', 'is', null);

    if (productsError) throw productsError;

    for (const product of products || []) {
      if (product.choices?.required) {
        for (const choice of product.choices.required) {
          // Choice 생성
          const { data: newChoice, error: choiceError } = await supabase
            .from('product_choices')
            .insert({
              product_id: product.id,
              choice_name: choice.id,
              choice_name_ko: choice.name_ko || choice.name,
              choice_type: choice.type === 'multiple_quantity' ? 'quantity' : 'single',
              is_required: true,
              min_selections: choice.validation?.min_selections || 1,
              max_selections: choice.validation?.max_selections || 1
            })
            .select()
            .single();

          if (choiceError) {
            console.error(`Choice 생성 오류 (${product.id}):`, choiceError);
            continue;
          }

          // Choice Options 생성
          if (choice.options) {
            for (const option of choice.options) {
              await supabase
                .from('choice_options')
                .insert({
                  choice_id: newChoice.id,
                  option_key: option.id,
                  option_name: option.name,
                  option_name_ko: option.name_ko || option.name,
                  adult_price: option.adult_price || 0,
                  child_price: option.child_price || 0,
                  infant_price: option.infant_price || 0,
                  capacity: option.capacity_per_room || 1,
                  is_default: option.is_default || false
                });
            }
          }
        }
      }
    }

    return {
      success: true,
      message: '기존 choices 데이터가 새로운 구조로 마이그레이션되었습니다.'
    };

  } catch (error) {
    console.error('마이그레이션 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}
