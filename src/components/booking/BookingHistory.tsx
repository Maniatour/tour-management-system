'use client';

import React, { useState, useEffect } from 'react';
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
  const [teamMemberMap, setTeamMemberMap] = useState<Map<string, string>>(new Map());

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
      
      // 수정 날짜와 시간 순으로 정렬 (최신순)
      const sortedHistory = (data || []).sort((a, b) => {
        const dateA = new Date(a.changed_at).getTime();
        const dateB = new Date(b.changed_at).getTime();
        return dateB - dateA; // 내림차순 (최신순)
      });
      
      setHistory(sortedHistory);

      // changed_by 이메일로 team 테이블에서 name_ko 조회
      const changedByEmails = [...new Set(
        (sortedHistory || [])
          .map((item) => item.changed_by)
          .filter((email): email is string => !!email && typeof email === 'string' && email.includes('@'))
      )];

      if (changedByEmails.length > 0) {
        try {
          const { data: teamData, error: teamError } = await supabase
            .from('team')
            .select('email, name_ko')
            .in('email', changedByEmails);

          if (!teamError && teamData) {
            const emailToNameMap = new Map<string, string>();
            (teamData || []).forEach((member: { email: string; name_ko: string | null }) => {
              if (member.email && member.name_ko) {
                emailToNameMap.set(member.email.toLowerCase(), member.name_ko);
              }
            });
            setTeamMemberMap(emailToNameMap);
          } else {
            console.warn('Team 정보 조회 오류:', teamError);
            setTeamMemberMap(new Map());
          }
        } catch (error) {
          console.error('Team 정보 조회 중 오류:', error);
          setTeamMemberMap(new Map());
        }
      }
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

  // 테이블 뷰와 동일한 컬럼 순서 정의
  const getTableColumns = () => {
    return [
      { key: 'action', label: '작업', className: 'sticky left-0 bg-gray-50 z-10' },
      { key: 'status', label: '상태', className: 'sticky left-[80px] bg-gray-50 z-10' },
      { key: 'company', label: '공급업체' },
      { key: 'check_in_date', label: '날짜' },
      { key: 'time', label: '시간' },
      { key: 'ea', label: '수량' },
      { key: 'expense', label: '비용(USD)', className: 'hidden lg:table-cell' },
      { key: 'income', label: '수입(USD)', className: 'hidden lg:table-cell' },
      { key: 'rn_number', label: 'RN#', className: 'hidden md:table-cell' },
      { key: 'payment_method', label: '결제방법', className: 'hidden lg:table-cell' },
      { key: 'cc', label: 'CC', className: 'hidden md:table-cell' },
      { key: 'tour_id', label: '투어연결', className: 'hidden lg:table-cell' },
      { key: 'submit_on', label: '제출일' },
      { key: 'submitted_by', label: '예약자', className: 'hidden md:table-cell' },
      { key: 'changed_at', label: '수정날짜' },
      { key: 'changed_time', label: '수정시간' },
      { key: 'changed_by', label: '변경자', className: 'hidden md:table-cell' },
    ];
  };

  // 상태 텍스트 변환
  const getStatusText = (status: string) => {
    const normalizedStatus = status?.toLowerCase();
    switch (normalizedStatus) {
      case 'pending': return '대기';
      case 'confirmed': return '확정';
      case 'cancelled':
      case 'canceled': return '취소';
      case 'completed': return '완료';
      default: return status || '-';
    }
  };

  // 상태 색상
  const getStatusColor = (status: string) => {
    const normalizedStatus = status?.toLowerCase();
    switch (normalizedStatus) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'cancelled':
      case 'canceled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 결제 방법 텍스트 변환
  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'credit_card': return '신용카드';
      case 'bank_transfer': return '계좌이체';
      case 'cash': return '현금';
      case 'other': return '기타';
      default: return method || '-';
    }
  };

  // CC 상태 텍스트
  const getCCStatusText = (cc: string) => {
    switch (cc) {
      case 'sent': return 'CC 발송 완료';
      case 'not_sent': return '미발송';
      case 'not_needed': return '필요없음';
      default: return cc || '-';
    }
  };

  // CC 상태 색상
  const getCCStatusColor = (cc: string) => {
    switch (cc) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'not_sent': return 'bg-yellow-100 text-yellow-800';
      case 'not_needed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 컬럼 값 가져오기
  const getColumnValue = (data: any, columnKey: string) => {
    switch (columnKey) {
      case 'status':
        return { 
          display: getStatusText(data[columnKey]), 
          isBadge: true,
          color: getStatusColor(data[columnKey])
        };
      case 'check_in_date':
        return { 
          display: data[columnKey] ? new Date(data[columnKey]).toISOString().split('T')[0] : '-',
          isBadge: false
        };
      case 'time':
        return { 
          display: data[columnKey]?.replace(/:\d{2}$/, '') || '-',
          isBadge: false
        };
      case 'ea':
        return { 
          display: `${data[columnKey] || 0}개`,
          isBadge: false
        };
      case 'expense':
        return { 
          display: `$${data[columnKey] || '-'}`,
          isBadge: false
        };
      case 'income':
        return { 
          display: `$${data[columnKey] || '-'}`,
          isBadge: false
        };
      case 'payment_method':
        return { 
          display: getPaymentMethodText(data[columnKey]),
          isBadge: false
        };
      case 'cc':
        return { 
          display: getCCStatusText(data[columnKey]),
          isBadge: true,
          color: getCCStatusColor(data[columnKey])
        };
      case 'submit_on':
        return { 
          display: data[columnKey] ? new Date(data[columnKey]).toISOString().split('T')[0] : '-',
          isBadge: false
        };
      case 'tour_id':
        return { 
          display: data[columnKey] ? '연결됨' : '미연결',
          isBadge: false
        };
      case 'submitted_by':
        return { 
          display: data[columnKey] || '-',
          isBadge: false
        };
      case 'action':
        // action은 별도로 처리
        return { 
          display: '',
          isBadge: false
        };
      case 'changed_at':
        // changed_at은 별도로 처리
        return { 
          display: '',
          isBadge: false
        };
      case 'changed_time':
        // changed_time은 별도로 처리
        return { 
          display: '',
          isBadge: false
        };
      default:
        return { 
          display: formatValue(data[columnKey]),
          isBadge: false
        };
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-center items-center h-64">
            <div className="text-lg">Loading...</div>
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
          <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {getTableColumns().map((column) => (
                      <th 
                        key={column.key}
                        className={`px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.className || ''}`}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.map((item) => {
                    // 각 히스토리 항목에 따라 표시할 데이터 결정
                    const displayData = item.action === 'cancelled' 
                      ? item.old_values 
                      : item.new_values || item.old_values;
                    
                    // 이전 데이터 (updated의 경우)
                    const oldData = item.action === 'updated' ? item.old_values : null;
                    
                    // 수정 날짜와 시간 포맷팅
                    const changedDate = new Date(item.changed_at);
                    const formattedDate = changedDate.toISOString().split('T')[0];
                    const formattedTime = changedDate.toTimeString().split(' ')[0].replace(/:\d{2}$/, '');
                    
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        {getTableColumns().map((column) => {
                          // 작업 컬럼
                          if (column.key === 'action') {
                            // 작업 컬럼의 배경색 결정
                            let actionBgColor = 'bg-white';
                            if (item.action === 'created') {
                              actionBgColor = 'bg-green-50';
                            } else if (item.action === 'cancelled') {
                              actionBgColor = 'bg-red-50';
                            }
                            
                            return (
                              <td 
                                key={column.key}
                                className={`px-2 py-1.5 whitespace-nowrap text-xs sticky left-0 z-10 ${actionBgColor}`}
                              >
                                <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${getActionColor(item.action)}`}>
                                  {getActionText(item.action)}
                                </span>
                              </td>
                            );
                          }
                          
                          // 수정날짜 컬럼
                          if (column.key === 'changed_at') {
                            return (
                              <td 
                                key={column.key}
                                className={`px-2 py-1.5 whitespace-nowrap text-xs ${column.className || ''}`}
                              >
                                <div className="text-gray-900">{formattedDate}</div>
                              </td>
                            );
                          }
                          
                          // 수정시간 컬럼
                          if (column.key === 'changed_time') {
                            return (
                              <td 
                                key={column.key}
                                className={`px-2 py-1.5 whitespace-nowrap text-xs ${column.className || ''}`}
                              >
                                <div className="text-gray-900">{formattedTime}</div>
                              </td>
                            );
                          }
                          
                          // 변경자 컬럼
                          if (column.key === 'changed_by') {
                            const changedByEmail = item.changed_by?.toLowerCase() || '';
                            const nameKo = teamMemberMap.get(changedByEmail) || item.changed_by || '-';
                            
                            // 배경색 결정
                            let bgColor = 'bg-white';
                            if (item.action === 'created') {
                              bgColor = 'bg-green-50';
                            } else if (item.action === 'cancelled') {
                              bgColor = 'bg-red-50';
                            }
                            
                            return (
                              <td 
                                key={column.key}
                                className={`px-2 py-1.5 whitespace-nowrap text-xs ${column.className || ''} ${bgColor}`}
                              >
                                <div className={item.action === 'cancelled' ? 'text-red-800' : item.action === 'created' ? 'text-green-800' : 'text-gray-900'}>
                                  {nameKo}
                                </div>
                              </td>
                            );
                          }
                          
                          // 나머지 컬럼들
                          const newValueInfo = getColumnValue(displayData, column.key);
                          const oldValueInfo = oldData ? getColumnValue(oldData, column.key) : null;
                          const isChanged = oldValueInfo && oldValueInfo.display !== newValueInfo.display;
                          
                          // 배경색 결정
                          let bgColor = 'bg-white';
                          if (item.action === 'created') {
                            bgColor = 'bg-green-50';
                          } else if (item.action === 'cancelled') {
                            bgColor = 'bg-red-50';
                          } else if (isChanged) {
                            bgColor = 'bg-yellow-50';
                          }
                          
                          // sticky 컬럼의 배경색 처리
                          let cellClassName = column.className || '';
                          if (column.className?.includes('sticky')) {
                            // sticky 컬럼은 기존 bg-gray-50을 제거하고 새로운 배경색 적용
                            cellClassName = column.className.replace('bg-gray-50', '').trim() + ` ${bgColor}`;
                          } else {
                            cellClassName = `${column.className || ''} ${bgColor}`;
                          }
                          
                          return (
                            <td 
                              key={column.key}
                              className={`px-2 py-1.5 whitespace-nowrap text-xs ${cellClassName}`}
                            >
                              {isChanged ? (
                                <div className="space-y-1">
                                  <div className={`text-red-600 line-through text-[10px] ${oldValueInfo?.isBadge ? 'inline-block' : ''}`}>
                                    {oldValueInfo?.isBadge ? (
                                      <span className={`inline-flex px-1 py-0.5 text-[10px] font-semibold rounded-full ${oldValueInfo.color}`}>
                                        {oldValueInfo.display}
                                      </span>
                                    ) : (
                                      oldValueInfo?.display
                                    )}
                                  </div>
                                  <div className={`${item.action === 'cancelled' ? 'text-red-800' : 'text-green-800'} font-medium ${newValueInfo.isBadge ? 'inline-block' : ''}`}>
                                    {newValueInfo.isBadge ? (
                                      <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${newValueInfo.color}`}>
                                        {newValueInfo.display}
                                      </span>
                                    ) : (
                                      newValueInfo.display
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className={item.action === 'cancelled' ? 'text-red-800' : item.action === 'created' ? 'text-green-800' : 'text-gray-900'}>
                                  {newValueInfo.isBadge ? (
                                    <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${newValueInfo.color}`}>
                                      {newValueInfo.display}
                                    </span>
                                  ) : (
                                    newValueInfo.display
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
