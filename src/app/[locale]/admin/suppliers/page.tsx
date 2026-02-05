'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit, Trash2, Eye, DollarSign, Calendar, Clock } from 'lucide-react';
import { updateDynamicPricingWithSupplierPrices } from '@/lib/supplierPricing';
import ProductSelector from '@/components/common/ProductSelector';

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SeasonDate {
  start: string;
  end: string;
}

interface SupplierProduct {
  id: string;
  supplier_id: string;
  product_id: string | null;
  option_id: string | null;
  choice_id: string | null;
  choice_option_id: string | null;
  ticket_name: string;
  regular_price: number;
  supplier_price: number;
  season_dates: SeasonDate[] | null;
  season_price: number | null;
  entry_times: string[] | null;
  markup_percent: number;
  markup_amount: number;
  adult_supplier_price: number | null;
  child_supplier_price: number | null;
  infant_supplier_price: number | null;
  adult_season_price: number | null;
  child_season_price: number | null;
  infant_season_price: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Choice {
  id: string;
  name: string;
  name_ko: string;
  options: ChoiceOption[];
}

interface Product {
  id: string;
  name: string;
  name_ko: string | null;
  category: string | null;
  sub_category: string | null;
  base_price: number | null;
  choices: {
    required?: Choice[];
    optional?: Choice[];
  } | null;
}

interface ChoiceOption {
  id: string;
  name: string;
  name_ko: string;
  price: number;
  is_default: boolean;
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
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<SupplierTicketPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 공급업체 데이터 가져오기
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (suppliersError) throw suppliersError;

      // 공급업체 상품 데이터 가져오기
      const { data: productsData, error: productsError } = await supabase
        .from('supplier_products')
        .select('*')
        .order('ticket_name');

      if (productsError) throw productsError;

      // 실제 상품 데이터 가져오기
      const { data: actualProductsData, error: actualProductsError } = await supabase
        .from('products')
        .select('id, name, name_ko, category, sub_category, base_price, choices')
        .eq('status', 'active')
        .order('name');

      if (actualProductsError) throw actualProductsError;

      // 구매 기록 데이터 가져오기
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('supplier_ticket_purchases')
        .select('*')
        .order('purchase_date', { ascending: false });

      if (purchasesError) throw purchasesError;

      setSuppliers(suppliersData || []);
      setSupplierProducts(productsData || []);
      setProducts(actualProductsData || []);
      setPurchases(purchasesData || []);
    } catch (error) {
      console.error('데이터 로딩 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSupplier = async (supplierData: Partial<Supplier>) => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert([supplierData] as any)
        .select()
        .single();

      if (error) throw error;

      setSuppliers([...suppliers, data]);
      setShowSupplierModal(false);
    } catch (error) {
      console.error('공급업체 생성 오류:', error);
    }
  };

  const handleUpdateSupplier = async (id: string, supplierData: Partial<Supplier>) => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .update(supplierData as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setSuppliers(suppliers.map(s => s.id === id ? data : s));
      setShowSupplierModal(false);
      setEditingSupplier(null);
    } catch (error) {
      console.error('공급업체 수정 오류:', error);
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('정말로 이 공급업체를 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuppliers(suppliers.filter(s => s.id !== id));
    } catch (error) {
      console.error('공급업체 삭제 오류:', error);
    }
  };

  const getSupplierProducts = (supplierId: string) => {
    return supplierProducts.filter(p => p.supplier_id === supplierId);
  };

  const getProductName = (supplierProduct: SupplierProduct) => {
    if (supplierProduct.product_id) {
      // 실제 상품과 연결된 경우
      const product = products.find(p => p.id === supplierProduct.product_id);
      if (product) {
        if (supplierProduct.choice_id && supplierProduct.choice_option_id) {
          // 선택 옵션이 있는 경우
          const choice = product.choices?.required?.find((c: Choice) => c.id === supplierProduct.choice_id);
          const choiceOption = choice?.options?.find((o: ChoiceOption) => o.id === supplierProduct.choice_option_id);
          if (choiceOption) {
            return `${product.name_ko || product.name} - ${choiceOption.name_ko || choiceOption.name}`;
          }
        }
        return product.name_ko || product.name;
      }
    }
    return supplierProduct.ticket_name;
  };

  const getSupplierPurchases = (supplierId: string) => {
    return purchases.filter(p => p.supplier_id === supplierId);
  };

  const calculateTotalSpent = (supplierId: string) => {
    const supplierPurchases = getSupplierPurchases(supplierId);
    return supplierPurchases.reduce((total, purchase) => total + purchase.total_amount, 0);
  };

  const calculatePendingAmount = (supplierId: string) => {
    const supplierPurchases = getSupplierPurchases(supplierId);
    return supplierPurchases
      .filter(p => p.payment_status === 'pending')
      .reduce((total, purchase) => total + purchase.total_amount, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">공급업체 관리</h1>
        <button
          onClick={() => {
            setEditingSupplier(null);
            setShowSupplierModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          공급업체 추가
        </button>
      </div>

      {/* 공급업체 목록 */}
      <div className="grid gap-6">
        {suppliers.map((supplier) => {
          const products = getSupplierProducts(supplier.id);
          const totalSpent = calculateTotalSpent(supplier.id);
          const pendingAmount = calculatePendingAmount(supplier.id);

          return (
            <div key={supplier.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{supplier.name}</h3>
                  <div className="text-sm text-gray-600 mt-1">
                    {supplier.contact_person && <span>담당자: {supplier.contact_person}</span>}
                    {supplier.phone && <span className="ml-4">전화: {supplier.phone}</span>}
                    {supplier.email && <span className="ml-4">이메일: {supplier.email}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedSupplier(supplier);
                      setShowProductModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 p-2"
                    title="상품 관리"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingSupplier(supplier);
                      setShowSupplierModal(true);
                    }}
                    className="text-green-600 hover:text-green-800 p-2"
                    title="수정"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSupplier(supplier.id)}
                    className="text-red-600 hover:text-red-800 p-2"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 정산 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm">총 지출</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    ${totalSpent.toLocaleString()}
                  </div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-600 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">미지급</span>
                  </div>
                  <div className="text-2xl font-bold text-yellow-700">
                    ${pendingAmount.toLocaleString()}
                  </div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">상품 수</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-700">
                    {products.length}개
                  </div>
                </div>
              </div>

              {/* 상품 목록 */}
              {products.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-2">제공 상품</h4>
                  <div className="grid gap-2">
                    {products.map((product) => (
                      <div key={product.id} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                        <div>
                          <span className="font-medium">{getProductName(product)}</span>
                          {product.entry_times && product.entry_times.length > 0 && (
                            <span className="text-sm text-gray-600 ml-2">
                              (입장시간: {product.entry_times.join(', ')})
                            </span>
                          )}
                          {(product.markup_percent > 0 || product.markup_amount > 0) && (
                            <span className="text-sm text-blue-600 ml-2">
                              (마크업: {product.markup_percent > 0 ? `${product.markup_percent}%` : ''} {product.markup_amount > 0 ? `+$${product.markup_amount}` : ''})
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">
                            성인: ${product.adult_supplier_price || product.supplier_price}
                            {product.child_supplier_price && (
                              <span className="ml-2">아동: ${product.child_supplier_price}</span>
                            )}
                            {product.infant_supplier_price && (
                              <span className="ml-2">유아: ${product.infant_supplier_price}</span>
                            )}
                          </div>
                          {(product.adult_season_price || product.child_season_price || product.infant_season_price) && (
                            <div className="text-sm text-orange-600">
                              시즌가: 
                              {product.adult_season_price && <span> 성인 ${product.adult_season_price}</span>}
                              {product.child_season_price && <span> 아동 ${product.child_season_price}</span>}
                              {product.infant_season_price && <span> 유아 ${product.infant_season_price}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 공급업체 모달 */}
      {showSupplierModal && (
        <SupplierModal
          supplier={editingSupplier}
          onSave={editingSupplier ? 
            (data) => handleUpdateSupplier(editingSupplier.id, data) : 
            handleCreateSupplier
          }
          onClose={() => {
            setShowSupplierModal(false);
            setEditingSupplier(null);
          }}
        />
      )}

      {/* 상품 관리 모달 */}
      {showProductModal && selectedSupplier && (
        <ProductModal
          supplier={selectedSupplier}
          products={getSupplierProducts(selectedSupplier.id)}
          onClose={() => {
            setShowProductModal(false);
            setSelectedSupplier(null);
          }}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
}

// 공급업체 모달 컴포넌트
function SupplierModal({ 
  supplier, 
  onSave, 
  onClose 
}: { 
  supplier: Supplier | null; 
  onSave: (data: Partial<Supplier>) => void; 
  onClose: () => void; 
}) {
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    contact_person: supplier?.contact_person || '',
    phone: supplier?.phone || '',
    email: supplier?.email || '',
    address: supplier?.address || '',
    notes: supplier?.notes || '',
    is_active: supplier?.is_active ?? true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {supplier ? '공급업체 수정' : '공급업체 추가'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              업체명 *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              담당자
            </label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전화번호
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              주소
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              메모
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
              className="mr-2"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              활성 상태
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              {supplier ? '수정' : '추가'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 상품 관리 모달 컴포넌트
function ProductModal({ 
  supplier, 
  products, 
  onClose, 
  onRefresh 
}: { 
  supplier: Supplier; 
  products: SupplierProduct[]; 
  onClose: () => void; 
  onRefresh: () => void; 
}) {
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null);

  const getProductName = (supplierProduct: SupplierProduct) => {
    return supplierProduct.ticket_name;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{supplier.name} - 상품 관리</h2>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditingProduct(null);
                setShowProductForm(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              상품 추가
            </button>
            <button
              onClick={onClose}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {products.map((product) => (
            <div key={product.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-medium">{getProductName(product)}</h3>
                  <div className="text-sm text-gray-600 mt-1">
                    성인: ${product.adult_supplier_price || product.supplier_price}
                    {product.child_supplier_price && (
                      <span className="ml-2">아동: ${product.child_supplier_price}</span>
                    )}
                    {product.infant_supplier_price && (
                      <span className="ml-2">유아: ${product.infant_supplier_price}</span>
                    )}
                    {(product.adult_season_price || product.child_season_price || product.infant_season_price) && (
                      <span className="ml-2 text-orange-600">
                        시즌가: 
                        {product.adult_season_price && <span> 성인 ${product.adult_season_price}</span>}
                        {product.child_season_price && <span> 아동 ${product.child_season_price}</span>}
                        {product.infant_season_price && <span> 유아 ${product.infant_season_price}</span>}
                      </span>
                    )}
                    {(product.markup_percent > 0 || product.markup_amount > 0) && (
                      <span className="ml-2 text-blue-600">
                        (마크업: {product.markup_percent > 0 ? `${product.markup_percent}%` : ''} {product.markup_amount > 0 ? `+$${product.markup_amount}` : ''})
                      </span>
                    )}
                  </div>
                  {product.entry_times && product.entry_times.length > 0 && (
                    <div className="text-sm text-gray-500 mt-1">
                      입장시간: {product.entry_times.join(', ')}
                    </div>
                  )}
                  {product.season_dates && Array.isArray(product.season_dates) && product.season_dates.length > 0 && (
                    <div className="text-sm text-gray-500 mt-1">
                      시즌 기간: {product.season_dates.map((period: SeasonDate) => `${period.start} ~ ${period.end}`).join(', ')}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingProduct(product);
                      setShowProductForm(true);
                    }}
                    className="text-green-600 hover:text-green-800 p-2"
                    title="수정"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {showProductForm && (
          <ProductFormModal
            supplier={supplier}
            product={editingProduct}
            onClose={() => {
              setShowProductForm(false);
              setEditingProduct(null);
            }}
            onSave={() => {
              onRefresh();
              setShowProductForm(false);
              setEditingProduct(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// 상품 폼 모달 컴포넌트
function ProductFormModal({ 
  supplier, 
  product, 
  onClose, 
  onSave 
}: { 
  supplier: Supplier; 
  product: SupplierProduct | null; 
  onClose: () => void; 
  onSave: () => void; 
}) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedChoiceOption, setSelectedChoiceOption] = useState<ChoiceOption | null>(null);
  const [supplyType, setSupplyType] = useState<'product' | 'choice' | ''>('');
  const [productHasChoices, setProductHasChoices] = useState(false);
  const [allChoiceOptions, setAllChoiceOptions] = useState<ChoiceOption[]>([]);
  const [choicePricesTable, setChoicePricesTable] = useState<Record<string, {
    adult: number;
    child: number;
    infant: number;
    season_adult: number;
    season_child: number;
    season_infant: number;
    markup_percent: number;
    markup_amount: number;
  }>>({});
  const [formData, setFormData] = useState({
    ticket_name: product?.ticket_name || '',
    adult_supplier_price: product?.adult_supplier_price || 0,
    child_supplier_price: product?.child_supplier_price || 0,
    infant_supplier_price: product?.infant_supplier_price || 0,
    adult_season_price: product?.adult_season_price || 0,
    child_season_price: product?.child_season_price || 0,
    infant_season_price: product?.infant_season_price || 0,
    entry_times: product?.entry_times || [] as string[],
    season_dates: product?.season_dates || [] as SeasonDate[],
    markup_percent: product?.markup_percent || 0,
    markup_amount: product?.markup_amount || 0,
    is_active: product?.is_active ?? true
  });

  // 기존 상품이 있다면 해당 상품 정보 로드
  useEffect(() => {
    const loadProductInfo = async () => {
      if (product?.product_id) {
        // 상품 정보 로드
        const { data: prodData } = await supabase
          .from('products')
          .select('*')
          .eq('id', product.product_id)
          .single();
        
        if (prodData) {
          const productData = prodData as Product;
          setSelectedProduct(productData);
          const requiredChoices = productData.choices?.required;
          const hasChoices = requiredChoices && Array.isArray(requiredChoices) && requiredChoices.length > 0;
          setProductHasChoices(!!hasChoices);
        }
        
        if (product.choice_id || product.choice_option_id) {
          setSupplyType('choice');
          
          // choice_option 정보 로드
          if (product.choice_option_id) {
            const { data: optionData } = await supabase
              .from('choice_options')
              .select('*')
              .eq('id', product.choice_option_id)
              .single();
            
            if (optionData) {
              setSelectedChoiceOption(optionData as ChoiceOption);
            }
          }
        } else {
          setSupplyType('product');
        }
      }
    };
    
    loadProductInfo();
  }, [product?.product_id, product?.choice_id, product?.choice_option_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct) {
      alert('상품을 선택해주세요.');
      return;
    }
    
    try {
      // supplyType이 없으면 기본적으로 'product'로 설정
      const finalSupplyType = supplyType || 'product';
      
      const productData = {
        ...formData,
        supplier_id: supplier.id,
        product_id: finalSupplyType === 'product' ? selectedProduct.id : null,
        choice_id: finalSupplyType === 'choice' ? selectedChoiceOption?.id || null : null,
        choice_option_id: finalSupplyType === 'choice' ? selectedChoiceOption?.id || null : null,
        // 기존 필드들은 호환성을 위해 유지
        regular_price: formData.adult_supplier_price || 0,
        supplier_price: formData.adult_supplier_price || 0,
        season_price: formData.adult_season_price || null,
        season_dates: formData.season_dates.length > 0 ? formData.season_dates : null,
        entry_times: formData.entry_times.length > 0 ? formData.entry_times : null
      };

      // 테이블에 입력된 choice_option별로 저장
      if (allChoiceOptions.length > 0) {
        const productsToInsert = allChoiceOptions.map(opt => {
          const prices = choicePricesTable[opt.id] || {};
          return {
            supplier_id: supplier.id,
            product_id: selectedProduct.id,
            choice_id: null,
            choice_option_id: opt.id,
            ticket_name: `${selectedProduct.name_ko || selectedProduct.name} - ${opt.name_ko || opt.name}`,
            regular_price: prices.adult || 0,
            supplier_price: prices.adult || 0,
            season_price: prices.season_adult || null,
            season_dates: formData.season_dates.length > 0 ? formData.season_dates : null,
            entry_times: formData.entry_times.length > 0 ? formData.entry_times : null,
            markup_percent: prices.markup_percent || 0,
            markup_amount: prices.markup_amount || 0,
            adult_supplier_price: prices.adult || 0,
            child_supplier_price: prices.child || 0,
            infant_supplier_price: prices.infant || 0,
            adult_season_price: prices.season_adult || null,
            child_season_price: prices.season_child || null,
            infant_season_price: prices.season_infant || null,
            is_active: formData.is_active
          };
        });

        if (product) {
          // 수정 시 기존 레코드 삭제 후 새로 추가
          if (product.product_id) {
            await supabase
              .from('supplier_products')
              .delete()
              .eq('product_id', product.product_id)
              .eq('supplier_id', supplier.id);
          }
        }

        const { data: insertedData, error: insertError } = await supabase
          .from('supplier_products')
          .insert(productsToInsert as any)
          .select();

        if (insertError) {
          console.error('초이스별 가격 저장 오류:', insertError);
          alert(`저장 오류가 발생했습니다: ${insertError.message}`);
          return;
        }

        console.log(`${insertedData?.length || 0}개의 초이스별 가격이 저장되었습니다:`, insertedData);
        
        // 저장된 데이터 확인 메시지
        if (insertedData && insertedData.length > 0) {
          alert(`${insertedData.length}개의 초이스별 가격이 성공적으로 저장되었습니다.`);
        }
      } else {
        // choice가 없는 경우 기존 방식으로 저장
        if (product) {
          await supabase
            .from('supplier_products')
            .update(productData as never)
            .eq('id', product.id);
        } else {
          await supabase
            .from('supplier_products')
            .insert([productData] as any);
        }
      }

      // 공급 업체 상품이 실제 상품과 연결된 경우 동적 가격 업데이트
      if (selectedProduct?.id) {
        try {
          // 모든 채널에 대해 현재 날짜부터 30일간 동적 가격 업데이트
          const channels = await supabase.from('channels').select('id');
          if (channels.data && channels.data.length > 0) {
            const today = new Date();
            for (let i = 0; i < 30; i++) {
              const date = new Date(today);
              date.setDate(today.getDate() + i);
              const dateString = date.toISOString().split('T')[0];
              
              for (const channel of channels.data) {
                await updateDynamicPricingWithSupplierPrices(
                  selectedProduct.id,
                  (channel as any).id,
                  dateString
                );
              }
            }
          }
        } catch (error) {
          console.error('동적 가격 업데이트 오류:', error);
        }
      }

      onSave();
    } catch (error) {
      console.error('상품 저장 오류:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">
          {product ? '상품 수정' : '상품 추가'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 2열 그리드 레이아웃 */}
          <div className="grid grid-cols-2 gap-6">
            {/* 왼쪽: 상품 선택기만 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상품 선택 *
              </label>
              <ProductSelector
                selectedProductId={selectedProduct?.id || ''}
                selectedChoiceId={selectedChoiceOption?.id || ''}
                onProductSelect={async (product) => {
                  setSelectedProduct(product as Product);
                  if (product) {
                    // 선택된 상품에 choices가 있는지 확인
                    const requiredChoices = product.choices?.required;
                    const hasChoices = requiredChoices && Array.isArray(requiredChoices) && requiredChoices.length > 0;
                    setProductHasChoices(!!hasChoices);
                    
                    if (hasChoices) {
                      // products 테이블의 choices JSON에서 직접 로드
                      try {
                        const choicesData = product.choices?.required;
                        
                        if (choicesData && Array.isArray(choicesData)) {
                          const options: ChoiceOption[] = [];
                          
                          // 모든 choice group의 options를 수집
                          choicesData.forEach((choiceGroup: any) => {
                            if (choiceGroup.options && Array.isArray(choiceGroup.options)) {
                              choiceGroup.options.forEach((option: any) => {
                                options.push({
                                  id: option.id,
                                  name: option.name || option.option_name,
                                  name_ko: option.name_ko || option.option_name_ko,
                                  price: option.adult_price || option.price || 0,
                                  is_default: option.is_default || false
                                });
                              });
                            }
                          });
                          
                          if (options.length > 0) {
                            setAllChoiceOptions(options);
                            
                            // 초기 가격 설정
                            const initialPrices: Record<string, any> = {};
                            options.forEach(opt => {
                              initialPrices[opt.id] = {
                                adult: 0,
                                child: 0,
                                infant: 0,
                                season_adult: 0,
                                season_child: 0,
                                season_infant: 0,
                                markup_percent: 0,
                                markup_amount: 0
                              };
                            });
                            setChoicePricesTable(initialPrices);
                          } else {
                            setAllChoiceOptions([]);
                            setChoicePricesTable({});
                          }
                        }
                      } catch (error) {
                        console.error('Choice options 로드 오류:', error);
                        setAllChoiceOptions([]);
                        setChoicePricesTable({});
                      }
                    } else {
                      // choices가 없으면 기본적으로 'product' 타입으로 설정
                      setSupplyType('product');
                      setSelectedChoiceOption(null);
                      setAllChoiceOptions([]);
                      setChoicePricesTable({});
                    }
                  }
                }}
                onChoiceSelect={(choice) => {
                  if (choice) {
                    setSelectedChoiceOption(choice as unknown as ChoiceOption);
                    setSupplyType('choice');
                    setFormData(prev => ({
                      ...prev,
                      ticket_name: `${selectedProduct?.name_ko || selectedProduct?.name} - ${choice.name_ko || choice.name}`
                    }));
                  }
                }}
                showChoices={productHasChoices}
              />
            </div>

            {/* 오른쪽: 모든 필드들 */}
            <div className="space-y-4">
              {/* 공급 타입 표시 (선택된 상품에 따라 자동 결정) */}
              {selectedProduct && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    공급 타입
                  </label>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm text-gray-700">
                      {supplyType === 'choice' ? (
                        <span className="font-medium text-blue-700">입장권(선택 옵션) 공급 - {selectedChoiceOption?.name_ko || selectedChoiceOption?.name || '옵션 미선택'}</span>
                      ) : (
                        <span className="font-medium text-blue-700">상품 전체 공급</span>
                      )}
                      {productHasChoices && supplyType === 'product' && (
                        <div className="text-xs text-gray-600 mt-1">아래 옵션에서 특정 입장권을 선택할 수 있습니다.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 티켓명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  티켓명 *
                </label>
                <input
                  type="text"
                  value={formData.ticket_name}
                  onChange={(e) => setFormData({...formData, ticket_name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* 공급가격 (성인/아동/유아) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  공급가격 *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">성인</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.adult_supplier_price}
                      onChange={(e) => setFormData({...formData, adult_supplier_price: parseFloat(e.target.value)})}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">아동</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.child_supplier_price}
                      onChange={(e) => setFormData({...formData, child_supplier_price: parseFloat(e.target.value)})}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">유아</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.infant_supplier_price}
                      onChange={(e) => setFormData({...formData, infant_supplier_price: parseFloat(e.target.value)})}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 시즌 가격 (성인/아동/유아) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  시즌 가격
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">성인</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.adult_season_price}
                      onChange={(e) => setFormData({...formData, adult_season_price: parseFloat(e.target.value)})}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">아동</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.child_season_price}
                      onChange={(e) => setFormData({...formData, child_season_price: parseFloat(e.target.value)})}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">유아</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.infant_season_price}
                      onChange={(e) => setFormData({...formData, infant_season_price: parseFloat(e.target.value)})}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 마크업 설정 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  마크업 설정
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">마크업 금액 ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.markup_amount}
                      onChange={(e) => setFormData({...formData, markup_amount: parseFloat(e.target.value)})}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">마크업 비율 (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.markup_percent}
                      onChange={(e) => setFormData({...formData, markup_percent: parseFloat(e.target.value)})}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 입장 시간들 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  입장 시간들
                </label>
                <div className="space-y-2">
                  {formData.entry_times.map((time, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => {
                          const newTimes = [...formData.entry_times];
                          newTimes[index] = e.target.value;
                          setFormData({...formData, entry_times: newTimes});
                        }}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newTimes = formData.entry_times.filter((_, i) => i !== index);
                          setFormData({...formData, entry_times: newTimes});
                        }}
                        className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({...formData, entry_times: [...formData.entry_times, '']});
                    }}
                    className="w-full px-2 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                  >
                    입장시간 추가
                  </button>
                </div>
              </div>

              {/* 시즌 기간들 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  시즌 기간들
                </label>
                <div className="space-y-2">
                  {formData.season_dates.map((period: SeasonDate, index: number) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="date"
                        value={period.start || ''}
                        onChange={(e) => {
                          const newDates = [...formData.season_dates];
                          newDates[index] = {...newDates[index], start: e.target.value};
                          setFormData({...formData, season_dates: newDates});
                        }}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="시작일"
                      />
                      <span className="flex items-center text-gray-500 text-sm">~</span>
                      <input
                        type="date"
                        value={period.end || ''}
                        onChange={(e) => {
                          const newDates = [...formData.season_dates];
                          newDates[index] = {...newDates[index], end: e.target.value};
                          setFormData({...formData, season_dates: newDates});
                        }}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="종료일"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newDates = formData.season_dates.filter((_: SeasonDate, i: number) => i !== index);
                          setFormData({...formData, season_dates: newDates});
                        }}
                        className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({...formData, season_dates: [...formData.season_dates, {start: '', end: ''}]});
                    }}
                    className="w-full px-2 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                  >
                    시즌 기간 추가
                  </button>
                </div>
              </div>

              {/* 활성 상태 */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="mr-2"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  활성 상태
                </label>
              </div>

              {/* 버튼 */}
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                >
                  {product ? '수정' : '추가'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                >
                  취소
                </button>
              </div>
            </div>
          </div>

          {/* 초이스별 가격 테이블 (선택된 상품에 초이스가 있는 경우) */}
          {allChoiceOptions.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-800">
                  초이스별 가격 설정
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    const newPrices: Record<string, any> = {};
                    allChoiceOptions.forEach(opt => {
                      newPrices[opt.id] = {
                        adult: formData.adult_supplier_price,
                        child: formData.child_supplier_price,
                        infant: formData.infant_supplier_price,
                        season_adult: formData.adult_season_price,
                        season_child: formData.child_season_price,
                        season_infant: formData.infant_season_price,
                        markup_percent: formData.markup_percent,
                        markup_amount: formData.markup_amount
                      };
                    });
                    setChoicePricesTable(newPrices);
                  }}
                  className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                >
                  위 가격으로 일괄 적용
                </button>
              </div>
              
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">옵션명</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">성인</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">아동</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">유아</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">시즌 성인</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">시즌 아동</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">시즌 유아</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">마크업 %</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">마크업 금액</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {allChoiceOptions.map((option) => (
                      <tr key={option.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {option.name_ko || option.name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            value={choicePricesTable[option.id]?.adult || 0}
                            onChange={(e) => setChoicePricesTable(prev => ({
                              ...prev,
                              [option.id]: { ...prev[option.id], adult: parseFloat(e.target.value) || 0 }
                            }))}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            value={choicePricesTable[option.id]?.child || 0}
                            onChange={(e) => setChoicePricesTable(prev => ({
                              ...prev,
                              [option.id]: { ...prev[option.id], child: parseFloat(e.target.value) || 0 }
                            }))}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            value={choicePricesTable[option.id]?.infant || 0}
                            onChange={(e) => setChoicePricesTable(prev => ({
                              ...prev,
                              [option.id]: { ...prev[option.id], infant: parseFloat(e.target.value) || 0 }
                            }))}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            value={choicePricesTable[option.id]?.season_adult || 0}
                            onChange={(e) => setChoicePricesTable(prev => ({
                              ...prev,
                              [option.id]: { ...prev[option.id], season_adult: parseFloat(e.target.value) || 0 }
                            }))}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            value={choicePricesTable[option.id]?.season_child || 0}
                            onChange={(e) => setChoicePricesTable(prev => ({
                              ...prev,
                              [option.id]: { ...prev[option.id], season_child: parseFloat(e.target.value) || 0 }
                            }))}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            value={choicePricesTable[option.id]?.season_infant || 0}
                            onChange={(e) => setChoicePricesTable(prev => ({
                              ...prev,
                              [option.id]: { ...prev[option.id], season_infant: parseFloat(e.target.value) || 0 }
                            }))}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            value={choicePricesTable[option.id]?.markup_percent || 0}
                            onChange={(e) => setChoicePricesTable(prev => ({
                              ...prev,
                              [option.id]: { ...prev[option.id], markup_percent: parseFloat(e.target.value) || 0 }
                            }))}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            value={choicePricesTable[option.id]?.markup_amount || 0}
                            onChange={(e) => setChoicePricesTable(prev => ({
                              ...prev,
                              [option.id]: { ...prev[option.id], markup_amount: parseFloat(e.target.value) || 0 }
                            }))}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </form>
      </div>
    </div>
  );
}
