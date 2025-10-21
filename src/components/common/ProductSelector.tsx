'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface Product {
  id: string;
  name: string;
  name_ko?: string | null;
  name_en?: string | null;
  category?: string | null;
  sub_category?: string | null;
  base_price?: number | null;
  choices?: Record<string, unknown> | null;
  status?: string | null;
}

export interface Choice {
  id: string;
  name: string;
  name_ko?: string;
  description?: string;
  adult_price: number;
  child_price: number;
  infant_price: number;
  is_default?: boolean;
}

export interface ProductSelectorProps {
  selectedProductId?: string;
  selectedChoiceId?: string;
  onProductSelect: (product: Product | null) => void;
  onChoiceSelect?: (choice: Choice | null) => void;
  showChoices?: boolean;
  className?: string;
  disabled?: boolean;
  locale?: 'ko' | 'en';
}

export default function ProductSelector({
  selectedProductId,
  selectedChoiceId,
  onProductSelect,
  onChoiceSelect,
  showChoices = false,
  className = "",
  disabled = false,
  locale = 'ko'
}: ProductSelectorProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productChoices, setProductChoices] = useState<Choice[]>([]);
  const [loadingChoices, setLoadingChoices] = useState(false);

  // 로케일에 따른 상품명 반환
  const getProductName = (product: Product): string => {
    if (locale === 'en' && product.name_en) {
      return product.name_en;
    }
    return product.name_ko || product.name || '';
  };

  // 상품 데이터 로드
  useEffect(() => {
    loadProducts();
  }, []);

  // 선택된 상품이 변경될 때 초기화
  useEffect(() => {
    if (selectedProductId) {
      const product = products.find(p => p.id === selectedProductId);
      if (product) {
        setSelectedProduct(product);
        if (showChoices) {
          loadProductChoices(product.id);
        }
      }
    } else {
      setSelectedProduct(null);
      setProductChoices([]);
    }
  }, [selectedProductId, products, showChoices]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_ko, name_en, category, sub_category, base_price, choices, status')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('상품 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProductChoices = async (productId: string) => {
    try {
      setLoadingChoices(true);
      const { data, error } = await supabase
        .from('products')
        .select('choices')
        .eq('id', productId)
        .single();

      if (error) throw error;
      
      if (data && typeof data === 'object' && 'choices' in data) {
        const choicesData = (data as { choices: unknown }).choices as Record<string, unknown>;
        if (choicesData && typeof choicesData === 'object' && 'required' in choicesData) {
          const choices: Choice[] = [];
          const requiredChoices = (choicesData.required as Record<string, unknown>[]);
          requiredChoices.forEach((choiceGroup: Record<string, unknown>) => {
          if (choiceGroup.options && Array.isArray(choiceGroup.options)) {
            (choiceGroup.options as Record<string, unknown>[]).forEach((option: Record<string, unknown>) => {
              choices.push({
                id: option.id as string,
                name: option.name as string,
                name_ko: option.name_ko as string,
                description: option.description as string,
                adult_price: (option.price as number) || 0,
                child_price: (option.child_price as number) || (option.price as number) || 0,
                infant_price: (option.infant_price as number) || 0,
                is_default: (option.is_default as boolean) || false
              });
            });
          }
          });
          setProductChoices(choices);
        } else {
          setProductChoices([]);
        }
      } else {
        setProductChoices([]);
      }
    } catch (error) {
      console.error('상품 선택 옵션 로드 오류:', error);
      setProductChoices([]);
    } finally {
      setLoadingChoices(false);
    }
  };

  // 초성 검색을 위한 한글 초성 매핑
  const getInitialConsonant = (char: string): string => {
    const code = char.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const initial = Math.floor((code - 0xAC00) / 0x24C);
      const initials = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
      return initials[initial];
    }
    return char;
  };

  // 초성 문자열 생성
  const getInitialConsonants = useCallback((text: string): string => {
    return text.split('').map(char => getInitialConsonant(char)).join('');
  }, []);

  // 검색어와 매칭되는지 확인
  const matchesSearch = useCallback((product: Product, searchTerm: string): boolean => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const searchInitials = getInitialConsonants(searchTerm);
    
    // 상품명 검색 (한글, 영문, 초성)
    const nameMatches = 
      product.name?.toLowerCase().includes(searchLower) ||
      product.name_ko?.toLowerCase().includes(searchLower) ||
      product.name_en?.toLowerCase().includes(searchLower) ||
      getInitialConsonants(product.name_ko || '').includes(searchInitials) ||
      getInitialConsonants(product.name || '').includes(searchInitials);
    
    // 카테고리 검색 (한글, 영문, 초성)
    const categoryMatches = 
      product.category?.toLowerCase().includes(searchLower) ||
      getInitialConsonants(product.category || '').includes(searchInitials);
    
    // 서브카테고리 검색 (한글, 영문, 초성)
    const subCategoryMatches = 
      product.sub_category?.toLowerCase().includes(searchLower) ||
      getInitialConsonants(product.sub_category || '').includes(searchInitials);
    
    return nameMatches || categoryMatches || subCategoryMatches;
  }, [getInitialConsonants]);

  // 필터링된 상품 목록
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // 검색어 필터 (한글, 영문, 초성 검색)
      if (searchTerm && !matchesSearch(product, searchTerm)) {
        return false;
      }

      // 카테고리 필터
      if (selectedCategory && product.category !== selectedCategory) {
        return false;
      }

      // 서브카테고리 필터
      if (selectedSubCategory && product.sub_category !== selectedSubCategory) {
        return false;
      }

      return true;
    });
  }, [products, searchTerm, selectedCategory, selectedSubCategory, matchesSearch]);

  // 모든 카테고리 목록 (탭 표시용) - Tour를 첫 번째로 배치
  const allCategories = useMemo(() => {
    const categorySet = new Set<string>();
    products.forEach(product => {
      if (product.category) {
        categorySet.add(product.category);
      }
    });
    const categories = Array.from(categorySet);
    
    // Tour를 첫 번째로 배치하고 나머지는 정렬
    const tourIndex = categories.indexOf('Tour');
    if (tourIndex > -1) {
      categories.splice(tourIndex, 1);
      categories.unshift('Tour');
    }
    
    return categories;
  }, [products]);

  // 카테고리별 상품 그룹화
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    filteredProducts.forEach(product => {
      const category = product.category || '기타';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(product);
    });
    return grouped;
  }, [filteredProducts]);

  // 선택된 카테고리의 서브카테고리 목록 (탭 표시용)
  const selectedCategorySubCategories = useMemo(() => {
    if (!selectedCategory) return [];
    
    const subCategorySet = new Set<string>();
    products.forEach(product => {
      if (product.category === selectedCategory && product.sub_category) {
        subCategorySet.add(product.sub_category);
      }
    });
    return Array.from(subCategorySet).sort();
  }, [products, selectedCategory]);

  // 서브카테고리별 상품 그룹화 (선택된 카테고리 내에서만)
  const productsBySubCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    
    // 선택된 카테고리가 있으면 해당 카테고리의 상품만 처리
    const targetProducts = selectedCategory 
      ? filteredProducts.filter(product => product.category === selectedCategory)
      : filteredProducts;
    
    targetProducts.forEach(product => {
      const subCategory = product.sub_category || '기타';
      if (!grouped[subCategory]) {
        grouped[subCategory] = [];
      }
      grouped[subCategory].push(product);
    });
    return grouped;
  }, [filteredProducts, selectedCategory]);

  const handleProductClick = (product: Product, event?: React.MouseEvent) => {
    // 폼 제출 방지
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    setSelectedProduct(product);
    onProductSelect(product);
    
    if (showChoices) {
      loadProductChoices(product.id);
    }
  };

  const handleChoiceClick = (choice: Choice) => {
    if (onChoiceSelect) {
      onChoiceSelect(choice);
    }
  };

  const toggleCategory = (category: string, event?: React.MouseEvent) => {
    // 폼 제출 방지
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // 선택된 카테고리만 표시하되 다른 탭들은 숨기지 않음
    setSelectedCategory(category);
    setSelectedSubCategory('');
  };

  const toggleSubCategory = (subCategory: string, event?: React.MouseEvent) => {
    // 폼 제출 방지
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // 선택된 서브카테고리만 표시하되 다른 탭들은 숨기지 않음
    setSelectedSubCategory(subCategory);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedSubCategory('');
  };

  const clearSelection = () => {
    setSelectedProduct(null);
    setProductChoices([]);
    onProductSelect(null);
    if (onChoiceSelect) {
      onChoiceSelect(null);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 검색 및 필터 - 한 줄 배치 */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* 검색 입력 */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="상품명, 카테고리, 초성으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={disabled}
          />
        </div>

        {/* 필터 초기화 */}
        {searchTerm && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded-lg hover:bg-blue-50"
            disabled={disabled}
          >
            초기화
          </button>
        )}
      </div>

      {/* 상품 목록 - 탭 형식 */}
      <div className="border border-gray-200 rounded-lg h-[500px] flex flex-col">
        {loading ? (
          <div className="p-4 text-center text-gray-500">상품 로딩 중...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchTerm || selectedCategory || selectedSubCategory 
              ? '검색 조건에 맞는 상품이 없습니다.' 
              : '등록된 상품이 없습니다.'}
          </div>
        ) : (
          <div className="flex flex-col h-full">
              {/* 카테고리 탭 헤더 - 고정 */}
              <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0">
                {allCategories.map(category => (
                  <button
                    key={category}
                    onClick={(e) => toggleCategory(category, e)}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      selectedCategory === category
                        ? 'border-blue-500 text-blue-600 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {category}
                    <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                      {productsByCategory[category]?.length || 0}
                    </span>
                  </button>
                ))}
              </div>

              {/* 서브카테고리 탭 헤더 - 고정 */}
              {selectedCategory && selectedCategorySubCategories.length > 0 && (
                <div className="flex border-b border-gray-200 bg-gray-100 flex-shrink-0">
                  {selectedCategorySubCategories.map(subCategory => (
                    <button
                      key={subCategory}
                      onClick={(e) => toggleSubCategory(subCategory, e)}
                      className={`px-2 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                        selectedSubCategory === subCategory
                          ? 'border-green-500 text-green-600 bg-white'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {subCategory}
                      <span className="ml-1 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                        {productsBySubCategory[subCategory]?.length || 0}
                      </span>
                    </button>
                  ))}
                </div>
              )}

            {/* 탭 콘텐츠 - 스크롤 가능 */}
            <div className="bg-white flex-1 overflow-y-auto">
              {/* 서브카테고리가 선택된 경우 해당 서브카테고리의 상품만 표시 */}
              {selectedSubCategory ? (
                <div className="divide-y divide-gray-100">
                  {productsBySubCategory[selectedSubCategory]?.map(product => (
                    <div
                      key={product.id}
                      className={`px-3 py-2 cursor-pointer hover:bg-blue-50 border-l-4 transition-colors ${
                        selectedProduct?.id === product.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-transparent hover:border-blue-200'
                      }`}
                      onClick={(e) => handleProductClick(product, e)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {getProductName(product)}
                          </div>
                        </div>
                        {selectedProduct?.id === product.id && (
                          <Check className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedCategory ? (
                /* 카테고리가 선택되었지만 서브카테고리가 선택되지 않은 경우 */
                <div className="divide-y divide-gray-100">
                  {productsByCategory[selectedCategory]?.map(product => (
                    <div
                      key={product.id}
                      className={`px-3 py-2 cursor-pointer hover:bg-blue-50 border-l-4 transition-colors ${
                        selectedProduct?.id === product.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-transparent hover:border-blue-200'
                      }`}
                      onClick={(e) => handleProductClick(product, e)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {getProductName(product)}
                          </div>
                        </div>
                        {selectedProduct?.id === product.id && (
                          <Check className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* 아무것도 선택되지 않은 경우 모든 상품 표시 */
                <div className="divide-y divide-gray-100">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      className={`px-3 py-2 cursor-pointer hover:bg-blue-50 border-l-4 transition-colors ${
                        selectedProduct?.id === product.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-transparent hover:border-blue-200'
                      }`}
                      onClick={(e) => handleProductClick(product, e)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {getProductName(product)}
                          </div>
                        </div>
                        {selectedProduct?.id === product.id && (
                          <Check className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 선택된 상품 정보 - 컴팩트 */}
      {selectedProduct && (
        <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-600 font-medium">선택된 상품:</span>
              <span className="text-sm text-blue-900 font-medium">
                {getProductName(selectedProduct)}
              </span>
              {selectedProduct.sub_category && (
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                  {selectedProduct.sub_category}
                </span>
              )}
            </div>
            <button
              onClick={clearSelection}
              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 hover:bg-blue-100 rounded"
              disabled={disabled}
            >
              해제
            </button>
          </div>
        </div>
      )}

      {/* 선택 옵션 (choices) */}
      {showChoices && selectedProduct && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">선택 옵션</h4>
          {loadingChoices ? (
            <div className="p-4 text-center text-gray-500">선택 옵션 로딩 중...</div>
          ) : productChoices.length === 0 ? (
            <div className="p-4 text-center text-gray-500">선택 옵션이 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {productChoices.map(choice => (
                <div
                  key={choice.id}
                  className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                    selectedChoiceId === choice.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200'
                  }`}
                  onClick={() => handleChoiceClick(choice)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {choice.name_ko || choice.name}
                      </div>
                      {choice.description && (
                        <div className="text-sm text-gray-500 mt-1">{choice.description}</div>
                      )}
                      <div className="text-sm text-gray-600 mt-1">
                        성인: ${choice.adult_price} | 아동: ${choice.child_price} | 유아: ${choice.infant_price}
                      </div>
                    </div>
                    {selectedChoiceId === choice.id && (
                      <Check className="w-5 h-5 text-blue-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
