# One-off patch: extend PricingInfoModal to use PricingSection-aligned formulas
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "src/components/reservation/PricingInfoModal.tsx"
text = path.read_text(encoding="utf-8")

# Channel select: add type, category + setIsOTAChannel
old_ch = """        const { data: channelData } = await supabase
          .from('channels')
          .select('pricing_type, has_not_included_price, not_included_type, not_included_price')
          .eq('id', reservation.channelId)
          .single()
        
        if (channelData?.pricing_type) {
          setChannelPricingType(channelData.pricing_type as 'separate' | 'single')
        }
      }"""
new_ch = """        const { data: channelData } = await supabase
          .from('channels')
          .select('pricing_type, has_not_included_price, not_included_type, not_included_price, type, category')
          .eq('id', reservation.channelId)
          .single()
        
        if (channelData?.pricing_type) {
          setChannelPricingType(channelData.pricing_type as 'separate' | 'single')
        }
        if (channelData) {
          const ota =
            String((channelData as { type?: string }).type || '').toLowerCase() === 'ota' ||
            (channelData as { category?: string }).category === 'OTA'
          setIsOTAChannel(ota)
        }
      }"""
if old_ch in text:
    text = text.replace(old_ch, new_ch, 1)

# reservation_pricing select add pricing_adults
text = text.replace(
    "not_included_price, commission_amount, commission_percent, channel_settlement_amount')",
    "not_included_price, commission_amount, commission_percent, channel_settlement_amount, pricing_adults')",
    1,
)

# defaultData when no row: add pricing_adults
if "pricing_adults: reservation.adults" not in text.split("const defaultData: PricingData", 1)[1][:1200]:
    text = text.replace(
        "          channel_settlement_amount: Math.max(\n            0,\n            (pricingInfo?.depositAmount || 0) - (Number(pricingInfo?.commission_amount) || 0)\n          ),\n        }",
        "          channel_settlement_amount: Math.max(\n            0,\n            (pricingInfo?.depositAmount || 0) - (Number(pricingInfo?.commission_amount) || 0)\n          ),\n          pricing_adults: reservation.adults ?? 0,\n        }",
        1,
    )

# pricingDataWithDefaults merge pricing_adults from row
old_pd = """      const pricingDataWithDefaults: PricingData = {
        ...data,
        id: (data as { id?: string }).id,
        adult_product_price: adultPrice,
        child_product_price: childPrice,
        infant_product_price: infantPrice,
        product_price_total: productPriceTotal,
        choices_total: toNum(data.choices_total),
        not_included_price: toNum(data.not_included_price),
        commission_amount: toNum(data.commission_amount),
        commission_percent: commissionPercentToUse,
        channel_settlement_amount: chSettleFromDb,
      }"""
new_pd = """      const paRaw = raw.pricing_adults
      const pricingAdultsMerged =
        paRaw != null && paRaw !== '' && Number.isFinite(Number(paRaw))
          ? Math.max(0, Math.floor(Number(paRaw)))
          : reservation.adults ?? 0

      const pricingDataWithDefaults: PricingData = {
        ...data,
        id: (data as { id?: string }).id,
        adult_product_price: adultPrice,
        child_product_price: childPrice,
        infant_product_price: infantPrice,
        product_price_total: productPriceTotal,
        choices_total: toNum(data.choices_total),
        not_included_price: toNum(data.not_included_price),
        commission_amount: toNum(data.commission_amount),
        commission_percent: commissionPercentToUse,
        channel_settlement_amount: chSettleFromDb,
        pricing_adults: pricingAdultsMerged,
      }"""
if old_pd in text:
    text = text.replace(old_pd, new_pd, 1)

# payment records effect after loadCoupons effect
pay_effect = """
  useEffect(() => {
    if (!isOpen || !reservation?.id) return
    let cancelled = false
    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const res = await fetch(`/api/payment-records?reservation_id=${reservation.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const json = await res.json()
        const records = json.paymentRecords || []
        const normalized = records.map((r: { payment_status: string; amount: number }) => ({
          payment_status: r.payment_status || '',
          amount: Number(r.amount) || 0,
        }))
        const summary = summarizePaymentRecordsForBalance(normalized)
        if (!cancelled) {
          setReturnedAmount(summary.returnedTotal)
          setRefundedAmount(summary.refundedTotal)
          setPartnerReceivedForSettlement(summary.partnerReceivedStrict)
        }
      } catch {
        if (!cancelled) {
          setReturnedAmount(0)
          setRefundedAmount(0)
          setPartnerReceivedForSettlement(0)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, reservation?.id])

"""
if "summarizePaymentRecordsForBalance" in text and pay_effect.strip() not in text:
    text = text.replace(
        "  }, [pricingData, reservation?.channelId])\n\n  const loadPricingData",
        "  }, [pricingData, reservation?.channelId])\n" + pay_effect + "  const loadPricingData",
        1,
    )

# useMemo block before `if (!isOpen || !reservation) return null`
memo = """
  const pricingAdultsVal = useMemo(() => {
    if (!editData || !reservation) return reservation?.adults ?? 0
    const pa = editData.pricing_adults
    if (pa != null && pa !== '' && Number.isFinite(Number(pa))) {
      return Math.max(0, Math.floor(Number(pa)))
    }
    return reservation.adults ?? 0
  }, [editData, reservation])

  const notIncludedBreakdownModal = useMemo(() => {
    if (!editData || !reservation) return { baseUsd: 0, residentFeesUsd: 0, totalUsd: 0 }
    const ra = (reservation as { residentStatusAmounts?: Record<string, number> }).residentStatusAmounts
    return splitNotIncludedForDisplay(
      0,
      0,
      editData.not_included_price || 0,
      pricingAdultsVal,
      reservation.child ?? 0,
      reservation.infant ?? 0,
      ra
    )
  }, [editData, reservation, pricingAdultsVal])

  const reservationOptionsTotalUsd = useMemo(
    () => reservationOptionsRows.reduce((sum, o) => sum + (o.total_price || 0), 0),
    [reservationOptionsRows]
  )

  const isReservationCancelled =
    reservation?.status === 'cancelled' || reservation?.status === 'canceled'

  const displayCustomerGross = useMemo(() => {
    if (!editData || !reservation) return 0
    return computePricingSectionCustomerPaymentGrossLike({
      status: reservation.status,
      productPriceTotal: editData.product_price_total || 0,
      couponDiscount: Math.abs(editData.coupon_discount || 0),
      additionalDiscount: editData.additional_discount || 0,
      reservationOptionsTotalUsd,
      notIncludedTotalUsd: notIncludedBreakdownModal.totalUsd,
      additionalCost: editData.additional_cost || 0,
      tax: editData.tax || 0,
      cardFee: editData.card_fee || 0,
      prepaymentCost: editData.prepayment_cost || 0,
      prepaymentTip: editData.prepayment_tip || 0,
    })
  }, [editData, reservation, reservationOptionsTotalUsd, notIncludedBreakdownModal.totalUsd])

  const displayCustomerNet = useMemo(
    () => computePricingSectionCustomerPaymentNet(displayCustomerGross, returnedAmount),
    [displayCustomerGross, returnedAmount]
  )

  const channelSettlementForDisplay = useMemo(() => {
    if (!editData || !reservation) return 0
    const fromForm = editData.channel_settlement_amount
    if (
      fromForm !== undefined &&
      fromForm !== null &&
      String(fromForm) !== '' &&
      Number.isFinite(Number(fromForm))
    ) {
      return Math.max(0, Number(fromForm))
    }
    const pa = Math.max(0, Math.floor(Number(editData.pricing_adults ?? reservation.adults) || 0))
    const billingPax = pa + (reservation.child || 0) + (reservation.infant || 0)
    const cancelledOtaSettle = isReservationCancelled && isOTAChannel
    const notIncludedTotal = cancelledOtaSettle ? 0 : (Number(editData.not_included_price) || 0) * (billingPax || 1)
    const productTotalForSettlement = (Number(editData.product_price_total) || 0) + notIncludedTotal

    return computeChannelSettlementAmount({
      depositAmount: Number(editData.deposit_amount) || 0,
      onlinePaymentAmount: Number((reservation as { onlinePaymentAmount?: number }).onlinePaymentAmount) || 0,
      productPriceTotal: productTotalForSettlement,
      couponDiscount: Math.abs(Number(editData.coupon_discount) || 0),
      additionalDiscount: Number(editData.additional_discount) || 0,
      optionTotalSum: cancelledOtaSettle ? 0 : Number(editData.option_total) || 0,
      additionalCost: Number(editData.additional_cost) || 0,
      tax: Number(editData.tax) || 0,
      cardFee: Number(editData.card_fee) || 0,
      prepaymentTip: Number(editData.prepayment_tip) || 0,
      onSiteBalanceAmount: Number(editData.balance_amount) || 0,
      returnedAmount,
      partnerReceivedAmount: partnerReceivedForSettlement,
      commissionAmount: Number(editData.commission_amount) || 0,
      reservationStatus: reservation.status ?? null,
      isOTAChannel,
    })
  }, [
    editData,
    reservation,
    isReservationCancelled,
    isOTAChannel,
    returnedAmount,
    partnerReceivedForSettlement,
  ])

  const revenueDisplayInput = useMemo(() => {
    if (!editData || !reservation) return null
    return {
      isReservationCancelled,
      isOTAChannel,
      channelSettlementBeforePartnerReturn: channelSettlementForDisplay,
      reservationOptionsTotalPrice: reservationOptionsTotalUsd,
      notIncludedTotalUsd: notIncludedBreakdownModal.totalUsd,
      additionalDiscount: editData.additional_discount || 0,
      additionalCost: editData.additional_cost || 0,
      tax: editData.tax || 0,
      cardFee: editData.card_fee || 0,
      prepaymentCost: editData.prepayment_cost || 0,
      prepaymentTip: editData.prepayment_tip || 0,
      refundedAmount,
    }
  }, [
    editData,
    reservation,
    isReservationCancelled,
    isOTAChannel,
    channelSettlementForDisplay,
    reservationOptionsTotalUsd,
    notIncludedBreakdownModal.totalUsd,
    refundedAmount,
  ])

  const totalRevenueDisplay = useMemo(() => {
    if (!revenueDisplayInput) return 0
    return computePricingSectionDisplayTotalRevenue(revenueDisplayInput)
  }, [revenueDisplayInput])

  const operatingProfitDisplay = useMemo(() => {
    if (!revenueDisplayInput) return 0
    return computePricingSectionDisplayOperatingProfit(revenueDisplayInput)
  }, [revenueDisplayInput])

"""

if "notIncludedBreakdownModal" not in text:
    text = text.replace(
        "  if (!isOpen || !reservation) return null\n\n  return (",
        memo + "\n  if (!isOpen || !reservation) return null\n\n  return (",
        1,
    )

path.write_text(text, encoding="utf-8")
print("patch_pricing_info_modal phase2 done")
