'use client'

import { useState } from 'react'
import { FileText, Mail, Download, Eye } from 'lucide-react'
import { generateTemplateContext } from '@/lib/templateContext'
import { renderTemplateString } from '@/lib/template'

interface SimpleDocumentGeneratorProps {
  reservationId: string
  customerName: string
  productName: string
  tourDate: string
  pickupTime: string
  pickupLocation: string
}

export default function SimpleDocumentGenerator({
  reservationId,
  customerName,
  productName,
  tourDate,
  pickupTime,
  pickupLocation
}: SimpleDocumentGeneratorProps) {
  const [generating, setGenerating] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<null | 'voucher' | 'pickup'>(null)
  const [generatedContent, setGeneratedContent] = useState<{
    voucher: string
    pickup: string
  }>({ voucher: '', pickup: '' })

  // 간단한 템플릿들
  const templates = {
    voucher: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #2563eb; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">🎫 투어 바우처</h1>
          <p style="color: #666; margin: 5px 0;">Tour Voucher</p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #1e40af; margin-top: 0;">예약 정보</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">고객명:</td>
              <td style="padding: 8px 0; color: #111827;">{{customer.name}}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">상품명:</td>
              <td style="padding: 8px 0; color: #111827;">{{product.name_ko}}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">투어 날짜:</td>
              <td style="padding: 8px 0; color: #111827;">{{reservation.tour_date}}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">픽업 시간:</td>
              <td style="padding: 8px 0; color: #111827;">{{reservation.pickup_time}}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">픽업 장소:</td>
              <td style="padding: 8px 0; color: #111827;">{{pickup.display}}</td>
            </tr>
          </table>
        </div>
        
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #92400e; margin-top: 0;">📋 중요 안내사항</h3>
          <ul style="color: #92400e; margin: 0; padding-left: 20px;">
            <li>투어 당일 픽업 시간 10분 전까지 픽업 장소에 도착해 주세요</li>
            <li>신분증을 지참해 주세요</li>
            <li>날씨에 따라 일정이 변경될 수 있습니다</li>
            <li>문의사항이 있으시면 연락주세요</li>
          </ul>
        </div>
        
        <div style="text-align: center; color: #666; font-size: 14px;">
          <p>이 바우처를 투어 당일 가이드에게 제시해 주세요</p>
          <p style="margin: 5px 0;">감사합니다! 즐거운 투어 되세요! 🎉</p>
        </div>
      </div>
    `,
    
    pickup: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #059669; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #059669; margin: 0;">🚌 픽업 안내</h1>
          <p style="color: #666; margin: 5px 0;">Pickup Information</p>
        </div>
        
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #047857; margin-top: 0;">픽업 정보</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">고객명:</td>
              <td style="padding: 8px 0; color: #111827;">{{customer.name}}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">투어 날짜:</td>
              <td style="padding: 8px 0; color: #111827;">{{reservation.tour_date}}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">픽업 시간:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 18px; font-weight: bold;">{{reservation.pickup_time}}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">픽업 장소:</td>
              <td style="padding: 8px 0; color: #111827;">{{pickup.display}}</td>
            </tr>
          </table>
        </div>
        
        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #1e40af; margin-top: 0;">📍 픽업 장소 안내</h3>
          <p style="color: #1e40af; margin: 0;">{{pickup.display}}에서 투어 버스가 대기하고 있습니다.</p>
          <p style="color: #1e40af; margin: 5px 0 0 0;">정확한 픽업 시간에 맞춰 도착해 주세요.</p>
        </div>
        
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #92400e; margin-top: 0;">⚠️ 주의사항</h3>
          <ul style="color: #92400e; margin: 0; padding-left: 20px;">
            <li>픽업 시간 10분 전까지 도착해 주세요</li>
            <li>버스는 정시에 출발합니다</li>
            <li>늦으실 경우 다음 픽업 장소로 이동하시기 바랍니다</li>
            <li>긴급상황 시 연락주세요</li>
          </ul>
        </div>
        
        <div style="text-align: center; color: #666; font-size: 14px;">
          <p>안전하고 즐거운 투어 되세요! 🚌✨</p>
        </div>
      </div>
    `
  }

  const generateDocument = async (type: 'voucher' | 'pickup') => {
    setGenerating(true)
    try {
      console.log(`${type} 문서 생성 시작...`)
      
      // 템플릿 컨텍스트 생성 (에러가 발생해도 기본 데이터 사용)
      let context = null
      try {
        context = await generateTemplateContext(reservationId, 'ko')
        console.log('템플릿 컨텍스트 생성 완료:', context ? Object.keys(context) : 'null')
      } catch (error) {
        console.warn('템플릿 컨텍스트 생성 실패:', error)
        console.log('기본 컨텍스트 데이터 사용')
        // 기본 컨텍스트 데이터 제공
        context = {
          reservation: {
            id: reservationId,
            tour_date: tourDate,
            pickup_time: pickupTime,
            adults: 2,
            child: 0,
            infant: 0,
            total_price: 100000,
            status: 'confirmed'
          },
          customer: {
            name: customerName || '고객',
            email: 'customer@example.com',
            phone: '010-0000-0000',
            language: 'ko'
          },
          product: {
            name_ko: productName || '투어 상품',
            name_en: 'Tour Product',
            category: '투어',
            sub_category: '일반'
          },
          channel: {
            name: '일반 채널',
            type: 'direct'
          },
          pickup: {
            display: pickupLocation || '기본 픽업 호텔',
            hotel_name: pickupLocation || '기본 픽업 호텔',
            pick_up_location: '호텔 로비',
            address: '서울시 강남구',
            description_ko: '호텔 로비에서 픽업',
            description_en: 'Pickup at hotel lobby'
          }
        }
      }
      
      if (!context) {
        console.error('템플릿 컨텍스트 생성 실패')
        return
      }
      
      // 템플릿 렌더링
      const renderedContent = renderTemplateString(templates[type], context)
      
      setGeneratedContent(prev => ({
        ...prev,
        [type]: renderedContent
      }))
      
      console.log(`${type} 문서 생성 완료`)
    } catch (error) {
      console.error(`${type} 문서 생성 오류:`, error)
      // 오류 발생 시에도 기본 문서 생성
      const fallbackContext = {
        reservation: {
          id: reservationId,
          tour_date: tourDate,
          pickup_time: pickupTime,
          adults: 2,
          child: 0,
          infant: 0,
          total_price: 100000,
          status: 'confirmed'
        },
        customer: {
          name: customerName || '고객',
          email: 'customer@example.com',
          phone: '010-0000-0000',
          language: 'ko'
        },
        product: {
          name_ko: productName || '투어 상품',
          name_en: 'Tour Product',
          category: '투어',
          sub_category: '일반'
        },
        channel: {
          name: '일반 채널',
          type: 'direct'
        },
        pickup: {
          display: pickupLocation || '기본 픽업 호텔',
          hotel_name: pickupLocation || '기본 픽업 호텔',
          pick_up_location: '호텔 로비',
          address: '서울시 강남구',
          description_ko: '호텔 로비에서 픽업',
          description_en: 'Pickup at hotel lobby'
        }
      }
      
      const renderedContent = renderTemplateString(templates[type], fallbackContext)
      setGeneratedContent(prev => ({
        ...prev,
        [type]: renderedContent
      }))
    } finally {
      setGenerating(false)
    }
  }

  const downloadDocument = (type: 'voucher' | 'pickup') => {
    const content = generatedContent[type]
    if (!content) return
    
    const blob = new Blob([content], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type === 'voucher' ? '투어바우처' : '픽업안내'}_${customerName}_${tourDate}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const sendEmail = (type: 'voucher' | 'pickup') => {
    const content = generatedContent[type]
    if (!content) return
    
    const subject = type === 'voucher' ? '투어 바우처' : '픽업 안내'
    const body = encodeURIComponent(content)
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${body}`
    window.open(mailtoLink)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">📄 간편 문서 생성</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 투어 바우처 */}
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <h4 className="font-medium text-gray-900">투어 바우처</h4>
          </div>
          
          <div className="space-y-2">
            <button
              onClick={() => generateDocument('voucher')}
              disabled={generating}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {generating ? '생성 중...' : '바우처 생성'}
            </button>
            
            {generatedContent.voucher && (
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewDoc(previewDoc === 'voucher' ? null : 'voucher')}
                  className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm flex items-center justify-center gap-1"
                >
                  <Eye className="w-4 h-4" />
                  미리보기
                </button>
                <button
                  onClick={() => downloadDocument('voucher')}
                  className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm flex items-center justify-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  다운로드
                </button>
                <button
                  onClick={() => sendEmail('voucher')}
                  className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-sm flex items-center justify-center gap-1"
                >
                  <Mail className="w-4 h-4" />
                  이메일
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 픽업 안내 */}
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-green-600" />
            <h4 className="font-medium text-gray-900">픽업 안내</h4>
          </div>
          
          <div className="space-y-2">
            <button
              onClick={() => generateDocument('pickup')}
              disabled={generating}
              className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
            >
              {generating ? '생성 중...' : '픽업 안내 생성'}
            </button>
            
            {generatedContent.pickup && (
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewDoc(previewDoc === 'pickup' ? null : 'pickup')}
                  className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm flex items-center justify-center gap-1"
                >
                  <Eye className="w-4 h-4" />
                  미리보기
                </button>
                <button
                  onClick={() => downloadDocument('pickup')}
                  className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm flex items-center justify-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  다운로드
                </button>
                <button
                  onClick={() => sendEmail('pickup')}
                  className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-sm flex items-center justify-center gap-1"
                >
                  <Mail className="w-4 h-4" />
                  이메일
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 미리보기 모달 */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {previewDoc === 'voucher' ? '투어 바우처 미리보기' : '픽업 안내 미리보기'}
                </h2>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="border rounded-lg p-6 bg-white overflow-y-auto max-h-[70vh]">
                <div dangerouslySetInnerHTML={{ __html: generatedContent[previewDoc] }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
