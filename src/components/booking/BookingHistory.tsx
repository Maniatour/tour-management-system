'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface BookingHistoryItem {
  id: string;
  booking_type: 'ticket' | 'hotel';
  booking_id: string;
  action: 'created' | 'updated' | 'cancelled' | 'confirmed';
  old_values: any;
  new_values: any;
  changed_by: string;
  changed_at: string;
  reason: string;
}

interface BookingHistoryProps {
  bookingType: 'ticket' | 'hotel';
  bookingId: string;
  onClose: () => void;
}

export default function BookingHistory({ bookingType, bookingId, onClose }: BookingHistoryProps) {
  const [history, setHistory] = useState<BookingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [bookingType, bookingId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('booking_history')
        .select('*')
        .eq('booking_type', bookingType)
        .eq('booking_id', bookingId)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('부킹 히스토리 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'created': return '생성';
      case 'updated': return '수정';
      case 'cancelled': return '취소';
      case 'confirmed': return '확정';
      default: return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return 'bg-green-100 text-green-800';
      case 'updated': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'confirmed': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatChanges = (oldValues: any, newValues: any) => {
    if (!oldValues || !newValues) return [];

    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
    const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

    allKeys.forEach(key => {
      if (oldValues[key] !== newValues[key]) {
        changes.push({
          field: key,
          oldValue: oldValues[key],
          newValue: newValues[key]
        });
      }
    });

    return changes;
  };

  const getFieldDisplayName = (field: string) => {
    const fieldNames: { [key: string]: string } = {
      category: '카테고리',
      submitted_by: '제출자',
      check_in_date: '체크인 날짜',
      time: '시간',
      company: '공급업체',
      ea: '수량',
      expense: '비용',
      income: '수입',
      payment_method: '결제 방법',
      rn_number: 'RN#',
      tour_id: '투어 ID',
      note: '메모',
      status: '상태',
      season: '시즌',
      event_date: '이벤트 날짜',
      check_out_date: '체크아웃 날짜',
      reservation_name: '예약명',
      cc: 'CC',
      rooms: '객실 수',
      city: '도시',
      hotel: '호텔명',
      room_type: '객실 타입',
      unit_price: '단가',
      total_price: '총 가격',
      website: '웹사이트'
    };

    return fieldNames[field] || field;
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? '예' : '아니오';
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'string' && value.length > 50) {
      return value.substring(0, 50) + '...';
    }
    return String(value);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-center items-center h-64">
            <div className="text-lg">로딩 중...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {bookingType === 'ticket' ? '입장권' : '투어 호텔'} 부킹 히스토리
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            변경 이력이 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item, index) => (
              <div key={item.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionColor(item.action)}`}>
                      {getActionText(item.action)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(item.changed_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    변경자: {item.changed_by}
                  </div>
                </div>

                {item.action === 'created' && item.new_values && (
                  <div className="mt-2">
                    <h4 className="font-medium text-gray-900 mb-2">생성된 데이터:</h4>
                    <div className="bg-green-50 p-3 rounded">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(item.new_values, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {item.action === 'updated' && item.old_values && item.new_values && (
                  <div className="mt-2">
                    <h4 className="font-medium text-gray-900 mb-2">변경 사항:</h4>
                    <div className="space-y-2">
                      {formatChanges(item.old_values, item.new_values).map((change, changeIndex) => (
                        <div key={changeIndex} className="bg-blue-50 p-3 rounded">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-blue-900">
                              {getFieldDisplayName(change.field)}
                            </span>
                            <span className="text-blue-600">→</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-red-600 font-medium">이전:</span>
                              <div className="bg-red-100 p-2 rounded mt-1">
                                {formatValue(change.oldValue)}
                              </div>
                            </div>
                            <div>
                              <span className="text-green-600 font-medium">변경 후:</span>
                              <div className="bg-green-100 p-2 rounded mt-1">
                                {formatValue(change.newValue)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {item.action === 'cancelled' && item.old_values && (
                  <div className="mt-2">
                    <h4 className="font-medium text-gray-900 mb-2">취소된 데이터:</h4>
                    <div className="bg-red-50 p-3 rounded">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(item.old_values, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {item.reason && (
                  <div className="mt-2">
                    <h4 className="font-medium text-gray-900 mb-1">변경 사유:</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                      {item.reason}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
