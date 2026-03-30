import { supabase } from '@/lib/supabase'

const DEFAULT_LEDGER_BASE = '2025-01-01'

export type FiscalReportingSettings = {
  ledgerBaseDate: string
}

export async function getFiscalReportingSettings(): Promise<FiscalReportingSettings> {
  try {
    const { data, error } = await supabase
      .from('shared_settings')
      .select('setting_value')
      .eq('setting_key', 'fiscal_reporting')
      .maybeSingle()

    if (error || !data?.setting_value) {
      return { ledgerBaseDate: DEFAULT_LEDGER_BASE }
    }

    const v = data.setting_value as Record<string, unknown>
    const ledger = typeof v.ledgerBaseDate === 'string' ? v.ledgerBaseDate : DEFAULT_LEDGER_BASE
    return { ledgerBaseDate: ledger }
  } catch {
    return { ledgerBaseDate: DEFAULT_LEDGER_BASE }
  }
}

export function getDefaultLedgerBaseDate(): string {
  return DEFAULT_LEDGER_BASE
}
