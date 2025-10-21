import { supabase } from '@/lib/supabase';

// 새로운 간결한 타입 정의
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
  choice_group: string;
  choice_group_ko: string;
  choice_type: 'single' | 'multiple' | 'quantity';
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  options: ChoiceOption[];
}

interface SelectedChoice {
  choice_id: string;
  option_id: string;
  option_key: string;
  option_name_ko: string;
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
  totalPeople: number;
  choicesTotal: number;
}

// 예약 저장 함수
export async function saveReservation(data: ReservationData, reservationId?: string) {
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

    // 2. 기존 초이스 선택 삭제 (업데이트인 경우)
    if (reservationId) {
      const { error: deleteError } = await supabase
        .from('reservation_choices')
        .delete()
        .eq('reservation_id', reservationId);

      if (deleteError) throw deleteError;
    }

    // 3. 새로운 초이스 선택 저장
    if (data.selectedChoices.length > 0) {
      const choicesToInsert = data.selectedChoices.map(choice => ({
        reservation_id: reservationResult.id,
        choice_id: choice.choice_id,
        option_id: choice.option_id,
        quantity: choice.quantity,
        total_price: choice.total_price
      }));

      const { error: choicesError } = await supabase
        .from('reservation_choices')
        .insert(choicesToInsert);

      if (choicesError) throw choicesError;
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

// 예약 조회 함수 (초이스 포함)
export async function getReservationWithChoices(reservationId: string) {
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
        created_at,
        updated_at
      `)
      .eq('id', reservationId)
      .single();

    if (reservationError) throw reservationError;

    // 초이스 선택 조회
    const { data: choices, error: choicesError } = await supabase
      .from('reservation_choices')
      .select(`
        choice_id,
        option_id,
        quantity,
        total_price,
        choice:product_choices!inner (
          choice_group,
          choice_group_ko,
          choice_type
        ),
        option:choice_options!inner (
          option_key,
          option_name,
          option_name_ko,
          adult_price,
          child_price,
          infant_price,
          capacity
        )
      `)
      .eq('reservation_id', reservationId);

    if (choicesError) throw choicesError;

    // 초이스를 그룹별로 정리
    const choicesByGroup = (choices || []).reduce((acc: any, choice: any) => {
      const groupKey = choice.choice.choice_group;
      if (!acc[groupKey]) {
        acc[groupKey] = {
          name: choice.choice.choice_group_ko,
          type: choice.choice.choice_type,
          selections: []
        };
      }
      acc[groupKey].selections.push({
        option_key: choice.option.option_key,
        option_name: choice.option.option_name_ko,
        quantity: choice.quantity,
        total_price: choice.total_price,
        capacity: choice.option.capacity
      });
      return acc;
    }, {});

    return {
      success: true,
      reservation: {
        ...reservation,
        choices: choicesByGroup
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

// 상품의 초이스 조회 함수
export async function getProductChoices(productId: string) {
  try {
    const { data, error } = await supabase
      .from('product_choices')
      .select(`
        id,
        choice_group,
        choice_group_ko,
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
      .order('sort_order');

    if (error) throw error;

    return {
      success: true,
      choices: data || []
    };

  } catch (error) {
    console.error('상품 초이스 조회 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}

// 예약 목록 조회 함수 (초이스 요약 포함)
export async function getReservationsWithChoicesSummary(limit = 50, offset = 0) {
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
        created_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (reservationsError) throw reservationsError;

    // 각 예약의 초이스 요약 조회
    const reservationsWithChoices = await Promise.all(
      (reservations || []).map(async (reservation) => {
        const { data: choicesSummary } = await supabase
          .from('reservation_choices')
          .select(`
            quantity,
            choice:product_choices!inner (
              choice_group_ko
            ),
            option:choice_options!inner (
              option_name_ko
            )
          `)
          .eq('reservation_id', reservation.id);

        const choicesText = (choicesSummary || [])
          .map(choice => `${choice.option.option_name_ko} × ${choice.quantity}`)
          .join(', ');

        return {
          ...reservation,
          choices_summary: choicesText
        };
      })
    );

    return {
      success: true,
      reservations: reservationsWithChoices
    };

  } catch (error) {
    console.error('예약 목록 조회 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}
