-- 3단계: 기본 카테고리 데이터 삽입
INSERT INTO document_categories (name_ko, name_en, description_ko, description_en, color, icon, sort_order) VALUES
('계약/협약', 'Contracts/Agreements', '호텔 계약서, 제휴사 계약, 가이드 계약 등', 'Hotel contracts, partnership agreements, guide contracts, etc.', '#3B82F6', 'file-signature', 1),
('보험/보증', 'Insurance/Bonds', '여행자 보험, 차량 보험, 영업 보증서 등', 'Travel insurance, vehicle insurance, business bonds, etc.', '#10B981', 'shield-check', 2),
('운송 관련', 'Transportation', '차량 등록증, 운전면허, 정기 점검 기록 등', 'Vehicle registration, driver license, inspection records, etc.', '#F59E0B', 'truck', 3),
('비자/허가증', 'Visas/Permits', '영업허가증, 사업자 등록증, 해외 비자 관련 서류 등', 'Business permits, business registration, overseas visa documents, etc.', '#8B5CF6', 'id-card', 4),
('회계/세무', 'Accounting/Tax', '세금 신고서, 납부 영수증, 회계감사 서류 등', 'Tax returns, payment receipts, audit documents, etc.', '#EF4444', 'calculator', 5),
('기타', 'Others', '내부 규정, 직원 교육 자료, 안전 매뉴얼 등', 'Internal regulations, employee training materials, safety manuals, etc.', '#6B7280', 'folder', 6)
ON CONFLICT DO NOTHING;
