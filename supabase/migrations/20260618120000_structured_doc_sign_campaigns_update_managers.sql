-- 관리자가 서명 요청 캠페인을 종료(발송 취소)할 수 있도록 closed_at 등 업데이트 허용

DROP POLICY IF EXISTS "structured_doc_sign_campaigns_update_managers"
  ON public.company_structured_doc_sign_campaigns;

CREATE POLICY "structured_doc_sign_campaigns_update_managers"
  ON public.company_structured_doc_sign_campaigns FOR UPDATE TO authenticated
  USING (public.can_manage_company_sop())
  WITH CHECK (public.can_manage_company_sop());
