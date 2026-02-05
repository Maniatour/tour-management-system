'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { DollarSign, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
}

interface SupplierTicketPurchase {
  id: string;
  supplier_id: string;
  supplier_product_id: string;
  booking_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  is_season_price: boolean;
  purchase_date: string;
  payment_status: string;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier_products: {
    ticket_name: string;
  };
}

interface SettlementSummary {
  supplier_id: string;
  supplier_name: string;
  total_purchases: number;
  total_amount: number;
  pending_amount: number;
  paid_amount: number;
  purchase_count: number;
  pending_count: number;
  paid_count: number;
}

export default function SettlementPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<SupplierTicketPurchase[]>([]);
  const [settlementSummary, setSettlementSummary] = useState<SettlementSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 공급업체 데이터 가져오기
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id, name, contact_person, phone, email')
        .eq('is_active', true)
        .order('name');

      if (suppliersError) throw suppliersError;

      // 구매 기록 데이터 가져오기 (공급업체 상품 정보 포함)
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('supplier_ticket_purchases')
        .select(`
          *,
          supplier_products (
            ticket_name
          )
        `)
        .order('purchase_date', { ascending: false });

      if (purchasesError) throw purchasesError;

      setSuppliers(suppliersData || []);
      setPurchases(purchasesData || []);
      
      // 정산 요약 계산
      calculateSettlementSummary(suppliersData || [], purchasesData || []);
    } catch (error) {
      console.error('데이터 로딩 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSettlementSummary = (suppliers: Supplier[], purchases: SupplierTicketPurchase[]) => {
    const summary: SettlementSummary[] = suppliers.map(supplier => {
      const supplierPurchases = purchases.filter(p => p.supplier_id === supplier.id);
      
      const totalAmount = supplierPurchases.reduce((sum, p) => sum + p.total_amount, 0);
      const pendingAmount = supplierPurchases
        .filter(p => p.payment_status === 'pending')
        .reduce((sum, p) => sum + p.total_amount, 0);
      const paidAmount = supplierPurchases
        .filter(p => p.payment_status === 'paid')
        .reduce((sum, p) => sum + p.total_amount, 0);

      return {
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        total_purchases: supplierPurchases.length,
        total_amount: totalAmount,
        pending_amount: pendingAmount,
        paid_amount: paidAmount,
        purchase_count: supplierPurchases.length,
        pending_count: supplierPurchases.filter(p => p.payment_status === 'pending').length,
        paid_count: supplierPurchases.filter(p => p.payment_status === 'paid').length
      };
    });

    setSettlementSummary(summary);
  };

  const handlePaymentStatusUpdate = async (purchaseId: string, status: string) => {
    try {
      const updateData: any = { payment_status: status };
      if (status === 'paid') {
        updateData.payment_date = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('supplier_ticket_purchases')
        .update(updateData)
        .eq('id', purchaseId);

      if (error) throw error;

      // 데이터 새로고침
      fetchData();
    } catch (error) {
      console.error('결제 상태 업데이트 오류:', error);
    }
  };

  const getFilteredPurchases = () => {
    let filtered = purchases;

    if (selectedSupplier) {
      filtered = filtered.filter(p => p.supplier_id === selectedSupplier);
    }

    if (dateRange.start) {
      filtered = filtered.filter(p => p.purchase_date >= dateRange.start);
    }

    if (dateRange.end) {
      filtered = filtered.filter(p => p.purchase_date <= dateRange.end);
    }

    return filtered;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return '지급완료';
      case 'pending':
        return '미지급';
      case 'cancelled':
        return '취소';
      default:
        return '알 수 없음';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] sm:h-64 p-4">
        <div className="text-sm sm:text-lg text-gray-500">불러오는 중...</div>
      </div>
    );
  }

  const filteredPurchases = getFilteredPurchases();
  const totalPendingAmount = settlementSummary.reduce((sum, s) => sum + s.pending_amount, 0);
  const totalPaidAmount = settlementSummary.reduce((sum, s) => sum + s.paid_amount, 0);

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900">공급업체 정산 관리</h1>
      </div>

      {/* 전체 요약 - 모바일 컴팩트 */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6 mb-4 sm:mb-6 lg:mb-8">
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <div className="p-1.5 sm:p-2 lg:p-3 bg-blue-100 rounded-full w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center">
              <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 truncate">총 지급액</p>
              <p className="text-base sm:text-2xl font-bold text-gray-900 truncate">${totalPaidAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <div className="p-1.5 sm:p-2 lg:p-3 bg-yellow-100 rounded-full w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center">
              <Clock className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 truncate">미지급액</p>
              <p className="text-base sm:text-2xl font-bold text-gray-900 truncate">${totalPendingAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <div className="p-1.5 sm:p-2 lg:p-3 bg-green-100 rounded-full w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center">
              <Calendar className="w-4 h-4 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 truncate">구매 건수</p>
              <p className="text-base sm:text-2xl font-bold text-gray-900">{purchases.length}건</p>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 - 모바일 컴팩트 */}
      <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">공급업체</label>
            <select
              value={selectedSupplier || ''}
              onChange={(e) => setSelectedSupplier(e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">시작일</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">종료일</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 공급업체별 요약 */}
      <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">공급업체별 정산 요약</h2>

        {/* 모바일: 카드 리스트 */}
        <div className="md:hidden space-y-2">
          {settlementSummary.map((summary) => (
            <div
              key={summary.supplier_id}
              className="border border-gray-200 rounded-lg p-3 space-y-2"
            >
              <p className="font-medium text-gray-900 truncate text-sm">{summary.supplier_name}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:text-sm">
                <span className="text-gray-500">총 구매액</span>
                <span className="text-right font-medium">${summary.total_amount.toLocaleString()}</span>
                <span className="text-gray-500">지급완료</span>
                <span className="text-right text-green-600">${summary.paid_amount.toLocaleString()}</span>
                <span className="text-gray-500">미지급</span>
                <span className="text-right text-yellow-600">${summary.pending_amount.toLocaleString()}</span>
                <span className="text-gray-500">건수</span>
                <span className="text-right text-gray-600">{summary.purchase_count}건</span>
              </div>
            </div>
          ))}
        </div>

        {/* 데스크톱: 테이블 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">공급업체</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">총 구매액</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">지급완료</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">미지급</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">구매 건수</th>
              </tr>
            </thead>
            <tbody>
              {settlementSummary.map((summary) => (
                <tr key={summary.supplier_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">
                    {summary.supplier_name}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900">
                    ${summary.total_amount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right text-green-600">
                    ${summary.paid_amount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right text-yellow-600">
                    ${summary.pending_amount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {summary.purchase_count}건
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 구매 기록 상세 */}
      <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6">
        <h2 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">구매 기록 상세</h2>

        {/* 모바일: 카드 리스트 */}
        <div className="md:hidden space-y-3">
          {filteredPurchases.map((purchase) => {
            const supplier = suppliers.find(s => s.id === purchase.supplier_id);
            return (
              <div
                key={purchase.id}
                className="border border-gray-200 rounded-lg p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {purchase.supplier_products?.ticket_name || '알 수 없음'}
                      {purchase.is_season_price && (
                        <span className="ml-1 text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded">시즌</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{supplier?.name || '알 수 없음'}</p>
                  </div>
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${getStatusColor(purchase.payment_status)}`}>
                    {getStatusIcon(purchase.payment_status)}
                    {getStatusText(purchase.payment_status)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-gray-600">
                  <span>구매일</span>
                  <span className="text-right">{new Date(purchase.purchase_date).toLocaleDateString()}</span>
                  <span>수량 / 단가</span>
                  <span className="text-right">{purchase.quantity}개 × ${purchase.unit_price.toLocaleString()}</span>
                  <span>총액</span>
                  <span className="text-right font-medium text-gray-900">${purchase.total_amount.toLocaleString()}</span>
                </div>
                {(purchase.payment_status === 'pending' || purchase.payment_status === 'paid') && (
                  <div className="pt-1 border-t border-gray-100">
                    {purchase.payment_status === 'pending' && (
                      <button
                        onClick={() => handlePaymentStatusUpdate(purchase.id, 'paid')}
                        className="w-full py-1.5 text-green-600 hover:text-green-800 text-xs font-medium"
                      >
                        지급완료
                      </button>
                    )}
                    {purchase.payment_status === 'paid' && (
                      <button
                        onClick={() => handlePaymentStatusUpdate(purchase.id, 'pending')}
                        className="w-full py-1.5 text-yellow-600 hover:text-yellow-800 text-xs font-medium"
                      >
                        미지급으로 변경
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 데스크톱: 테이블 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">구매일</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">공급업체</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">티켓명</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">수량</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">단가</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">총액</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">상태</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">액션</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map((purchase) => {
                const supplier = suppliers.find(s => s.id === purchase.supplier_id);
                return (
                  <tr key={purchase.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">
                      {new Date(purchase.purchase_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-gray-900">
                      {supplier?.name || '알 수 없음'}
                    </td>
                    <td className="py-3 px-4 text-gray-900">
                      {purchase.supplier_products?.ticket_name || '알 수 없음'}
                      {purchase.is_season_price && (
                        <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                          시즌가
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900">
                      {purchase.quantity}개
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900">
                      ${purchase.unit_price.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900 font-medium">
                      ${purchase.total_amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(purchase.payment_status)}`}>
                        {getStatusIcon(purchase.payment_status)}
                        {getStatusText(purchase.payment_status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {purchase.payment_status === 'pending' && (
                        <button
                          onClick={() => handlePaymentStatusUpdate(purchase.id, 'paid')}
                          className="text-green-600 hover:text-green-800 text-sm font-medium"
                        >
                          지급완료
                        </button>
                      )}
                      {purchase.payment_status === 'paid' && (
                        <button
                          onClick={() => handlePaymentStatusUpdate(purchase.id, 'pending')}
                          className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
                        >
                          미지급으로 변경
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredPurchases.length === 0 && (
          <div className="text-center py-6 sm:py-8 text-gray-500 text-sm">
            선택한 조건에 맞는 구매 기록이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
