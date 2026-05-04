-- 관리자가 동일 게시 버전 행에서 한·영만 나눠 수정(UPDATE)할 수 있도록

DROP POLICY IF EXISTS "company_sop_versions_update_managers" ON public.company_sop_versions;
CREATE POLICY "company_sop_versions_update_managers"
  ON public.company_sop_versions FOR UPDATE TO authenticated
  USING (public.can_manage_company_sop())
  WITH CHECK (public.can_manage_company_sop());

DROP POLICY IF EXISTS "company_employee_contract_versions_update_managers" ON public.company_employee_contract_versions;
CREATE POLICY "company_employee_contract_versions_update_managers"
  ON public.company_employee_contract_versions FOR UPDATE TO authenticated
  USING (public.can_manage_company_sop())
  WITH CHECK (public.can_manage_company_sop());
