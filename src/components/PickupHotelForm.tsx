'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import {
  Building2,
  Check,
  Clipboard,
  Copy,
  ExternalLink,
  Footprints,
  ImageIcon,
  Languages,
  Link2,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  Route,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  translatePickupHotelFields,
  type PickupHotelTranslationFields,
} from '@/lib/translationService'
import { suggestHotelDescription } from '@/lib/chatgptService'
import { findRoundedGroupHotel, type PickupHotel } from '@/utils/pickupHotelUtils'
import PickupHotelDirectionStepsEditor from '@/components/pickup-hotel/PickupHotelDirectionStepsEditor'
import PickupHotelVehicleAccessSelect from '@/components/pickup-hotel/PickupHotelVehicleAccessSelect'
import {
  parseDirectionSteps,
  serializeDirectionSteps,
} from '@/lib/pickupHotelDirectionSteps'

interface PickupHotelFormProps {
  hotel?: PickupHotel | null
  allHotels?: PickupHotel[]
  onSubmit: (hotelData: Omit<PickupHotel, 'id' | 'created_at' | 'updated_at'>) => void
  onCancel: () => void
  onDelete?: (id: string) => void
  onCopy?: () => void
  onAddNew?: () => void
  translations: {
    title: string
    editTitle: string
    hotel: string
    pickUpLocation: string
    descriptionKo: string
    descriptionEn: string
    address: string
    pin: string
    link: string
    media: string
    cancel: string
    add: string
    edit: string
  }
}

type DirectionLanguage = 'ko' | 'en'

const inputClass =
  'h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15'
const textareaClass =
  'w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-sm leading-5 text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15'
const secondaryButtonClass =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

const isValidYouTubeUrl = (url: string): boolean => {
  const youtubeRegex =
    /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[\w-]+/
  return youtubeRegex.test(url)
}

const convertGoogleDriveUrl = (url: string): string => {
  const trimmed = url.trim()
  if (!trimmed.includes('drive.google.com/file/d/')) return trimmed
  const fileId = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1]
  return fileId ? `https://drive.google.com/uc?export=view&id=${fileId}` : trimmed
}

function FieldLabel({
  children,
  required = false,
}: {
  children: ReactNode
  required?: boolean
}) {
  return (
    <label className="mb-1 block text-xs font-semibold text-foreground">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  )
}

function SectionCard({
  number,
  title,
  description,
  children,
}: {
  number: number
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card p-3 shadow-sm sm:p-3.5">
      <div className="mb-2.5 flex items-center gap-2 border-b border-border/50 pb-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold tracking-tight text-card-foreground">
            {title}
          </h3>
          {description && (
            <p className="text-[11px] leading-4 text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  tone,
}: {
  checked: boolean
  onChange: () => void
  label: string
  tone: 'blue' | 'green'
}) {
  const enabledClass = tone === 'green' ? 'bg-emerald-600' : 'bg-blue-600'
  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground sm:text-sm">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
          checked ? enabledClass : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const copyValue = async () => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      alert('클립보드에 복사하지 못했습니다.')
    }
  }

  return (
    <button
      type="button"
      onClick={copyValue}
      disabled={!value}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={`${label} 복사`}
      title={`${label} 복사`}
    >
      {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
    </button>
  )
}

function LocalFilePreview({ file, alt }: { file: File; alt: string }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  if (!url) return <div className="h-full w-full animate-pulse bg-muted" />
  if (!file.type.startsWith('image/')) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <Video className="text-muted-foreground" />
      </div>
    )
  }

  return <Image src={url} alt={alt} fill unoptimized className="object-cover" />
}

function RemoteImagePreview({
  url,
  alt,
  onClick,
}: {
  url: string
  alt: string
  onClick: () => void
}) {
  if (!url.trim()) {
    return (
      <div className="flex h-full min-h-24 flex-col items-center justify-center gap-1 bg-muted/60 text-muted-foreground">
        <ImageIcon size={20} />
        <span className="text-[11px]">URL 입력</span>
      </div>
    )
  }

  return (
    <button type="button" onClick={onClick} className="relative block h-full w-full">
      <Image
        src={convertGoogleDriveUrl(url)}
        alt={alt}
        fill
        unoptimized
        className="object-cover transition duration-300 hover:scale-[1.02]"
      />
    </button>
  )
}

export default function PickupHotelForm({
  hotel,
  allHotels = [],
  onSubmit,
  onCancel,
  onDelete,
  onCopy,
  onAddNew,
  translations,
}: PickupHotelFormProps) {
  const [formData, setFormData] = useState({
    hotel: hotel?.hotel || '',
    internal_name: hotel?.internal_name || '',
    pick_up_location: hotel?.pick_up_location || '',
    description_ko: hotel?.description_ko || '',
    description_en: hotel?.description_en || '',
    from_inside_hotel_ko: hotel?.from_inside_hotel_ko || '',
    from_inside_hotel_en: hotel?.from_inside_hotel_en || '',
    from_outside_hotel_ko: hotel?.from_outside_hotel_ko || '',
    from_outside_hotel_en: hotel?.from_outside_hotel_en || '',
    to_representative_hotel_ko: hotel?.to_representative_hotel_ko || '',
    to_representative_hotel_en: hotel?.to_representative_hotel_en || '',
    allowed_pickup_access_classes: hotel?.allowed_pickup_access_classes ?? null,
    address: hotel?.address || '',
    pin: hotel?.pin || '',
    link: hotel?.link || '',
    landmark: hotel?.landmark || '',
    youtube_link: hotel?.youtube_link || '',
    memo: hotel?.memo || '',
    display_order: hotel?.display_order ?? null,
    map_image: hotel?.map_image || '',
    media: hotel?.media || [],
    is_active: hotel?.is_active ?? true,
    use_for_pickup: hotel?.use_for_pickup ?? true,
    group_number: hotel?.group_number ?? null,
  })

  const [insideLanguage, setInsideLanguage] = useState<DirectionLanguage>('ko')
  const [outsideLanguage, setOutsideLanguage] = useState<DirectionLanguage>('ko')
  const [uploading, setUploading] = useState(false)
  const [mainMediaFile, setMainMediaFile] = useState<File | null>(null)
  const [additionalMediaFiles, setAdditionalMediaFiles] = useState<File[]>([])
  const [mapImageFile, setMapImageFile] = useState<File | null>(null)
  const mainMediaInputRef = useRef<HTMLInputElement>(null)
  const additionalMediaInputRef = useRef<HTMLInputElement>(null)
  const mapImageInputRef = useRef<HTMLInputElement>(null)
  const [translating, setTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestionError, setSuggestionError] = useState<string | null>(null)
  const [showMapModal, setShowMapModal] = useState(false)
  const [showToRepresentativeModal, setShowToRepresentativeModal] = useState(false)
  const [translatingToRepresentative, setTranslatingToRepresentative] = useState(false)
  const [toRepresentativeTranslateError, setToRepresentativeTranslateError] =
    useState<string | null>(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState('')
  const [selectedAddress, setSelectedAddress] = useState('')
  const [selectedGoogleMapLink, setSelectedGoogleMapLink] = useState('')
  const [mapLoaded, setMapLoaded] = useState(false)

  const mainMedia = formData.media[0] || ''
  const additionalMedia = formData.media.slice(1)
  const representativeHotel =
    formData.group_number != null
      ? findRoundedGroupHotel(formData.group_number, allHotels)
      : null
  const isRepresentativeHotel =
    representativeHotel != null &&
    (hotel?.id
      ? representativeHotel.id === hotel.id
      : representativeHotel.group_number === formData.group_number)
  const hasToRepresentativeDirections = Boolean(
    formData.to_representative_hotel_ko.trim() ||
      formData.to_representative_hotel_en.trim()
  )

  const updateMedia = (index: number, value: string) => {
    setFormData((prev) => {
      const media = [...prev.media]
      while (media.length <= index) media.push('')
      media[index] = value
      return { ...prev, media }
    })
  }

  const removeMedia = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      media: prev.media.filter((_, mediaIndex) => mediaIndex !== index),
    }))
  }

  const openImageModal = (url: string) => {
    if (!url.trim()) return
    setSelectedImageUrl(convertGoogleDriveUrl(url))
    setShowImageModal(true)
  }

  const uploadFile = async (file: File): Promise<string> => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileName = `${Date.now()}_${crypto.randomUUID()}_${safeName}`
    const { error } = await supabase.storage
      .from('pickup-hotel-media')
      .upload(fileName, file)

    if (error) throw error

    const { data } = supabase.storage
      .from('pickup-hotel-media')
      .getPublicUrl(fileName)
    return data.publicUrl
  }

  const handleMapCoordinateSelect = (lat: number, lng: number, address?: string) => {
    const coordinates = `${lat}, ${lng}`
    const googleMapLink = `https://www.google.com/maps?q=${lat},${lng}`

    setFormData((prev) => ({
      ...prev,
      pin: coordinates,
      address: address || prev.address,
      link: googleMapLink,
    }))
    setShowMapModal(false)
  }

  const initializeMap = () => {
    if (typeof window === 'undefined' || !window.google?.maps) return
    const mapElement = document.getElementById('map')
    if (!mapElement) return

    const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
    const mapOptions: {
      center: { lat: number; lng: number }
      zoom: number
      mapTypeId: string
      mapId?: string
    } = {
      center: { lat: 36.1699, lng: -115.1398 },
      zoom: 12,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
    }
    if (mapId) mapOptions.mapId = mapId

    const map = new window.google.maps.Map(mapElement, mapOptions)
    let marker: google.maps.Marker | google.maps.marker.AdvancedMarkerElement | null = null

    map.addListener('click', (event: google.maps.MapMouseEvent) => {
      const lat = event.latLng?.lat()
      const lng = event.latLng?.lng()
      if (lat == null || lng == null) return

      if (marker && 'setMap' in marker) marker.setMap(null)
      if (window.google?.maps?.marker?.AdvancedMarkerElement && mapId) {
        marker = new window.google.maps.marker.AdvancedMarkerElement({
          position: { lat, lng },
          map,
          title: '선택된 위치',
        })
      } else {
        marker = new window.google.maps.Marker({
          position: { lat, lng },
          map,
          title: '선택된 위치',
        })
      }

      const latInput = document.getElementById('latitude') as HTMLInputElement
      const lngInput = document.getElementById('longitude') as HTMLInputElement
      if (latInput) latInput.value = lat.toString()
      if (lngInput) lngInput.value = lng.toString()

      const geocoder = new window.google.maps.Geocoder()
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          setSelectedAddress(results[0].formatted_address ?? '')
          setSelectedGoogleMapLink(`https://www.google.com/maps?q=${lat},${lng}`)
        }
      })
    })
    setMapLoaded(true)
  }

  const handleMapSearch = async () => {
    const searchTerm = (document.getElementById('mapSearch') as HTMLInputElement)?.value
    if (!searchTerm || !window.google?.maps) return

    try {
      const geocoder = new window.google.maps.Geocoder()
      geocoder.geocode({ address: `${searchTerm} Las Vegas` }, (results, status) => {
        if (status !== 'OK' || !results?.[0]) {
          alert('검색 결과를 찾을 수 없습니다.')
          return
        }

        const location = results[0].geometry.location
        const lat = location.lat()
        const lng = location.lng()
        const address = results[0].formatted_address ?? ''
        const mapElement = document.getElementById('map')
        if (!mapElement || !window.google?.maps) return

        const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
        const mapOptions: {
          center: { lat: number; lng: number }
          zoom: number
          mapTypeId: string
          mapId?: string
        } = {
          center: { lat, lng },
          zoom: 15,
          mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        }
        if (mapId) mapOptions.mapId = mapId

        const map = new window.google.maps.Map(mapElement, mapOptions)
        if (window.google?.maps?.marker?.AdvancedMarkerElement && mapId) {
          new window.google.maps.marker.AdvancedMarkerElement({
            position: { lat, lng },
            map,
            title: searchTerm,
          })
        } else {
          new window.google.maps.Marker({
            position: { lat, lng },
            map,
            title: searchTerm,
          })
        }

        const latInput = document.getElementById('latitude') as HTMLInputElement
        const lngInput = document.getElementById('longitude') as HTMLInputElement
        if (latInput) latInput.value = lat.toString()
        if (lngInput) lngInput.value = lng.toString()
        setSelectedAddress(address)
        setSelectedGoogleMapLink(`https://www.google.com/maps?q=${lat},${lng}`)
      })
    } catch (error) {
      console.error('검색 오류:', error)
      alert('검색 중 오류가 발생했습니다.')
    }
  }

  useEffect(() => {
    if (!showMapModal || mapLoaded) return

    if (!window.google) {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        alert(
          'Google Maps API 키가 설정되지 않았습니다. 환경변수 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY를 설정해주세요.'
        )
        return
      }

      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src*="maps.googleapis.com/maps/api/js"]'
      )
      if (existingScript) {
        existingScript.addEventListener('load', initializeMap, { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async`
      script.async = true
      script.defer = true
      script.onload = () => window.setTimeout(initializeMap, 100)
      script.onerror = () =>
        alert('Google Maps API 로드 중 오류가 발생했습니다. API 키를 확인해주세요.')
      document.head.appendChild(script)
    } else {
      window.setTimeout(initializeMap, 100)
    }
  }, [showMapModal, mapLoaded])

  const translateHotelData = async () => {
    setTranslating(true)
    setTranslationError(null)
    try {
      const fieldsToTranslate: PickupHotelTranslationFields = {
        hotel: formData.hotel,
        pick_up_location: formData.pick_up_location,
        description_ko: formData.description_ko,
        from_inside_hotel_ko: formData.from_inside_hotel_ko,
        from_outside_hotel_ko: formData.from_outside_hotel_ko,
        to_representative_hotel_ko: formData.to_representative_hotel_ko,
        address: formData.address,
      }
      const result = await translatePickupHotelFields(fieldsToTranslate)
      if (result.success && result.translatedFields) {
        const translated = result.translatedFields
        setFormData((prev) => ({
          ...prev,
          description_en: translated.description_ko || prev.description_en,
          from_inside_hotel_en:
            translated.from_inside_hotel_ko || prev.from_inside_hotel_en,
          from_outside_hotel_en:
            translated.from_outside_hotel_ko || prev.from_outside_hotel_en,
          to_representative_hotel_en:
            translated.to_representative_hotel_ko ||
            prev.to_representative_hotel_en,
        }))
      } else {
        setTranslationError(result.error || '번역에 실패했습니다.')
      }
    } catch (error) {
      setTranslationError(
        `번역 중 오류가 발생했습니다: ${
          error instanceof Error ? error.message : '알 수 없는 오류'
        }`
      )
    } finally {
      setTranslating(false)
    }
  }

  const suggestHotelDescriptionContent = async () => {
    setSuggesting(true)
    setSuggestionError(null)
    try {
      const suggestedDescription = await suggestHotelDescription(
        formData.hotel,
        formData.address
      )
      setFormData((prev) => ({ ...prev, description_ko: suggestedDescription }))
    } catch (error) {
      setSuggestionError(
        error instanceof Error ? error.message : 'ChatGPT 추천 중 오류가 발생했습니다.'
      )
    } finally {
      setSuggesting(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!formData.hotel.trim()) {
      alert('호텔명을 입력해주세요.')
      return
    }
    if (!formData.pick_up_location.trim()) {
      alert('픽업 위치를 입력해주세요.')
      return
    }
    if (!formData.address.trim()) {
      alert('주소를 입력해주세요.')
      return
    }
    if (formData.youtube_link && !isValidYouTubeUrl(formData.youtube_link)) {
      alert('올바른 YouTube 링크를 입력해주세요. (예: https://www.youtube.com/watch?v=...)')
      return
    }

    setUploading(true)
    try {
      const [uploadedMain, uploadedAdditional, uploadedMapImage] = await Promise.all([
        mainMediaFile ? uploadFile(mainMediaFile) : Promise.resolve(''),
        Promise.all(additionalMediaFiles.map(uploadFile)),
        mapImageFile ? uploadFile(mapImageFile) : Promise.resolve(''),
      ])

      const rebuiltMedia = [
        uploadedMain || convertGoogleDriveUrl(mainMedia),
        ...additionalMedia.map(convertGoogleDriveUrl),
        ...uploadedAdditional,
      ].filter(Boolean)

      onSubmit({
        ...formData,
        internal_name: formData.internal_name.trim() || null,
        media: rebuiltMedia,
        map_image: uploadedMapImage || convertGoogleDriveUrl(formData.map_image),
      })
    } catch (error) {
      console.error('Error uploading media:', error)
      alert('미디어 파일 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const directionValue = (
    location: 'inside' | 'outside',
    language: DirectionLanguage
  ) => {
    const key = `from_${location}_hotel_${language}` as
      | 'from_inside_hotel_ko'
      | 'from_inside_hotel_en'
      | 'from_outside_hotel_ko'
      | 'from_outside_hotel_en'
    return { key, steps: parseDirectionSteps(formData[key]) }
  }

  const renderLanguageTabs = (
    language: DirectionLanguage,
    setLanguage: (language: DirectionLanguage) => void,
    accent: 'blue' | 'green'
  ) => (
    <div className="inline-flex rounded-lg border border-border bg-white p-1 shadow-sm">
      {(['ko', 'en'] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLanguage(item)}
          className={`rounded-md px-3 py-1 text-xs font-bold transition ${
            language === item
              ? accent === 'green'
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 text-white'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  )

  const insideDirection = directionValue('inside', insideLanguage)
  const outsideDirection = directionValue('outside', outsideLanguage)

  return (
    <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/55 p-1.5 backdrop-blur-sm sm:p-3">
      <div className="mx-auto flex min-h-full max-w-5xl items-start justify-center">
        <div className="my-1 flex max-h-[calc(100dvh-0.75rem)] w-full flex-col overflow-hidden rounded-xl border border-white/20 bg-muted/40 shadow-2xl sm:my-2 sm:max-h-[calc(100dvh-1.5rem)]">
          <header className="shrink-0 border-b border-border bg-white px-3 py-2.5 sm:px-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      {hotel ? 'Edit Hotel' : 'Add Hotel'}
                    </h2>
                    {hotel && (
                      <span className="max-w-full truncate rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                        ID: {hotel.id}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Toggle
                  checked={formData.is_active}
                  label="Active"
                  tone="blue"
                  onChange={() =>
                    setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))
                  }
                />
                <Toggle
                  checked={formData.use_for_pickup}
                  label="픽업 사용"
                  tone="green"
                  onChange={() =>
                    setFormData((prev) => ({
                      ...prev,
                      use_for_pickup: !prev.use_for_pickup,
                    }))
                  }
                />
                <span className="hidden h-5 w-px bg-border md:block" />
                {onCopy && (
                  <button type="button" onClick={onCopy} className={secondaryButtonClass}>
                    <Clipboard size={14} />
                    복사
                  </button>
                )}
                {onAddNew && (
                  <button type="button" onClick={onAddNew} className={secondaryButtonClass}>
                    <Plus size={14} />
                    새 호텔
                  </button>
                )}
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="닫기"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <main className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5 sm:px-4 sm:py-3">
              <div className="space-y-2.5">
                {(translationError || suggestionError) && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {translationError || suggestionError}
                  </div>
                )}

                <SectionCard number={1} title="기본 정보">
                  <div className="grid gap-2.5 md:grid-cols-2">
                    <div>
                      <FieldLabel required>{translations.hotel}</FieldLabel>
                      <input
                        value={formData.hotel}
                        onChange={(event) =>
                          setFormData((prev) => ({
                            ...prev,
                            hotel: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="예: Bellagio Hotel & Casino"
                        required
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        고객 안내에 표시되는 전체 이름
                      </p>
                    </div>
                    <div>
                      <FieldLabel>내부용 이름</FieldLabel>
                      <input
                        value={formData.internal_name}
                        onChange={(event) =>
                          setFormData((prev) => ({
                            ...prev,
                            internal_name: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="예: 벨라지오"
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        배정 관리 예약 카드에만 표시되며, 비워두면 전체 이름을 사용합니다.
                      </p>
                    </div>
                    <div>
                      <FieldLabel required>{translations.pickUpLocation}</FieldLabel>
                      <input
                        value={formData.pick_up_location}
                        onChange={(event) =>
                          setFormData((prev) => ({
                            ...prev,
                            pick_up_location: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="예: Rear Tour Lobby"
                        required
                      />
                    </div>
                    <div>
                      <FieldLabel>그룹 번호</FieldLabel>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.group_number ?? ''}
                        onChange={(event) =>
                          setFormData((prev) => ({
                            ...prev,
                            group_number: event.target.value
                              ? Number(event.target.value)
                              : null,
                          }))
                        }
                        className={inputClass}
                        placeholder="1.12"
                      />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  number={2}
                  title="위치 설명"
                  >
                  <div className="mb-2 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={translateHotelData}
                      disabled={translating}
                      className={secondaryButtonClass}
                    >
                      {translating ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Languages size={16} />
                      )}
                      {translating ? '번역 중' : 'KO → EN'}
                    </button>
                    <button
                      type="button"
                      onClick={suggestHotelDescriptionContent}
                      disabled={suggesting}
                      className={secondaryButtonClass}
                    >
                      {suggesting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Sparkles size={16} />
                      )}
                      {suggesting ? '추천 중' : 'AI 추천'}
                    </button>
                  </div>
                  <div className="grid gap-2.5 md:grid-cols-2">
                    <div>
                      <FieldLabel>위치 설명 (한국어)</FieldLabel>
                      <textarea
                        rows={2}
                        value={formData.description_ko}
                        onChange={(event) =>
                          setFormData((prev) => ({
                            ...prev,
                            description_ko: event.target.value,
                          }))
                        }
                        className={textareaClass}
                        placeholder="고객이 픽업 장소를 쉽게 찾을 수 있도록 설명하세요."
                      />
                    </div>
                    <div>
                      <FieldLabel>Location Description (English)</FieldLabel>
                      <textarea
                        rows={2}
                        value={formData.description_en}
                        onChange={(event) =>
                          setFormData((prev) => ({
                            ...prev,
                            description_en: event.target.value,
                          }))
                        }
                        className={textareaClass}
                        placeholder="Describe how guests can identify the pickup area."
                      />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  number={3}
                  title="찾아가는 방법"
                  >
                  <div className="grid gap-2.5 lg:grid-cols-2">
                    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-2.5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5 text-blue-800">
                          <span className="rounded-md bg-blue-100 p-1">
                            <Building2 size={14} />
                          </span>
                          <div>
                            <h4 className="text-sm font-semibold">From Inside</h4>
                            </div>
                        </div>
                        {renderLanguageTabs(
                          insideLanguage,
                          setInsideLanguage,
                          'blue'
                        )}
                      </div>
                      <PickupHotelDirectionStepsEditor
                        steps={insideDirection.steps}
                        accent="blue"
                        onChange={(steps) =>
                          setFormData((prev) => ({
                            ...prev,
                            [insideDirection.key]: serializeDirectionSteps(steps),
                          }))
                        }
                        placeholder={
                          insideLanguage === 'ko'
                            ? '예: 메인 로비에서 투어 로비 표지판을 따라가세요.'
                            : 'e.g. Follow the Tour Lobby signs from the main lobby.'
                        }
                      />
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5 text-emerald-800">
                          <span className="rounded-md bg-emerald-100 p-1">
                            <Footprints size={14} />
                          </span>
                          <div>
                            <h4 className="text-sm font-semibold">From Outside</h4>
                            </div>
                        </div>
                        {renderLanguageTabs(
                          outsideLanguage,
                          setOutsideLanguage,
                          'green'
                        )}
                      </div>
                      <PickupHotelDirectionStepsEditor
                        steps={outsideDirection.steps}
                        accent="green"
                        onChange={(steps) =>
                          setFormData((prev) => ({
                            ...prev,
                            [outsideDirection.key]: serializeDirectionSteps(steps),
                          }))
                        }
                        placeholder={
                          outsideLanguage === 'ko'
                            ? '예: 메인 입구 우측의 투어 픽업 구역으로 이동하세요.'
                            : 'e.g. Walk to the tour pickup area right of the main entrance.'
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-col gap-2 rounded-lg border border-border bg-muted/35 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">
                        대표 호텔 이동 안내
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        {representativeHotel
                          ? `대표: ${representativeHotel.hotel}`
                          : formData.group_number != null
                            ? '현재 그룹의 대표 호텔을 찾지 못했습니다.'
                            : '그룹 번호를 설정하면 대표 호텔이 표시됩니다.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setToRepresentativeTranslateError(null)
                        setShowToRepresentativeModal(true)
                      }}
                      className={secondaryButtonClass}
                    >
                      <Route size={14} />
                      {hasToRepresentativeDirections ? '이동 안내 수정' : '이동 안내 작성'}
                      {hasToRepresentativeDirections && (
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                          작성됨
                        </span>
                      )}
                    </button>
                  </div>
                </SectionCard>

                <SectionCard
                  number={4}
                  title="차량 이용 안내"
                  >
                  <PickupHotelVehicleAccessSelect
                    value={formData.allowed_pickup_access_classes}
                    onChange={(classes) =>
                      setFormData((prev) => ({
                        ...prev,
                        allowed_pickup_access_classes: classes,
                      }))
                    }
                  />
                </SectionCard>

                <SectionCard number={5} title="위치 정보">
                  <div className="grid gap-2.5 md:grid-cols-2">
                    <div className="rounded-lg border border-border/70 bg-muted/25 p-2.5">
                      <div className="mb-1 flex items-center gap-1.5">
                        <MapPin size={14} className="text-primary" />
                        <FieldLabel required>{translations.address}</FieldLabel>
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={formData.address}
                          onChange={(event) =>
                            setFormData((prev) => ({
                              ...prev,
                              address: event.target.value,
                            }))
                          }
                          className={inputClass}
                          placeholder="호텔 전체 주소"
                          required
                        />
                        <CopyButton value={formData.address} label="주소" />
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/70 bg-muted/25 p-2.5">
                      <div className="mb-1 flex items-center gap-1.5">
                        <Navigation size={14} className="text-primary" />
                        <FieldLabel>{translations.pin}</FieldLabel>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <input
                          value={formData.pin}
                          onChange={(event) =>
                            setFormData((prev) => ({
                              ...prev,
                              pin: event.target.value,
                            }))
                          }
                          className={`${inputClass} min-w-44 flex-1`}
                          placeholder="36.1699, -115.1398"
                        />
                        <CopyButton value={formData.pin} label="좌표" />
                        <button
                          type="button"
                          onClick={() => {
                            setMapLoaded(false)
                            setShowMapModal(true)
                          }}
                          className={secondaryButtonClass}
                        >
                          <MapPin size={16} />
                          지도
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/70 bg-muted/25 p-2.5">
                      <div className="mb-1 flex items-center gap-1.5">
                        <Link2 size={14} className="text-primary" />
                        <FieldLabel>{translations.link}</FieldLabel>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={formData.link}
                          onChange={(event) =>
                            setFormData((prev) => ({
                              ...prev,
                              link: event.target.value,
                            }))
                          }
                          className={inputClass}
                          placeholder="https://maps.google.com/..."
                        />
                        {formData.link && (
                          <a
                            href={formData.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            aria-label="Google Map 링크 열기"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                        <CopyButton value={formData.link} label="Google Map 링크" />
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/70 bg-muted/25 p-2.5">
                      <div className="mb-1 flex items-center gap-1.5">
                        <Building2 size={14} className="text-primary" />
                        <FieldLabel>랜드마크</FieldLabel>
                      </div>
                      <input
                        value={formData.landmark}
                        onChange={(event) =>
                          setFormData((prev) => ({
                            ...prev,
                            landmark: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="예: Bell Desk 옆, 파란 Tour Lobby 표지판"
                      />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  number={6}
                  title="미디어"
                  >
                  <div className="grid gap-2.5 lg:grid-cols-2">
                    <div className="rounded-xl border border-border bg-muted/20 p-2.5">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-foreground">
                          대표 이미지
                        </h4>
                        <span className="rounded-md bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground">
                          대표
                        </span>
                      </div>
                      <div className="relative mb-2 aspect-[16/10] overflow-hidden rounded-lg border border-border bg-muted">
                        {mainMediaFile ? (
                          <LocalFilePreview file={mainMediaFile} alt="새 대표 이미지" />
                        ) : (
                          <RemoteImagePreview
                            url={mainMedia}
                            alt={`${formData.hotel || '호텔'} 대표 이미지`}
                            onClick={() => openImageModal(mainMedia)}
                          />
                        )}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="url"
                          value={mainMedia}
                          onChange={(event) => {
                            setMainMediaFile(null)
                            updateMedia(0, event.target.value)
                          }}
                          className={`${inputClass} flex-1`}
                          placeholder="이미지 또는 Google Drive 공유 URL"
                        />
                        <input
                          ref={mainMediaInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) =>
                            setMainMediaFile(event.target.files?.[0] || null)
                          }
                        />
                        <button
                          type="button"
                          onClick={() => mainMediaInputRef.current?.click()}
                          className={secondaryButtonClass}
                        >
                          <Upload size={16} />
                          업로드
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/20 p-2.5">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-foreground">
                          Google Map 이미지
                        </h4>
                        <span className="rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700">
                          지도
                        </span>
                      </div>
                      <div className="relative mb-2 aspect-[16/10] overflow-hidden rounded-lg border border-border bg-muted">
                        {mapImageFile ? (
                          <LocalFilePreview file={mapImageFile} alt="새 지도 이미지" />
                        ) : (
                          <RemoteImagePreview
                            url={formData.map_image}
                            alt={`${formData.hotel || '호텔'} 지도 이미지`}
                            onClick={() => openImageModal(formData.map_image)}
                          />
                        )}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="url"
                          value={formData.map_image}
                          onChange={(event) => {
                            setMapImageFile(null)
                            setFormData((prev) => ({
                              ...prev,
                              map_image: event.target.value,
                            }))
                          }}
                          className={`${inputClass} flex-1`}
                          placeholder="지도 스크린샷 URL"
                        />
                        <input
                          ref={mapImageInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) =>
                            setMapImageFile(event.target.files?.[0] || null)
                          }
                        />
                        <button
                          type="button"
                          onClick={() => mapImageInputRef.current?.click()}
                          className={secondaryButtonClass}
                        >
                          <Upload size={16} />
                          업로드
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          추가 이미지
                        </h4>
                                              </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              media:
                                prev.media.length > 0
                                  ? [...prev.media, '']
                                  : ['', ''],
                            }))
                          }
                          className={secondaryButtonClass}
                        >
                          <Plus size={16} />
                          URL 추가
                        </button>
                        <input
                          ref={additionalMediaInputRef}
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={(event) =>
                            setAdditionalMediaFiles((prev) => [
                              ...prev,
                              ...Array.from(event.target.files || []),
                            ])
                          }
                        />
                        <button
                          type="button"
                          onClick={() => additionalMediaInputRef.current?.click()}
                          className={secondaryButtonClass}
                        >
                          <Upload size={16} />
                          파일 추가
                        </button>
                      </div>
                    </div>

                    {(additionalMedia.length > 0 ||
                      additionalMediaFiles.length > 0) && (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {additionalMedia.map((url, index) => (
                          <div
                            key={`url-${index}`}
                            className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
                          >
                            <div className="relative aspect-[4/3] bg-muted">
                              <RemoteImagePreview
                                url={url}
                                alt={`추가 이미지 ${index + 1}`}
                                onClick={() => openImageModal(url)}
                              />
                              <button
                                type="button"
                                onClick={() => removeMedia(index + 1)}
                                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/65 text-white transition hover:bg-red-600"
                                aria-label="추가 이미지 삭제"
                              >
                                <X size={15} />
                              </button>
                            </div>
                            <input
                              type="url"
                              value={url}
                              onChange={(event) =>
                                updateMedia(index + 1, event.target.value)
                              }
                              className="h-10 w-full border-0 border-t border-border px-3 text-xs outline-none focus:ring-2 focus:ring-inset focus:ring-primary/20"
                              placeholder="이미지 URL"
                            />
                          </div>
                        ))}
                        {additionalMediaFiles.map((file, index) => (
                          <div
                            key={`${file.name}-${file.lastModified}-${index}`}
                            className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
                          >
                            <div className="relative aspect-[4/3] bg-muted">
                              <LocalFilePreview
                                file={file}
                                alt={`업로드 이미지 ${index + 1}`}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setAdditionalMediaFiles((prev) =>
                                    prev.filter((_, fileIndex) => fileIndex !== index)
                                  )
                                }
                                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/65 text-white transition hover:bg-red-600"
                                aria-label="업로드 파일 삭제"
                              >
                                <X size={15} />
                              </button>
                              <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-black/65 px-2 py-1 text-[11px] text-white">
                                {file.name}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </SectionCard>

                <SectionCard number={7} title="추가 정보">
                  <div className="grid gap-2.5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <FieldLabel>YouTube 링크</FieldLabel>
                      <div className="relative">
                        <Video
                          size={17}
                          className="pointer-events-none absolute left-3.5 top-3 text-muted-foreground"
                        />
                        <input
                          type="url"
                          value={formData.youtube_link}
                          onChange={(event) =>
                            setFormData((prev) => ({
                              ...prev,
                              youtube_link: event.target.value,
                            }))
                          }
                          className={`${inputClass} pl-10`}
                          placeholder="https://www.youtube.com/watch?v=..."
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <FieldLabel>내부 메모</FieldLabel>
                      <textarea
                        rows={2}
                        value={formData.memo}
                        onChange={(event) =>
                          setFormData((prev) => ({
                            ...prev,
                            memo: event.target.value,
                          }))
                        }
                        className={textareaClass}
                        placeholder="운영팀만 확인할 수 있는 메모"
                      />
                    </div>
                  </div>
                </SectionCard>
              </div>
            </main>

            <footer className="shrink-0 border-t border-border bg-white px-3 py-2.5 sm:px-4">
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {hotel && onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('정말로 이 호텔을 삭제하시겠습니까?')) {
                          onDelete(hotel.id)
                        }
                      }}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
                    >
                      <Trash2 size={17} />
                      삭제
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-border bg-white px-4 text-xs font-semibold text-foreground transition hover:bg-muted sm:flex-none"
                  >
                    {translations.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                  >
                    {uploading ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Save size={17} />
                    )}
                    {uploading ? '저장 중...' : '저장하기'}
                  </button>
                </div>
              </div>
            </footer>
          </form>
        </div>
      </div>

      {showMapModal && (
        <div className="fixed inset-0 z-[10010] overflow-y-auto bg-slate-950/65 p-3 backdrop-blur-sm">
          <div className="mx-auto my-4 max-w-5xl overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  지도에서 위치 선택
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  호텔을 검색하거나 지도를 클릭해 정확한 좌표를 선택하세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="지도 모달 닫기"
              >
                <X size={22} />
              </button>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div className="flex gap-2">
                <input
                  id="mapSearch"
                  className={`${inputClass} flex-1`}
                  placeholder="호텔명 또는 주소 검색 (예: Bellagio Hotel)"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleMapSearch()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleMapSearch}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  검색
                </button>
              </div>

              {selectedAddress && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <p className="font-semibold">선택된 주소</p>
                  <p className="mt-1">{selectedAddress}</p>
                  {selectedGoogleMapLink && (
                    <a
                      href={selectedGoogleMapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 font-medium underline"
                    >
                      Google Maps 열기 <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              )}

              <div className="overflow-hidden rounded-2xl border border-border bg-muted p-2">
                <div id="map" className="h-[420px] w-full rounded-xl" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>위도 (Latitude)</FieldLabel>
                  <input
                    id="latitude"
                    type="number"
                    step="any"
                    className={inputClass}
                    placeholder="36.1699"
                  />
                </div>
                <div>
                  <FieldLabel>경도 (Longitude)</FieldLabel>
                  <input
                    id="longitude"
                    type="number"
                    step="any"
                    className={inputClass}
                    placeholder="-115.1398"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className={secondaryButtonClass}
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  const lat = (document.getElementById('latitude') as HTMLInputElement)
                    ?.value
                  const lng = (document.getElementById('longitude') as HTMLInputElement)
                    ?.value
                  if (!lat || !lng) {
                    alert('위도와 경도를 입력해주세요.')
                    return
                  }
                  handleMapCoordinateSelect(
                    Number(lat),
                    Number(lng),
                    selectedAddress || undefined
                  )
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <MapPin size={16} />
                좌표 적용
              </button>
            </div>
          </div>
        </div>
      )}

      {showToRepresentativeModal && (
        <div className="fixed inset-0 z-[10010] overflow-y-auto bg-slate-950/65 p-3 backdrop-blur-sm">
          <div className="mx-auto my-6 max-w-3xl overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  대표 호텔 이동 안내
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formData.hotel.trim() || '이 호텔'}에서 대표 픽업 호텔까지 이동하는
                  방법을 입력하세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowToRepresentativeModal(false)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="대표 호텔 이동 안내 닫기"
              >
                <X size={22} />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
                {representativeHotel ? (
                  <>
                    <p className="font-semibold text-foreground">
                      대표 호텔: {representativeHotel.hotel}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      픽업 장소: {representativeHotel.pick_up_location || '-'}
                      {representativeHotel.group_number != null &&
                        ` · 그룹 ${representativeHotel.group_number}`}
                    </p>
                    {isRepresentativeHotel && (
                      <p className="mt-2 text-xs font-medium text-amber-700">
                        현재 호텔이 그룹 대표 호텔입니다. 필요 시 참고용으로 기록하세요.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    {formData.group_number != null
                      ? '그룹 번호에 해당하는 대표 호텔을 찾지 못했습니다.'
                      : '그룹 번호를 설정하면 대표 호텔이 자동으로 표시됩니다.'}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={translatingToRepresentative}
                  onClick={async () => {
                    if (!formData.to_representative_hotel_ko.trim()) {
                      setToRepresentativeTranslateError(
                        '한국어 안내를 먼저 입력하세요.'
                      )
                      return
                    }
                    setTranslatingToRepresentative(true)
                    setToRepresentativeTranslateError(null)
                    try {
                      const result = await translatePickupHotelFields({
                        to_representative_hotel_ko:
                          formData.to_representative_hotel_ko,
                      })
                      if (
                        result.success &&
                        result.translatedFields?.to_representative_hotel_ko
                      ) {
                        setFormData((prev) => ({
                          ...prev,
                          to_representative_hotel_en:
                            result.translatedFields!.to_representative_hotel_ko ||
                            prev.to_representative_hotel_en,
                        }))
                      } else {
                        setToRepresentativeTranslateError(
                          result.error || '번역에 실패했습니다.'
                        )
                      }
                    } catch (error) {
                      setToRepresentativeTranslateError(
                        error instanceof Error
                          ? error.message
                          : '번역 중 오류가 발생했습니다.'
                      )
                    } finally {
                      setTranslatingToRepresentative(false)
                    }
                  }}
                  className={secondaryButtonClass}
                >
                  {translatingToRepresentative ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Languages size={16} />
                  )}
                  한국어 → 영어 번역
                </button>
                {toRepresentativeTranslateError && (
                  <span className="text-xs font-medium text-red-600">
                    {toRepresentativeTranslateError}
                  </span>
                )}
              </div>

              <div className="grid gap-2.5 md:grid-cols-2">
                <div>
                  <FieldLabel>대표 호텔까지 (한국어)</FieldLabel>
                  <textarea
                    rows={9}
                    value={formData.to_representative_hotel_ko}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        to_representative_hotel_ko: event.target.value,
                      }))
                    }
                    className={textareaClass}
                    placeholder="대표 호텔까지 이동 경로를 입력하세요."
                  />
                </div>
                <div>
                  <FieldLabel>To Representative Hotel (English)</FieldLabel>
                  <textarea
                    rows={9}
                    value={formData.to_representative_hotel_en}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        to_representative_hotel_en: event.target.value,
                      }))
                    }
                    className={textareaClass}
                    placeholder="Enter directions to the representative hotel."
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-border px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => setShowToRepresentativeModal(false)}
                className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {showImageModal && selectedImageUrl && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <div className="relative h-[85vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-black shadow-2xl">
            <Image
              src={selectedImageUrl}
              alt="확대 이미지"
              fill
              unoptimized
              className="object-contain"
            />
            <button
              type="button"
              onClick={() => setShowImageModal(false)}
              className="absolute right-4 top-4 inline-flex h-9 w-11 items-center justify-center rounded-xl bg-white/90 text-slate-900 shadow-lg transition hover:bg-white"
              aria-label="이미지 닫기"
            >
              <X size={22} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
