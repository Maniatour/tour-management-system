'use client'

import { useState, use, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, User, Phone, Car, Banknote, Heart, FileText, Calendar } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Employee = Database['public']['Tables']['employees']['Row']
type EmployeeInsert = Database['public']['Tables']['employees']['Insert']
type EmployeeUpdate = Database['public']['Tables']['employees']['Update']

interface AdminEmployeesProps {
  params: Promise<{ locale: string }>
}

export default function AdminEmployees({ params }: AdminEmployeesProps) {
  const { locale } = use(params)
  const t = useTranslations('employees')
  const tCommon = useTranslations('common')
  
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Supabase에서 직원 데이터 가져오기
  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching employees:', error)
        return
      }

      setEmployees(data || [])
    } catch (error) {
      console.error('Error fetching employees:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredEmployees = employees.filter(employee =>
    employee.name_ko.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.type.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAddEmployee = async (employee: Omit<Employee, 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .insert([employee])
        .select()

      if (error) {
        console.error('Error adding employee:', error)
        return
      }

      if (data) {
        setEmployees([data[0], ...employees])
      }
      setShowAddForm(false)
    } catch (error) {
      console.error('Error adding employee:', error)
    }
  }

  const handleEditEmployee = async (employee: Omit<Employee, 'created_at'>) => {
    if (editingEmployee) {
      try {
        const { error } = await supabase
          .from('employees')
          .update(employee)
          .eq('email', editingEmployee.email)

        if (error) {
          console.error('Error updating employee:', error)
          return
        }

        setEmployees(employees.map(e => e.email === editingEmployee.email ? { ...e, ...employee } : e))
        setEditingEmployee(null)
      } catch (error) {
        console.error('Error updating employee:', error)
      }
    }
  }

  const handleDeleteEmployee = async (email: string) => {
    if (confirm(t('deleteConfirm'))) {
      try {
        const { error } = await supabase
          .from('employees')
          .delete()
          .eq('email', email)

        if (error) {
          console.error('Error deleting employee:', error)
          return
        }

        setEmployees(employees.filter(e => e.email !== email))
      } catch (error) {
        console.error('Error deleting employee:', error)
      }
    }
  }

  const getTypeLabel = (type: string) => {
    return t(`types.${type}`)
  }

  const getLanguageLabel = (language: string) => {
    return t(`languages.${language}`)
  }

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'guide': return 'bg-blue-100 text-blue-800'
      case 'assistant': return 'bg-green-100 text-green-800'
      case 'driver': return 'bg-purple-100 text-purple-800'
      case 'manager': return 'bg-yellow-100 text-yellow-800'
      case 'admin': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{tCommon('loading')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>{t('addEmployee')}</span>
        </button>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* 직원 목록 */}
      <div className="bg-white rounded-lg shadow-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.name')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.type')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.language')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.contact')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.certifications')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tCommon('actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.map((employee) => (
                <tr key={employee.email} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{employee.name_ko}</div>
                        <div className="text-sm text-gray-500">{employee.name_en}</div>
                        <div className="text-xs text-gray-400">{employee.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(employee.type)}`}>
                      {getTypeLabel(employee.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      employee.language === 'both' ? 'bg-purple-100 text-purple-800' :
                      employee.language === 'ko' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {getLanguageLabel(employee.language)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center text-sm">
                        <Phone className="h-3 w-3 text-gray-400 mr-1" />
                        <span className="text-gray-900">{employee.phone}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Phone className="h-3 w-3 text-gray-400 mr-1" />
                        <span className="text-gray-500">비상: {employee.emergency_contact}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(employee.is_active)}`}>
                      {employee.is_active ? t('status.active') : t('status.inactive')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-1">
                      {employee.cpr && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <Heart className="h-3 w-3 mr-1" />
                          CPR
                        </span>
                      )}
                      {employee.medical_report && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <FileText className="h-3 w-3 mr-1" />
                          의료
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee)
                          setShowDetailModal(true)
                        }}
                        className="text-blue-600 hover:text-blue-900"
                        title={t('viewDetails')}
                      >
                        <FileText size={16} />
                      </button>
                      <button
                        onClick={() => setEditingEmployee(employee)}
                        className="text-blue-600 hover:text-blue-900"
                        title={tCommon('edit')}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(employee.email)}
                        className="text-red-600 hover:text-red-900"
                        title={tCommon('delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 직원 추가/편집 모달 */}
      {(showAddForm || editingEmployee) && (
        <EmployeeForm
          employee={editingEmployee}
          onSubmit={editingEmployee ? handleEditEmployee : handleAddEmployee}
          onCancel={() => {
            setShowAddForm(false)
            setEditingEmployee(null)
          }}
        />
      )}

      {/* 직원 상세 정보 모달 */}
      {showDetailModal && selectedEmployee && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedEmployee(null)
          }}
        />
      )}
    </div>
  )
}

interface EmployeeFormProps {
  employee?: Employee | null
  onSubmit: (employee: Omit<Employee, 'created_at'>) => void
  onCancel: () => void
}

function EmployeeForm({ employee, onSubmit, onCancel }: EmployeeFormProps) {
  const t = useTranslations('employees')
  const tCommon = useTranslations('common')
  
  const [formData, setFormData] = useState({
    id: employee?.id || '',
    email: employee?.email || '',
    name_ko: employee?.name_ko || '',
    name_en: employee?.name_en || '',
    language: employee?.language || 'ko' as 'ko' | 'en' | 'both',
    type: employee?.type || 'guide' as 'guide' | 'assistant' | 'driver' | 'manager' | 'admin',
    phone: employee?.phone || '',
    emergency_contact: employee?.emergency_contact || '',
    is_active: employee?.is_active ?? true,
    date_of_birth: employee?.date_of_birth || '',
    address: employee?.address || '',
    ssn: employee?.ssn || '',
    photo: employee?.photo || '',
    personal_car_model: employee?.personal_car_model || '',
    car_year: employee?.car_year || 0,
    car_plate: employee?.car_plate || '',
    bank_name: employee?.bank_name || '',
    account_holder: employee?.account_holder || '',
    bank_number: employee?.bank_number || '',
    routing_number: employee?.routing_number || '',
    cpr: employee?.cpr ?? false,
    cpr_acquired: employee?.cpr_acquired || '',
    cpr_expired: employee?.cpr_expired || '',
    medical_report: employee?.medical_report ?? false,
    medical_acquired: employee?.medical_acquired || '',
    medical_expired: employee?.medical_expired || '',
    status: employee?.status || 'active'
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {employee ? t('form.editTitle') : t('form.title')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.email')}</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.type')}</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'guide' | 'assistant' | 'driver' | 'manager' | 'admin' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="guide">{t('types.guide')}</option>
                <option value="assistant">{t('types.assistant')}</option>
                <option value="driver">{t('types.driver')}</option>
                <option value="manager">{t('types.manager')}</option>
                <option value="admin">{t('types.admin')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.nameKo')}</label>
              <input
                type="text"
                value={formData.name_ko}
                onChange={(e) => setFormData({ ...formData, name_ko: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.nameEn')}</label>
              <input
                type="text"
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.language')}</label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value as 'ko' | 'en' | 'both' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ko">{t('languages.ko')}</option>
                <option value="en">{t('languages.en')}</option>
                <option value="both">{t('languages.both')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.status')}</label>
              <select
                value={formData.is_active.toString()}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="true">{t('status.active')}</option>
                <option value="false">{t('status.inactive')}</option>
              </select>
            </div>
          </div>

          {/* 연락처 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.phone')}</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.emergencyContact')}</label>
              <input
                type="tel"
                value={formData.emergency_contact}
                onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.dateOfBirth')}</label>
              <input
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.ssn')}</label>
              <input
                type="text"
                value={formData.ssn}
                onChange={(e) => setFormData({ ...formData, ssn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.address')}</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* 차량 정보 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.personalCarModel')}</label>
              <input
                type="text"
                value={formData.personal_car_model}
                onChange={(e) => setFormData({ ...formData, personal_car_model: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.carYear')}</label>
              <input
                type="text"
                value={formData.car_year}
                onChange={(e) => setFormData({ ...formData, car_year: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.carPlate')}</label>
              <input
                type="text"
                value={formData.car_plate}
                onChange={(e) => setFormData({ ...formData, car_plate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 은행 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.bankName')}</label>
              <input
                type="text"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.accountHolder')}</label>
              <input
                type="text"
                value={formData.account_holder}
                onChange={(e) => setFormData({ ...formData, account_holder: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.bankNumber')}</label>
              <input
                type="text"
                value={formData.bank_number}
                onChange={(e) => setFormData({ ...formData, bank_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.routingNumber')}</label>
              <input
                type="text"
                value={formData.routing_number}
                onChange={(e) => setFormData({ ...formData, routing_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 자격증 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.cpr}
                  onChange={(e) => setFormData({ ...formData, cpr: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                />
                <span className="text-sm font-medium text-gray-700">{t('form.cpr')}</span>
              </label>
              {formData.cpr && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{t('form.cprDateAcquired')}</label>
                    <input
                      type="date"
                                      value={formData.cpr_acquired}
                onChange={(e) => setFormData({ ...formData, cpr_acquired: e.target.value })}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{t('form.cprDateExpired')}</label>
                    <input
                      type="date"
                                      value={formData.cpr_expired}
                onChange={(e) => setFormData({ ...formData, cpr_expired: e.target.value })}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.medical_report}
                  onChange={(e) => setFormData({ ...formData, medical_report: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                />
                <span className="text-sm font-medium text-gray-700">{t('form.medicalReport')}</span>
              </label>
              {formData.medical_report && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{t('form.medicalDateAcquired')}</label>
                    <input
                      type="date"
                                      value={formData.medical_acquired}
                onChange={(e) => setFormData({ ...formData, medical_acquired: e.target.value })}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{t('form.medicalDateExpired')}</label>
                    <input
                      type="date"
                                      value={formData.medical_expired}
                onChange={(e) => setFormData({ ...formData, medical_expired: e.target.value })}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              {employee ? tCommon('edit') : tCommon('add')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
            >
              {tCommon('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface EmployeeDetailModalProps {
  employee: Employee
  onClose: () => void
}

function EmployeeDetailModal({ employee, onClose }: EmployeeDetailModalProps) {
  const t = useTranslations('employees')
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {employee.name_ko} ({employee.name_en})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">{t('details.basicInfo')}</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.email')}:</span>
                <p className="text-sm text-gray-900">{employee.email}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.type')}:</span>
                <p className="text-sm text-gray-900">{t(`types.${employee.type}`)}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.language')}:</span>
                <p className="text-sm text-gray-900">{t(`languages.${employee.language}`)}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.phone')}:</span>
                <p className="text-sm text-gray-900">{employee.phone}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.emergencyContact')}:</span>
                <p className="text-sm text-gray-900">{employee.emergency_contact || '없음'}</p>
              </div>
            </div>
          </div>

          {/* 개인 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">{t('details.personalInfo')}</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.dateOfBirth')}:</span>
                <p className="text-sm text-gray-900">{employee.date_of_birth || '없음'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.address')}:</span>
                <p className="text-sm text-gray-900">{employee.address}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.ssn')}:</span>
                <p className="text-sm text-gray-900">{employee.ssn}</p>
              </div>
            </div>
          </div>

          {/* 차량 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">{t('details.vehicleInfo')}</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.personalCarModel')}:</span>
                <p className="text-sm text-gray-900">{employee.personal_car_model || '없음'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.carYear')}:</span>
                <p className="text-sm text-gray-900">{employee.car_year || '없음'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.carPlate')}:</span>
                <p className="text-sm text-gray-900">{employee.car_plate || '없음'}</p>
              </div>
            </div>
          </div>

          {/* 은행 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">{t('details.bankInfo')}</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.bankName')}:</span>
                <p className="text-sm text-gray-900">{employee.bank_name || '없음'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.accountHolder')}:</span>
                <p className="text-sm text-gray-900">{employee.account_holder || '없음'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.bankNumber')}:</span>
                <p className="text-sm text-gray-900">{employee.bank_number || '없음'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.routingNumber')}:</span>
                <p className="text-sm text-gray-900">{employee.routing_number || '없음'}</p>
              </div>
            </div>
          </div>

          {/* 자격증 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">{t('details.certifications')}</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">CPR:</span>
                <p className="text-sm text-gray-900">
                                      {employee.cpr ? (
                      <>
                        {t('status.valid')} ({employee.cpr_acquired} ~ {employee.cpr_expired})
                      </>
                    ) : (
                      t('status.notRequired')
                    )}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.medicalReport')}:</span>
                <p className="text-sm text-gray-900">
                  {employee.medical_report ? (
                    <>
                      {t('status.valid')} ({employee.medical_acquired} ~ {employee.medical_expired})
                    </>
                  ) : (
                    t('status.notRequired')
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* 상태 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">{t('details.status')}</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.status')}:</span>
                <p className="text-sm text-gray-900">
                  {employee.is_active ? t('status.active') : t('status.inactive')}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">{t('form.createdAt')}:</span>
                <p className="text-sm text-gray-900">{employee.created_at}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}
