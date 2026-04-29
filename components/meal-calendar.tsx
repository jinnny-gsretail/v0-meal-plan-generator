'use client'

import { useState, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle, Download, Pencil, Check, Factory, Users, Save, FolderOpen, Trash2, Loader2, Plus, X, GripVertical, Copy, Move } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMealboxStore } from '@/lib/store'
import { MealComposition, ALL_MEAL_PLANS, Product } from '@/lib/types'
import { downloadCustomerExcel, downloadFactoryExcel } from '@/lib/excel-export'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 디저트 그룹별 색상 매핑 (흰색 배경용)
const DESSERT_GROUP_COLORS: { [key: string]: { bg: string; text: string; border: string } } = {
  '프레시': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  '탄수화물': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  '단백질': { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-300' },
  '당류': { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300' },
}

// FF와 음료는 디저트 그룹과 구분되는 색상 사용
const FF_COLOR = { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' }
const DRINK_COLOR = { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' }

const getDefaultDessertColor = () => ({ bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' })

export function MealCalendar() {
  const { 
    selectedMonth: storedMonth, 
    setSelectedMonth, 
    mealPlanMeals, 
    dosirakSets,
    freeFormatData,
    targetCosts,
    mealPlanTargetCosts,
    selectedMealPlan,
    startDate: storedStartDate,
    endDate: storedEndDate,
    products,
    updateMealComponent,
    updateFF,
    updateDosirakSet,
    setFreeSlot,
    moveFreeDay,
    clearFreeDay,
    snapshots,
    snapshotStatus,
    snapshotMessage,
    saveSnapshot,
    loadSnapshot,
    deleteSnapshot
  } = useMealboxStore()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  
  // 뷰 모드: 'customer' = 고객 수령일 기준, 'factory' = 공장 생산일 기준 (D-1)
  const [viewMode, setViewMode] = useState<'customer' | 'factory'>('customer')
  
  // 수정 대상 상태 (FF 포함 통합)
  const [editingComponent, setEditingComponent] = useState<{
    date: string
    mealPlanName: string
    componentType: 'ff' | 'drink' | 'dessert'
    componentIndex: number   // dessert: 0=B, 1=C / ff·drink: 0
    currentProduct: Product | null
  } | null>(null)
  const [syncToRelated, setSyncToRelated] = useState(true)
  // FF 수정 시 동일 가격대 전체 연동
  const [syncSameType, setSyncSameType] = useState(true)
  // 금요일 삼각박스 컵라면 필수 규칙 강제 변경 허용 여부
  const [cupRamenOverride, setCupRamenOverride] = useState(false)

  // 구성품 교체 다이얼로그: 선택 상태 (확정 전 임시)
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null)
  // 도시락 조합 수정용 선택 상태
  const [pendingDosirakProduct, setPendingDosirakProduct] = useState<Product | null>(null)
  
  // 스냅샷 다이얼로그 상태
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [snapshotName, setSnapshotName] = useState('')
  
  // 도시락 조합 수정 상태
  const [editingDosirakSet, setEditingDosirakSet] = useState<{
    pricePoint: number
    setNumber: number
    componentType: 'ff' | 'drink' | 'dessert'
    componentIndex: number
    currentProduct: Product | null
  } | null>(null)
  
  // 도시락 여부 체크
  const isDosirak = selectedMealPlan?.startsWith('도시락')
  // 프리포맷 여부 체크
  const isFreeFormat = selectedMealPlan === '프리포맷'

  // 프리포맷: 수정 다이얼로그 상태
  const [freeEditState, setFreeEditState] = useState<{
    date: string
    slotIndex: number
    mode: 'product' | 'text'
    currentText?: string
  } | null>(null)
  const [freeCustomText, setFreeCustomText] = useState('')

  // 프리포맷: 드래그 출발 날짜
  const freeDragRef = useRef<string | null>(null)
  const [freeDragOver, setFreeDragOver] = useState<string | null>(null)
  
  // Ensure dates are Date objects
  const startDate = storedStartDate instanceof Date ? storedStartDate : storedStartDate ? new Date(storedStartDate) : null
  const endDate = storedEndDate instanceof Date ? storedEndDate : storedEndDate ? new Date(storedEndDate) : null
  
  // 현재 보여줄 월 (selectedMonth 기준)
  const selectedMonth = storedMonth instanceof Date ? storedMonth : new Date(storedMonth)
  const year = selectedMonth.getFullYear()
  const month = selectedMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  // 이전 달 마지막 날짜
  const prevMonthLastDate = new Date(year, month, 0).getDate()
  
  const prevMonth = () => {
    setSelectedMonth(new Date(year, month - 1, 1))
  }
  
  const nextMonth = () => {
    setSelectedMonth(new Date(year, month + 1, 1))
  }
  
  // 날짜가 시작일~종료일 범위 내에 있는지 확인
  const isInRangeDate = (date: Date) => {
    if (!startDate || !endDate) return false
    return date >= startDate && date <= endDate
  }
  
  // 현재 선택된 식단의 데이터 가져오기
  const currentMealPlanData = selectedMealPlan ? mealPlanMeals[selectedMealPlan] || [] : []
  const currentMealPlanInfo = selectedMealPlan 
    ? ALL_MEAL_PLANS.find(m => m.name === selectedMealPlan) 
    : null
  
  // 공장 생산일 기준: 캘린더 날짜에서 +1일한 데이터를 가져옴 (해당 칸에는 다음날 배송분이 표시)
  // 고객 수령일 기준: 캘린더 날짜 그대로
  const getMealForDate = (dateStr: string) => {
    if (viewMode === 'factory') {
      // 캘린더 날짜 + 1일 = 실제 배송일의 식단 데이터
      const calDate = new Date(dateStr)
      calDate.setDate(calDate.getDate() + 1)
      const deliveryDateStr = `${calDate.getFullYear()}-${String(calDate.getMonth() + 1).padStart(2, '0')}-${String(calDate.getDate()).padStart(2, '0')}`
      return currentMealPlanData.find(m => m.date === deliveryDateStr)
    }
    return currentMealPlanData.find(m => m.date === dateStr)
  }
  
  // 공장 기준 배송일 라벨 (캘린더 날짜 + 1일)
  const getDeliveryDateLabel = (dateStr: string) => {
    if (viewMode === 'factory') {
      const calDate = new Date(dateStr)
      calDate.setDate(calDate.getDate() + 1)
      return `${calDate.getMonth() + 1}/${calDate.getDate()} 배송분`
    }
    return null
  }
  
  // 캘린더 날짜 배열 생성 (이전 달, 현재 달, 다음 달 포함) — 안정적인 참조를 위해 useMemo 사용
  const calendarDays = useMemo(() => {
    const days: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = []
    
    // 이전 달 날짜 (첫 주 채우기)
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthLastDate - i
      const m = month === 0 ? 11 : month - 1
      const y = month === 0 ? year - 1 : year
      days.push({ day: d, month: m, year: y, isCurrentMonth: false })
    }
    
    // 현재 달 날짜
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, month, year, isCurrentMonth: true })
    }
    
    // 다음 달 날짜 (마지막 주 채우기, 6주 고정으로 표시)
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      const m = month === 11 ? 0 : month + 1
      const y = month === 11 ? year + 1 : year
      days.push({ day: i, month: m, year: y, isCurrentMonth: false })
    }
    
    return days
  }, [year, month, firstDay, prevMonthLastDate, daysInMonth])
  
  const selectedMeal = selectedDate 
    ? currentMealPlanData.find(m => m.date === selectedDate) 
    : null

  // 날짜 문자열에서 식단 데이터 조회 (viewMode 반영, useMemo 내부용 순수함수)
  const getMealForDatePure = (dateStr: string, mode: 'customer' | 'factory') => {
    if (mode === 'factory') {
      const calDate = new Date(dateStr)
      calDate.setDate(calDate.getDate() + 1)
      const deliveryDateStr = `${calDate.getFullYear()}-${String(calDate.getMonth() + 1).padStart(2, '0')}-${String(calDate.getDate()).padStart(2, '0')}`
      return currentMealPlanData.find(m => m.date === deliveryDateStr)
    }
    return currentMealPlanData.find(m => m.date === dateStr)
  }

  const isInRangeDatePure = (date: Date, sd: Date | null, ed: Date | null) => {
    if (!sd || !ed) return false
    return date >= sd && date <= ed
  }

  // 주차별 평균 원가 계산
  const weeklyStats = useMemo(() => {
    if (!currentMealPlanInfo) return []
    
    const weeks: { weekNum: number; costs: number[]; avg: number }[] = []
    
    for (let weekIdx = 0; weekIdx < 6; weekIdx++) {
      const weekDays = calendarDays.slice(weekIdx * 7, (weekIdx + 1) * 7)
      const costs: number[] = []
      
      weekDays.forEach(dateInfo => {
        const dateStr = `${dateInfo.year}-${String(dateInfo.month + 1).padStart(2, '0')}-${String(dateInfo.day).padStart(2, '0')}`
        const currentDate = new Date(dateInfo.year, dateInfo.month, dateInfo.day)
        
        if (isInRangeDatePure(currentDate, startDate, endDate)) {
          const meal = getMealForDatePure(dateStr, viewMode)
          const composition = meal?.compositions[currentMealPlanInfo.price]
          if (composition) {
            costs.push(composition.totalCost)
          }
        }
      })
      
      if (costs.length > 0) {
        const avg = Math.round(costs.reduce((a, b) => a + b, 0) / costs.length)
        weeks.push({ weekNum: weekIdx + 1, costs, avg })
      }
    }
    
    return weeks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, currentMealPlanData, currentMealPlanInfo, startDate, endDate, viewMode])

  // 월 전체 평균 원가 및 원가대비 계산
  const monthlyStats = useMemo(() => {
    if (!currentMealPlanInfo) return null
    
    const allCosts: number[] = []
    calendarDays.forEach(dateInfo => {
      const dateStr = `${dateInfo.year}-${String(dateInfo.month + 1).padStart(2, '0')}-${String(dateInfo.day).padStart(2, '0')}`
      const currentDate = new Date(dateInfo.year, dateInfo.month, dateInfo.day)
      
      if (isInRangeDatePure(currentDate, startDate, endDate)) {
        const meal = getMealForDatePure(dateStr, viewMode)
        const composition = meal?.compositions[currentMealPlanInfo.price]
        if (composition) {
          allCosts.push(composition.totalCost)
        }
      }
    })
    
    if (allCosts.length === 0) return null
    
    const totalCost = allCosts.reduce((a, b) => a + b, 0)
    const avgCost = Math.round(totalCost / allCosts.length)
    // 공장박스는 mealPlanTargetCosts에서 고정 원가 963원 참조, 나머지는 가격대 기준
    const targetCost = selectedMealPlan === '공장박스'
      ? (mealPlanTargetCosts['공장박스'] ?? 963)
      : targetCosts[currentMealPlanInfo.price]
    const diff = avgCost - targetCost
    
    return {
      totalDays: allCosts.length,
      avgCost,
      targetCost,
      diff,
      totalCost
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, currentMealPlanData, currentMealPlanInfo, targetCosts, startDate, endDate, viewMode])

  // 선택된 식단이 없으면 안내 메시지 표시
  if (!selectedMealPlan) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          위에서 확인하고 싶은 식단을 선택해주세요.
        </p>
      </div>
    )
  }

  // 도시락: dosirakSets 데이터 확인
  const currentDosirakPrice = isDosirak && currentMealPlanInfo ? currentMealPlanInfo.price : 0
  const currentDosirakSets = isDosirak ? dosirakSets[currentDosirakPrice] || [] : []

  // 식단 데이터가 없으면 생성 안내 (도시락·프리포맷은 별도 체크)
  if (!isDosirak && !isFreeFormat && currentMealPlanData.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          식단이 생성되지 않았습니다. 상품을 등록하고 &apos;식단 자동 생성&apos; 버튼을 클릭해주세요.
        </p>
      </div>
    )
  }
  
  if (isDosirak && currentDosirakSets.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          도시락 조합이 생성되지 않았습니다. 상품을 등록하고 &apos;식단 자동 생성&apos; 버튼을 클릭해주세요.
        </p>
      </div>
    )
  }

  const handleDownloadCustomer = () => {
    if (!startDate || !endDate) return
    downloadCustomerExcel(mealPlanMeals, mealPlanTargetCosts, startDate, endDate, dosirakSets, freeFormatData)
  }

  const handleDownloadFactory = () => {
    if (!startDate || !endDate) return
    downloadFactoryExcel(mealPlanMeals, mealPlanTargetCosts, startDate, endDate, dosirakSets, freeFormatData)
  }

  const hasData = startDate && endDate && Object.keys(mealPlanMeals).length > 0

  // 교체 가능한 상품 목록 (제약 조건 필터링)
  const getAvailableProducts = useMemo(() => {
    if (!editingComponent) return []

    const { date, componentType, mealPlanName } = editingComponent
    const d = new Date(date)
    const dayOfWeek = d.getDay()
    const isYogurtAllowed = dayOfWeek === 1 || dayOfWeek === 2
    const isMonday = dayOfWeek === 1

    const currentMealData = currentMealPlanData.find(m => m.date === date)
    const currentComp = currentMealData?.compositions[currentMealPlanInfo?.price || 0]
    const hasYogurtDrink = currentComp?.drink?.group === '요거트'

    // FF: 같은 ffType 내에서만 교체
    if (componentType === 'ff') {
      const ffTypePlan = ALL_MEAL_PLANS.find(p => p.name === mealPlanName)
      const ffType = ffTypePlan?.ffType
      return products
        .filter(p => p.category === 'ff' && (!ffType || p.ffType === ffType))
        .sort((a, b) => a.cost - b.cost)
    }

    // 금요일 삼각박스 컵라면 슬롯: override 없으면 컵라면 그룹만 표시
    const editDate = editingComponent?.date
    const editDow = editDate ? new Date(editDate).getDay() : -1
    const isEditFridaySamgak = editDow === 5 && (editingComponent?.mealPlanName.startsWith('삼각') ?? false)
    const isEditCupRamenSlot = isEditFridaySamgak && componentType === 'dessert' && componentIndex === 0

    let pool: Product[] = []
    if (componentType === 'drink') {
      pool = products.filter(p => p.category === 'drink')
      if (!isYogurtAllowed) pool = pool.filter(p => p.group !== '요거트')
    } else {
      pool = products.filter(p => p.category === 'dessert')
      // 컵라면 슬롯: override 없으면 컵라면 그룹만 노출
      if (isEditCupRamenSlot && !cupRamenOverride) {
        const cupRamenOnly = pool.filter(p => p.group === '컵라면')
        pool = cupRamenOnly.length > 0 ? cupRamenOnly : pool
      } else {
        if (!isYogurtAllowed) pool = pool.filter(p => p.group !== '요거트')
        if (isMonday && hasYogurtDrink) pool = pool.filter(p => p.group !== '요거트')
      }
    }

    return pool.sort((a, b) => a.cost - b.cost)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingComponent?.date, editingComponent?.componentType, editingComponent?.mealPlanName, editingComponent?.componentIndex, products, currentMealPlanData, currentMealPlanInfo?.price, cupRamenOverride])

  // 상품 선택 핸들러 (FF / 음료 / 디저트 통합)
  const handleSelectProduct = (product: Product) => {
    if (!editingComponent) return

    if (editingComponent.componentType === 'ff') {
      updateFF(editingComponent.date, editingComponent.mealPlanName, product, syncSameType)
    } else {
      updateMealComponent(
        editingComponent.date,
        editingComponent.mealPlanName,
        editingComponent.componentType,
        editingComponent.componentIndex,
        product,
        syncToRelated
      )
    }

    setEditingComponent(null)
  }

  // 수정 버튼 클릭 (FF 포함 통합)
  const handleEditComponent = (
    date: string,
    componentType: 'ff' | 'drink' | 'dessert',
    componentIndex: number,
    currentProduct: Product | null
  ) => {
    if (!selectedMealPlan) return
    setCupRamenOverride(false) // 다이얼로그 열 때마다 override 리셋
    setPendingProduct(null) // 선택 상태 초기화
    setEditingComponent({ date, mealPlanName: selectedMealPlan, componentType, componentIndex, currentProduct })
  }

  // 스냅샷 저장 핸들러
  const handleSaveSnapshot = () => {
    if (!snapshotName.trim()) return
    saveSnapshot(snapshotName.trim())
    setSnapshotName('')
    setShowSaveDialog(false)
  }

  // 스냅샷 불러오기 핸들러
  const handleLoadSnapshot = (id: string) => {
    loadSnapshot(id)
    setShowLoadDialog(false)
  }
  
  // 도시락 조합 수정 핸들러
  const handleEditDosirakComponent = (
    pricePoint: number,
    setNumber: number,
    componentType: 'ff' | 'drink' | 'dessert',
    componentIndex: number,
    currentProduct: Product | null
  ) => {
    setPendingDosirakProduct(null) // 선택 상태 초기화
    setEditingDosirakSet({ pricePoint, setNumber, componentType, componentIndex, currentProduct })
  }
  
  const handleSelectDosirakProduct = (product: Product) => {
    if (!editingDosirakSet) return
    const { pricePoint, setNumber, componentType, componentIndex } = editingDosirakSet
    const currentSet = dosirakSets[pricePoint]?.find(s => s.setNumber === setNumber)
    if (!currentSet) return
    
    if (componentType === 'ff') {
      updateDosirakSet(pricePoint, setNumber, { ff: product })
    } else if (componentType === 'drink') {
      updateDosirakSet(pricePoint, setNumber, { drink: product })
    } else {
      const newDesserts = [...currentSet.desserts]
      if (componentIndex < newDesserts.length) {
        newDesserts[componentIndex] = product
      }
      updateDosirakSet(pricePoint, setNumber, { desserts: newDesserts })
    }
    setEditingDosirakSet(null)
  }
  
  // 도시락 5개 조합 평균 원가 계산
  const dosirakStats = useMemo(() => {
    if (!isDosirak || currentDosirakSets.length === 0) return null
    const costs = currentDosirakSets.map(s => s.totalCost)
    const avgCost = Math.round(costs.reduce((a, b) => a + b, 0) / costs.length)
    const targetCost = mealPlanTargetCosts[selectedMealPlan || ''] ?? targetCosts[currentDosirakPrice]
    const diff = avgCost - targetCost
    return { avgCost, targetCost, diff, costs }
  }, [isDosirak, currentDosirakSets, mealPlanTargetCosts, selectedMealPlan, targetCosts, currentDosirakPrice])

  return (
    <div className="space-y-4">
      {/* 스냅샷 상태 메시지 */}
      {snapshotMessage && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
          snapshotStatus === 'saving' || snapshotStatus === 'loading'
            ? 'bg-blue-100 text-blue-700'
            : snapshotStatus === 'success'
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {(snapshotStatus === 'saving' || snapshotStatus === 'loading') && (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
          {snapshotMessage}
        </div>
      )}

      {/* 상단 컨트롤: 뷰 모드 토글 + 스냅샷 + 다운로드 버튼 */}
      <div className="flex items-center justify-between">
        {/* 뷰 모드 토글 - 도시락은 날짜 개념이 없어 비활성화, 프리포맷은 정상 작동 */}
        {isDosirak ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg text-sm text-muted-foreground">
            <Factory className="w-4 h-4" />
            상시 생산 (날짜 무관)
          </div>
        ) : (
          <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg">
            <Button
              variant={viewMode === 'customer' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('customer')}
              className="gap-1.5 h-8"
            >
              <Users className="w-3.5 h-3.5" />
              고객 수령일
            </Button>
            <Button
              variant={viewMode === 'factory' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('factory')}
              className="gap-1.5 h-8"
            >
              <Factory className="w-3.5 h-3.5" />
              공장 생산일
            </Button>
          </div>
        )}
        
        {/* 스냅샷 + 다운로드 ��튼 */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSaveDialog(true)}
            disabled={!hasData}
            className="gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            식단 저장
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLoadDialog(true)}
            disabled={snapshots.length === 0}
            className="gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            불러오기
          </Button>
          <div className="w-px bg-border" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCustomer}
            disabled={!hasData}
            className="gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            고객용 식단표
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadFactory}
            disabled={!hasData}
            className="gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            공장용 식단표
          </Button>
        </div>
      </div>

      {/* 프리포맷: 자유 편집 캘린더 그리드 */}
      {isFreeFormat ? (
        <div className="flex gap-4">
          <div className="flex-1 rounded-lg border border-border bg-card">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-3 border-b border-border">
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
              </div>
              <div className="text-center">
                <h2 className="text-base font-semibold text-foreground">{year}년 {month + 1}월</h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">셀 클릭으로 슬롯 추가 · 드래그로 날짜간 복사/이동</p>
              </div>
              <div className="w-16" />
            </div>
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 border-b border-border">
              {WEEKDAYS.map((day, i) => (
                <div key={i} className={`py-2 text-center text-xs font-medium ${i === 0 ? 'text-destructive' : i === 6 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {day}
                </div>
              ))}
            </div>
            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7">
              {calendarDays.map((dateInfo, idx) => {
                const dateStr = `${dateInfo.year}-${String(dateInfo.month + 1).padStart(2, '0')}-${String(dateInfo.day).padStart(2, '0')}`
                const currentDate = new Date(dateInfo.year, dateInfo.month, dateInfo.day)

                // 프리포맷도 뷰 모드 반영
                let displayDateStr = dateStr
                if (viewMode === 'factory') {
                  const nd = new Date(currentDate)
                  nd.setDate(nd.getDate() + 1)
                  displayDateStr = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`
                }
                const dayData = freeFormatData[displayDateStr]
                const slots = dayData?.slots ?? []
                const totalCost = slots.reduce((s, sl) => s + sl.cost, 0)

                const inRange = viewMode === 'factory'
                  ? (() => {
                      const nd = new Date(currentDate); nd.setDate(nd.getDate() + 1)
                      return startDate && endDate && nd >= startDate && nd <= endDate
                    })()
                  : isInRangeDate(currentDate)

                const isDragOver = freeDragOver === displayDateStr

                return (
                  <div
                    key={idx}
                    className={`min-h-28 p-1 border-r border-b border-border last:border-r-0 transition-colors
                      ${!dateInfo.isCurrentMonth ? 'bg-secondary/20 opacity-50' : ''}
                      ${inRange ? 'hover:bg-secondary/20' : 'opacity-30'}
                      ${idx % 7 === 0 && inRange ? 'bg-red-50/30' : ''}
                      ${idx % 7 === 6 && inRange ? 'bg-sky-50/30' : ''}
                      ${isDragOver && inRange ? 'ring-2 ring-primary ring-inset bg-primary/5' : ''}
                      ${viewMode === 'factory' && inRange ? 'bg-amber-50/40' : ''}`}
                    onDragOver={(e) => { if (!inRange) return; e.preventDefault(); setFreeDragOver(displayDateStr) }}
                    onDragLeave={() => setFreeDragOver(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setFreeDragOver(null)
                      if (!inRange || !freeDragRef.current || freeDragRef.current === displayDateStr) return
                      const fromDate = freeDragRef.current
                      const dropMode = e.shiftKey ? 'move' : 'copy'
                      moveFreeDay(fromDate, displayDateStr, dropMode)
                      freeDragRef.current = null
                    }}
                  >
                    {/* 날짜 숫자 + 총원가 */}
                    <div className="flex items-start justify-between mb-0.5">
                      <span className={`text-xs font-medium ${
                        !dateInfo.isCurrentMonth ? 'text-muted-foreground/40'
                          : idx % 7 === 0 ? 'text-destructive' : idx % 7 === 6 ? 'text-primary' : 'text-foreground'
                      }`}>{dateInfo.day}</span>
                      {inRange && totalCost > 0 && (
                        <span className="text-[8px] text-muted-foreground leading-tight">{totalCost.toLocaleString()}원</span>
                      )}
                    </div>

                    {inRange && (
                      <div className="space-y-0.5">
                        {/* 기존 슬롯 */}
                        {slots.map((slot, si) => (
                          <div
                            key={slot.id}
                            className="group flex items-center gap-0.5 px-0.5 py-px rounded bg-secondary/70 hover:bg-secondary cursor-pointer"
                            onClick={() => {
                              setFreeEditState({ date: displayDateStr, slotIndex: si, mode: slot.customText ? 'text' : 'product', currentText: slot.customText })
                              setFreeCustomText(slot.customText ?? '')
                            }}
                          >
                            <GripVertical className="w-2 h-2 text-muted-foreground/40 shrink-0" />
                            <span className="text-[9px] text-foreground truncate flex-1 leading-tight">
                              {slot.customText ?? slot.product?.name ?? ''}
                            </span>
                            <button
                              className="opacity-0 group-hover:opacity-100 shrink-0"
                              onClick={(e) => { e.stopPropagation(); setFreeSlot(displayDateStr, si, null) }}
                            >
                              <X className="w-2 h-2 text-muted-foreground" />
                            </button>
                          </div>
                        ))}

                        {/* 슬롯 추가 버튼 (최대 5개) */}
                        {slots.length < 5 && (
                          <button
                            className="w-full flex items-center justify-center gap-0.5 px-0.5 py-px rounded border border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors"
                            onClick={() => {
                              setFreeEditState({ date: displayDateStr, slotIndex: slots.length, mode: 'product' })
                              setFreeCustomText('')
                            }}
                          >
                            <Plus className="w-2.5 h-2.5 text-muted-foreground" />
                          </button>
                        )}

                        {/* 드래그 핸들 (셀 우상단, hover 시 노출) */}
                        {slots.length > 0 && (
                          <div
                            draggable
                            onDragStart={() => { freeDragRef.current = displayDateStr }}
                            onDragEnd={() => { freeDragRef.current = null; setFreeDragOver(null) }}
                            className="flex items-center justify-end mt-0.5 cursor-grab active:cursor-grabbing opacity-0 hover:opacity-100 group-hover:opacity-100"
                            title="드래그: 복사 | Shift+드래그: 이동"
                          >
                            <Copy className="w-2.5 h-2.5 text-muted-foreground/60" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 프리포맷 사이드바: 월 합계 원가 */}
          <div className="w-36 shrink-0 rounded-lg border border-border bg-card p-3">
            <h3 className="text-sm font-semibold text-foreground mb-3 text-center">원가 참고</h3>
            <p className="text-[10px] text-muted-foreground text-center mb-4">목표 원가 설정 없음<br/>합계만 표시</p>
            <div className="space-y-2">
              {calendarDays
                .filter((dateInfo) => {
                  const d = new Date(dateInfo.year, dateInfo.month, dateInfo.day)
                  return isInRangeDate(d) && dateInfo.isCurrentMonth
                })
                .map((dateInfo) => {
                  const dateStr = `${dateInfo.year}-${String(dateInfo.month + 1).padStart(2, '0')}-${String(dateInfo.day).padStart(2, '0')}`
                  const dayData = freeFormatData[dateStr]
                  if (!dayData || dayData.slots.length === 0) return null
                  const total = dayData.slots.reduce((s, sl) => s + sl.cost, 0)
                  return (
                    <div key={dateStr} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{dateInfo.month + 1}/{dateInfo.day}</span>
                      <span className="font-medium text-foreground">{total.toLocaleString()}원</span>
                    </div>
                  )
                })
                .filter(Boolean)}
            </div>
          </div>
        </div>
      ) : null}

      {/* 도시락: 5개 고정 조합 카드 UI */}
      {!isFreeFormat && isDosirak ? (
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-foreground">
                  {selectedMealPlan} - 5개 고정 조합
                </h2>
                <p className="text-xs text-muted-foreground">
                  목표 원가: {dosirakStats?.targetCost.toLocaleString()}원
                </p>
              </div>
              
              <div className="grid grid-cols-5 gap-3">
                {currentDosirakSets.map((set) => {
                  const isOverBudget = dosirakStats && set.totalCost > dosirakStats.targetCost * 1.03
                  return (
                    <div
                      key={set.setNumber}
                      className={`p-3 rounded-lg border ${isOverBudget ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-card'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-foreground">조합 {set.setNumber}</span>
                        <span className={`text-xs font-medium ${isOverBudget ? 'text-destructive' : 'text-primary'}`}>
                          {set.totalCost.toLocaleString()}원
                        </span>
                      </div>
                      
                      {/* FF */}
                      {set.ff && (
                        <div className={`p-2 rounded border mb-2 ${FF_COLOR.bg} ${FF_COLOR.border} relative group`}>
                          <div className={`text-[10px] ${FF_COLOR.text}`}>도시락</div>
                          <div className="text-xs font-medium text-foreground truncate">{set.ff.name}</div>
                          <div className="text-[10px] text-muted-foreground">{set.ff.cost.toLocaleString()}원</div>
                          <button
                            onClick={() => handleEditDosirakComponent(currentDosirakPrice, set.setNumber, 'ff', 0, set.ff ?? null)}
                            className="absolute top-1 right-1 p-0.5 rounded bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil className="w-2.5 h-2.5 text-muted-foreground" />
                          </button>
                        </div>
                      )}
                      
                      {/* 음료 */}
                      {set.drink && (
                        <div className={`p-2 rounded border mb-2 ${DRINK_COLOR.bg} ${DRINK_COLOR.border} relative group`}>
                          <div className={`text-[10px] ${DRINK_COLOR.text}`}>음료</div>
                          <div className="text-xs font-medium text-foreground truncate">{set.drink.name}</div>
                          <div className="text-[10px] text-muted-foreground">{set.drink.cost.toLocaleString()}원</div>
                          <button
                            onClick={() => handleEditDosirakComponent(currentDosirakPrice, set.setNumber, 'drink', 0, set.drink ?? null)}
                            className="absolute top-1 right-1 p-0.5 rounded bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil className="w-2.5 h-2.5 text-muted-foreground" />
                          </button>
                        </div>
                      )}
                      
                      {/* 디저트 */}
                      {set.desserts.map((dessert, dIdx) => {
                        const color = DESSERT_GROUP_COLORS[dessert.group || ''] || getDefaultDessertColor()
                        return (
                          <div key={dIdx} className={`p-2 rounded border mb-1 ${color.bg} ${color.border} relative group`}>
                            <div className={`text-[10px] ${color.text}`}>{dessert.group || '디저트'}</div>
                            <div className="text-xs font-medium text-foreground truncate">{dessert.name}</div>
                            <div className="text-[10px] text-muted-foreground">{dessert.cost.toLocaleString()}원</div>
                            <button
                              onClick={() => handleEditDosirakComponent(currentDosirakPrice, set.setNumber, 'dessert', dIdx, dessert)}
                              className="absolute top-1 right-1 p-0.5 rounded bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Pencil className="w-2.5 h-2.5 text-muted-foreground" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          
          {/* 도시락 통계 사이드바 */}
          <div className="w-48 rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">5개 세트 통계</h3>
            {dosirakStats && (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">평균 원가</div>
                  <div className={`text-lg font-semibold ${dosirakStats.diff > 0 ? 'text-destructive' : 'text-primary'}`}>
                    {dosirakStats.avgCost.toLocaleString()}원
                  </div>
                  <div className={`text-xs ${dosirakStats.diff > 0 ? 'text-destructive' : 'text-primary'}`}>
                    목표 대비 {dosirakStats.diff >= 0 ? '+' : ''}{dosirakStats.diff.toLocaleString()}원
                  </div>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="text-xs text-muted-foreground mb-2">개별 원가</div>
                  {currentDosirakSets.map((set, idx) => (
                    <div key={idx} className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">조합 {set.setNumber}</span>
                      <span className={set.totalCost > dosirakStats.targetCost * 1.03 ? 'text-destructive' : 'text-foreground'}>
                        {set.totalCost.toLocaleString()}원
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
      <div className="flex gap-4">
        {/* 캘린더 */}
        <div className="flex-1 rounded-lg border border-border bg-card">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <Button variant="ghost" size="sm" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <h2 className="text-base font-semibold text-foreground">
                {year}년 {month + 1}월
              </h2>
              <p className="text-xs text-primary">
                {selectedMealPlan} ({currentMealPlanInfo?.price.toLocaleString()}원)
              </p>
              {viewMode === 'factory' && (
                <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                  공장 생산일 기준 (D-1)
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAYS.map((day, i) => (
              <div 
                key={day} 
                className={`py-1.5 text-center text-xs font-medium ${
                  i === 0 ? 'text-destructive' : i === 6 ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((dateInfo, idx) => {
              const dateStr = `${dateInfo.year}-${String(dateInfo.month + 1).padStart(2, '0')}-${String(dateInfo.day).padStart(2, '0')}`
              const currentDate = new Date(dateInfo.year, dateInfo.month, dateInfo.day)
              const meal = getMealForDate(dateStr)
              const isWeekend = idx % 7 === 0 || idx % 7 === 6
              
              const composition = meal && currentMealPlanInfo 
                ? meal.compositions[currentMealPlanInfo.price] 
                : null
              // 공장박스는 고정 원가 963원(mealPlanTargetCosts), 나머지는 가격대 기준
              const baseCost = selectedMealPlan === '공장박스'
                ? (mealPlanTargetCosts['공장박스'] ?? 963)
                : (currentMealPlanInfo ? targetCosts[currentMealPlanInfo.price] : 0)
              const targetCost = baseCost * 1.03
              const isOverBudget = composition && composition.totalCost > targetCost
              
              // 공장 뷰: 생산일 범위 (배송일 - 1일이므로 하루 앞당겨 표시)
              // 고객 뷰: 배송일 범위 그대로
              const inRange = viewMode === 'factory'
                ? (() => {
                    // 캘린더 날짜 + 1일이 배송 범위에 있으면 표시
                    const nextDay = new Date(currentDate)
                    nextDay.setDate(nextDay.getDate() + 1)
                    return startDate && endDate && nextDay >= startDate && nextDay <= endDate
                  })()
                : isInRangeDate(currentDate)
              
              const deliveryLabel = getDeliveryDateLabel(dateStr)
              
              return (
                <div
                  key={idx}
                  className={`min-h-24 p-1 border-r border-b border-border last:border-r-0 
                    ${!dateInfo.isCurrentMonth ? 'bg-secondary/30' : ''}
                    ${inRange ? 'hover:bg-secondary/30 cursor-pointer' : 'opacity-40'}
                    ${isWeekend && inRange ? 'bg-secondary/10' : ''}
                    ${viewMode === 'factory' && inRange ? 'bg-amber-50/50' : ''}`}
                  onClick={() => {
                    if (!inRange) return
                    // 공장 뷰: 클릭한 셀에 표시된 식단(배송일 = 캘린더 날짜 + 1일)을 수정
                    if (viewMode === 'factory') {
                      const nextDay = new Date(currentDate)
                      nextDay.setDate(nextDay.getDate() + 1)
                      const deliveryDateStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`
                      setSelectedDate(deliveryDateStr)
                    } else {
                      setSelectedDate(dateStr)
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-xs font-medium ${
                      !dateInfo.isCurrentMonth 
                        ? 'text-muted-foreground/50'
                        : idx % 7 === 0 ? 'text-destructive' : idx % 7 === 6 ? 'text-primary' : 'text-foreground'
                    }`}>
                      {dateInfo.day}
                    </span>
                    {viewMode === 'factory' && inRange && deliveryLabel && (
                      <span className="text-[8px] text-amber-600 font-medium">
                        {deliveryLabel}
                      </span>
                    )}
                  </div>
                  {inRange && composition && (
                    <div className="space-y-0.5">
                      {/* 금요일 삼각박스 컵라면 필수 뱃지 */}
                      {dateInfo.dayOfWeek === 5 && selectedMealPlan?.startsWith('삼각') && (
                        <div className="text-[8px] leading-tight px-0.5 py-px rounded bg-orange-100 text-orange-700 font-medium truncate">
                          컵라면 필수
                        </div>
                      )}
                      {/* FF */}
                      {composition.ff && (
                        <div className={`text-[9px] leading-tight px-0.5 py-px rounded truncate ${FF_COLOR.bg} ${FF_COLOR.text}`}>
                          {composition.ff.name}
                        </div>
                      )}
                      {/* 음료 */}
                      {composition.drink && (
                        <div className={`text-[9px] leading-tight px-0.5 py-px rounded truncate ${DRINK_COLOR.bg} ${DRINK_COLOR.text}`}>
                          {composition.drink.name}
                        </div>
                      )}
                      {/* 디저트들 - 그룹별 색상 */}
                      {composition.desserts.map((dessert, i) => {
                        const colors = dessert.group 
                          ? DESSERT_GROUP_COLORS[dessert.group] || getDefaultDessertColor()
                          : getDefaultDessertColor()
                        return (
                          <div 
                            key={i} 
                            className={`text-[9px] leading-tight px-0.5 py-px rounded truncate ${colors.bg} ${colors.text}`}
                          >
                            {dessert.name}
                          </div>
                        )
                      })}
                      {/* 원가 */}
                      <div className={`text-[9px] leading-tight px-0.5 py-px rounded flex items-center gap-0.5 ${
                        isOverBudget 
                          ? 'bg-destructive/20 text-destructive' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {isOverBudget && <AlertCircle className="w-2 h-2 shrink-0" />}
                        {composition.totalCost.toLocaleString()}원
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        
        {/* 주차별 평균 원가 (우측) */}
        <div className="w-36 shrink-0 rounded-lg border border-border bg-card p-3">
          <h3 className="text-sm font-semibold text-foreground mb-3 text-center">주차별 평균원가</h3>
          <div className="space-y-2">
            {weeklyStats.map((week) => {
              const targetCost = currentMealPlanInfo ? targetCosts[currentMealPlanInfo.price] : 0
              const isOver = week.avg > targetCost * 1.03
              const isUnder = week.avg < targetCost * 0.95
              
              return (
                <div key={week.weekNum} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{week.weekNum}주차</span>
                  <span className={`font-medium ${
                    isOver ? 'text-destructive' : isUnder ? 'text-primary' : 'text-foreground'
                  }`}>
                    {week.avg.toLocaleString()}원
                  </span>
                </div>
              )
            })}
            {weeklyStats.length === 0 && (
              <p className="text-xs text-muted-foreground text-center">데이터 없음</p>
            )}
          </div>
          
          {/* 범례 */}
          <div className="mt-4 pt-3 border-t border-border">
            <h4 className="text-xs font-medium text-foreground mb-2">구성품 색상</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[10px]">
                <div className={`w-3 h-3 rounded ${FF_COLOR.bg} ${FF_COLOR.border} border`} />
                <span className={FF_COLOR.text}>FF</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <div className={`w-3 h-3 rounded ${DRINK_COLOR.bg} ${DRINK_COLOR.border} border`} />
                <span className={DRINK_COLOR.text}>음료</span>
              </div>
            </div>
            <h4 className="text-xs font-medium text-foreground mb-2 mt-3">디저트 그룹</h4>
            <div className="space-y-1">
              {Object.entries(DESSERT_GROUP_COLORS).map(([group, colors]) => (
                <div key={group} className="flex items-center gap-2 text-[10px]">
                  <div className={`w-3 h-3 rounded ${colors.bg} ${colors.border} border`} />
                  <span className={colors.text}>{group}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      )}

      {/* 월 전체 통계 (하단) - 도시락이 아닐 때만 */}
      {!isDosirak && monthlyStats && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-xs text-muted-foreground mb-1">식단 일수</div>
              <div className="text-lg font-semibold text-foreground">{monthlyStats.totalDays}일</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">목표 원가</div>
              <div className="text-lg font-semibold text-foreground">{monthlyStats.targetCost.toLocaleString()}원</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">평균 원가</div>
              <div className={`text-lg font-semibold ${
                monthlyStats.diff > 0 ? 'text-destructive' : 'text-primary'
              }`}>
                {monthlyStats.avgCost.toLocaleString()}원
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">원가 대비</div>
              <div className={`text-lg font-semibold ${
                monthlyStats.diff > 0 ? 'text-destructive' : 'text-primary'
              }`}>
                {monthlyStats.diff > 0 ? '+' : ''}{monthlyStats.diff.toLocaleString()}원
                <span className="text-xs ml-1">
                  ({monthlyStats.diff > 0 ? '초과' : '절감'})
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">총 원가</div>
              <div className="text-lg font-semibold text-foreground">{monthlyStats.totalCost.toLocaleString()}원</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Detail Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-2xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {selectedDate && new Date(selectedDate).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
              })} - {selectedMealPlan}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              구성품 위에 마우스를 올리면 수정 버튼이 나타납니다
            </DialogDescription>
          </DialogHeader>
          
          {selectedMeal && currentMealPlanInfo && selectedDate && (
            <MealDetail
              price={currentMealPlanInfo.price}
              composition={selectedMeal.compositions[currentMealPlanInfo.price]}
              targetCost={targetCosts[currentMealPlanInfo.price]}
              date={selectedDate}
              onEditComponent={(componentType, componentIndex, currentProduct) => {
                handleEditComponent(selectedDate, componentType, componentIndex, currentProduct)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 구성품·FF 교체 다이얼로그 */}
      {editingComponent && (() => {
        const isFF = editingComponent.componentType === 'ff'
        const isDrink = editingComponent.componentType === 'drink'
        const dessertIdx = editingComponent.componentIndex

        const labelMap: Record<string, string> = { ff: 'FF (메인 메뉴)', drink: '음료 (구성품 A)', dessert: `디저트 (구성품 ${dessertIdx === 0 ? 'B' : 'C'})` }
        const label = labelMap[editingComponent.componentType]

        const dayOfWeek = new Date(editingComponent.date).getDay()
        const isWedToSun = dayOfWeek === 0 || dayOfWeek >= 3
        const isMonday = dayOfWeek === 1
        const isFriday = dayOfWeek === 5

        // 금요일 삼각박스 컵라면 필수 슬롯 여부
        const isSamgakPlan = editingComponent.mealPlanName.startsWith('삼각')
        const isFridaySamgak = isFriday && isSamgakPlan
        // 컵라면 슬롯: 삼각3.5/4.5는 desserts[0], 삼각3.5(음X)는 desserts[0]이 컵라면
        const isCupRamenSlot = isFridaySamgak && !isFF && editingComponent.componentType === 'dessert' && editingComponent.componentIndex === 0
        const isCupRamenProduct = editingComponent.currentProduct?.group === '컵라면'

        // 주간 FF 사용 횟수 (중복 경고용)
        const weeklyFFCount = isFF
          ? Object.values(mealPlanMeals).flat().reduce<Record<string, number>>((acc, meal) => {
              if (!meal) return acc
              Object.values(meal.compositions).forEach(comp => {
                if (comp?.ff?.id) acc[comp.ff.id] = (acc[comp.ff.id] || 0) + 1
              })
              return acc
            }, {})
          : {}

        // 현재 미리보기 원가 (선택 전 현재 상태)
        const currentComp = currentMealPlanData.find(m => m.date === editingComponent.date)
          ?.compositions[currentMealPlanInfo?.price || 0]

        return (
          <Dialog open onOpenChange={() => setEditingComponent(null)}>
            <DialogContent className="max-w-lg bg-card">
              <DialogHeader>
                <DialogTitle className="text-foreground">{label} 교체</DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm">
                  현재: <span className="font-medium text-foreground">{editingComponent.currentProduct?.name || '없음'}</span>
                  {editingComponent.currentProduct && <span className="ml-1">({editingComponent.currentProduct.cost.toLocaleString()}원)</span>}
                </DialogDescription>
              </DialogHeader>

              {/* 연동 옵션 */}
              {isFF ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-secondary/50">
                    <Checkbox id="sync-same-type" checked={syncSameType} onCheckedChange={(v) => setSyncSameType(!!v)} />
                    <Label htmlFor="sync-same-type" className="text-sm text-foreground cursor-pointer">
                      동일 날짜의 같은 FF 타입 전 가격대에 일괄 적용
                    </Label>
                  </div>
                  {editingComponent.mealPlanName.startsWith('삼각') && (
                    <p className="text-xs text-amber-700 px-3">삼각김밥 FF 변경은 해당 식단 FF만 교체되며, 구성품(음료/디저트)은 기준 김밥 식단(삼각3.5↔김밥4.5, 삼각4.5↔김밥5.5)과의 연동을 유지합니다.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-secondary/50">
                    <Checkbox id="sync-related" checked={syncToRelated} onCheckedChange={(v) => setSyncToRelated(!!v)} />
                    <Label htmlFor="sync-related" className="text-sm text-foreground cursor-pointer">
                      이 변경사항을 연동된 식단에 일괄 적용
                    </Label>
                  </div>
                  {/* 삼각 단가 보정 연동 안내 */}
                  {editingComponent.mealPlanName === '삼각3.5' && (
                    <div className="flex items-start gap-1.5 px-3 py-1.5 rounded-md bg-amber-50 border border-amber-200">
                      <span className="text-amber-600 text-xs font-semibold shrink-0 mt-0.5">단가 보정</span>
                      <p className="text-xs text-amber-700">삼각3.5는 김밥4.5와 구성품이 연동됩니다. 수정 시 김밥4.5에도 역방향 반영됩니다.</p>
                    </div>
                  )}
                  {editingComponent.mealPlanName === '삼각4.5' && (
                    <div className="flex items-start gap-1.5 px-3 py-1.5 rounded-md bg-amber-50 border border-amber-200">
                      <span className="text-amber-600 text-xs font-semibold shrink-0 mt-0.5">단가 보정</span>
                      <p className="text-xs text-amber-700">삼각4.5는 김밥5.5와 구성품이 연동됩니다. 수정 시 김밥5.5에도 역방향 반영됩니다.</p>
                    </div>
                  )}
                  {editingComponent.mealPlanName === '김밥4.5' && !isFF && (
                    <div className="flex items-start gap-1.5 px-3 py-1.5 rounded-md bg-primary/5 border border-primary/20">
                      <span className="text-primary text-xs font-semibold shrink-0 mt-0.5">연동 대상</span>
                      <p className="text-xs text-primary/80">김밥4.5 구성품 변경 시 삼각3.5에 자동 반영됩니다. (단��� 보정 연동)</p>
                    </div>
                  )}
                  {editingComponent.mealPlanName === '김밥5.5' && !isFF && (
                    <div className="flex items-start gap-1.5 px-3 py-1.5 rounded-md bg-primary/5 border border-primary/20">
                      <span className="text-primary text-xs font-semibold shrink-0 mt-0.5">연동 대상</span>
                      <p className="text-xs text-primary/80">김밥5.5 구성품 변경 시 삼각4.5에 자동 반영됩니다. (단가 보정 연동)</p>
                    </div>
                  )}
                </div>
              )}

              {/* 금요일 삼각박스 컵라면 필수 경고 */}
              {isCupRamenSlot && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-800">금요일은 컵라면 필수 구성일입니다</p>
                      <p className="text-xs text-amber-700 mt-0.5">삼각박스 금요일 식단에는 컵라면 그룹 상품이 반드시 포함되어야 합니다. 다른 카테고리로 변경하려면 강제 변경을 허용해주세요.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <Checkbox
                      id="cup-ramen-override"
                      checked={cupRamenOverride}
                      onCheckedChange={(v) => setCupRamenOverride(!!v)}
                    />
                    <Label htmlFor="cup-ramen-override" className="text-xs text-amber-800 cursor-pointer">
                      강제 변경 허용 (실무자 판단)
                    </Label>
                  </div>
                </div>
              )}

              {/* 제약 안내 */}
              <div className="flex flex-col gap-1 px-1">
                {!isFF && isWedToSun && !isCupRamenSlot && (
                  <p className="text-xs text-amber-600">수~일요일: 요거트 상품이 목록에서 제외됩니다.</p>
                )}
                {!isFF && isMonday && (
                  <p className="text-xs text-primary">월요일: 요거트 필수 규칙이 적용됩니다.</p>
                )}
                {isFF && (
                  <p className="text-xs text-muted-foreground">원가 제한 없이 자유롭게 선택할 수 있습니다. 주 2회 초과 시 경고가 표시됩니다.</p>
                )}
              </div>

              {/* 현재 예상 합계 원가 */}
              {currentComp && (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 text-sm">
                  <span className="text-muted-foreground">현재 합계 원가</span>
                  <span className="font-semibold text-foreground">{currentComp.totalCost.toLocaleString()}원</span>
                  <span className="text-muted-foreground text-xs">/ 목표 {(
                    editingComponent.mealPlanName === '공장박스'
                      ? (mealPlanTargetCosts['공장박스'] ?? 963)
                      : (currentMealPlanInfo ? targetCosts[currentMealPlanInfo.price] : 0)
                  ).toLocaleString()}원</span>
                </div>
              )}

              {/* 실시간 가격 시뮬레이션 프리뷰 */}
              {pendingProduct && pendingProduct.id !== editingComponent.currentProduct?.id && currentComp && (() => {
                const newTotal = isFF
                  ? pendingProduct.cost + (currentComp.drink?.cost || 0) + currentComp.desserts.reduce((s, d) => s + d.cost, 0)
                  : isDrink
                    ? (currentComp.ff?.cost || 0) + pendingProduct.cost + currentComp.desserts.reduce((s, d) => s + d.cost, 0)
                    : (() => {
                        const newDesserts = [...currentComp.desserts]
                        if (dessertIdx < newDesserts.length) newDesserts[dessertIdx] = pendingProduct
                        return (currentComp.ff?.cost || 0) + (currentComp.drink?.cost || 0) + newDesserts.reduce((s, d) => s + d.cost, 0)
                      })()
                const diff = newTotal - currentComp.totalCost
                const targetCost = editingComponent.mealPlanName === '공장박스'
                  ? (mealPlanTargetCosts['공장박스'] ?? 963)
                  : (currentMealPlanInfo ? targetCosts[currentMealPlanInfo.price] : 0)
                const isOver = newTotal > targetCost * 1.03

                return (
                  <div className={`rounded-lg border px-3 py-2 ${isOver ? 'border-destructive/40 bg-destructive/5' : 'border-primary/40 bg-primary/5'}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">변경 시 합계</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground line-through">{currentComp.totalCost.toLocaleString()}원</span>
                        <span className="text-foreground">→</span>
                        <span className={`font-semibold ${isOver ? 'text-destructive' : 'text-primary'}`}>{newTotal.toLocaleString()}원</span>
                        <span className={`text-xs ${diff > 0 ? 'text-destructive' : 'text-primary'}`}>
                          ({diff >= 0 ? '+' : ''}{diff.toLocaleString()}원)
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* 상품 목록: 현재 상품 최상단 고정 + 나머지 가격순 */}
              <ScrollArea className="h-56 rounded border border-border">
                <div className="p-2 space-y-1">
                  {getAvailableProducts.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-sm">교체 가능한 상품이 없습니다</div>
                  )}
                  {(() => {
                    // 현재 상품 최상단, 나머지 가격순 정렬
                    const currentId = editingComponent.currentProduct?.id
                    const sorted = [...getAvailableProducts].sort((a, b) => {
                      if (a.id === currentId) return -1
                      if (b.id === currentId) return 1
                      return a.cost - b.cost
                    })
                    return sorted.map((product) => {
                      const isCurrent = currentId === product.id
                      const isSelected = pendingProduct?.id === product.id
                      const ffOverused = isFF && (weeklyFFCount[product.id] || 0) >= 2 && !isCurrent

                      return (
                        <button
                          key={product.id}
                          onClick={() => setPendingProduct(product)}
                          className={`w-full text-left p-2 rounded transition-colors flex items-start justify-between gap-2 ${
                            isSelected
                              ? 'bg-primary/20 border-2 border-primary ring-1 ring-primary/30'
                              : isCurrent
                                ? 'bg-secondary/80 border border-border'
                                : 'hover:bg-secondary'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {isCurrent && <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded">현재</span>}
                              <span className="text-sm font-medium text-foreground truncate">{product.name}</span>
                              {ffOverused && (
                                <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">주 2회 초과</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{product.group || product.ffType || '-'}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-sm text-muted-foreground">{product.cost.toLocaleString()}원</div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                        </button>
                      )
                    })
                  })()}
                </div>
              </ScrollArea>

              {/* 하단 확정/취소 버튼 */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setEditingComponent(null)}>
                  취소
                </Button>
                <Button
                  size="sm"
                  disabled={!pendingProduct || pendingProduct.id === editingComponent.currentProduct?.id}
                  onClick={() => {
                    if (pendingProduct) {
                      handleSelectProduct(pendingProduct)
                    }
                  }}
                >
                  확정
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )
      })()}

      {/* 도시락 조합 수정 다이얼로그 */}
      {editingDosirakSet && (
        <Dialog open={!!editingDosirakSet} onOpenChange={() => setEditingDosirakSet(null)}>
          <DialogContent className="max-w-md bg-card">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                조합 {editingDosirakSet.setNumber} - {
                  editingDosirakSet.componentType === 'ff' ? '도시락' :
                  editingDosirakSet.componentType === 'drink' ? '음료' : '디저트'
                } 변경
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                현재: <span className="font-medium text-foreground">{editingDosirakSet.currentProduct?.name || '없음'}</span>
                {editingDosirakSet.currentProduct && <span className="ml-1">({editingDosirakSet.currentProduct.cost.toLocaleString()}원)</span>}
              </DialogDescription>
            </DialogHeader>

            {/* 실시간 가격 시뮬레이션 */}
            {pendingDosirakProduct && pendingDosirakProduct.id !== editingDosirakSet.currentProduct?.id && (() => {
              const currentSet = dosirakSets[editingDosirakSet.pricePoint]?.find(s => s.setNumber === editingDosirakSet.setNumber)
              if (!currentSet) return null
              const currentTotal = currentSet.totalCost
              let newTotal = currentTotal
              if (editingDosirakSet.componentType === 'ff') {
                newTotal = pendingDosirakProduct.cost + (currentSet.drink?.cost || 0) + currentSet.desserts.reduce((s, d) => s + d.cost, 0)
              } else if (editingDosirakSet.componentType === 'drink') {
                newTotal = (currentSet.ff?.cost || 0) + pendingDosirakProduct.cost + currentSet.desserts.reduce((s, d) => s + d.cost, 0)
              } else {
                const dessertsCost = currentSet.desserts.reduce((s, d, i) => s + (i === editingDosirakSet.componentIndex ? pendingDosirakProduct.cost : d.cost), 0)
                newTotal = (currentSet.ff?.cost || 0) + (currentSet.drink?.cost || 0) + dessertsCost
              }
              const diff = newTotal - currentTotal
              return (
                <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">변경 시 합계</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground line-through">{currentTotal.toLocaleString()}원</span>
                      <span className="text-foreground">→</span>
                      <span className="font-semibold text-primary">{newTotal.toLocaleString()}원</span>
                      <span className={`text-xs ${diff > 0 ? 'text-destructive' : 'text-primary'}`}>
                        ({diff >= 0 ? '+' : ''}{diff.toLocaleString()}원)
                      </span>
                    </div>
                  </div>
                </div>
              )
            })()}

            <ScrollArea className="max-h-64 rounded border border-border">
              <div className="p-2 space-y-1">
                {(() => {
                  const { componentType, currentProduct } = editingDosirakSet
                  let pool: Product[] = []
                  if (componentType === 'ff') {
                    pool = products.filter(p => p.category === 'ff' && p.ffType === '도시락')
                  } else if (componentType === 'drink') {
                    pool = products.filter(p => p.category === 'drink')
                  } else {
                    pool = products.filter(p => p.category === 'dessert')
                  }
                  // 현재 상품 최상단 + 나머지 가격순
                  const sorted = [...pool].sort((a, b) => {
                    if (a.id === currentProduct?.id) return -1
                    if (b.id === currentProduct?.id) return 1
                    return a.cost - b.cost
                  })
                  return sorted.map(product => {
                    const isCurrent = product.id === currentProduct?.id
                    const isSelected = pendingDosirakProduct?.id === product.id
                    return (
                      <button
                        key={product.id}
                        onClick={() => setPendingDosirakProduct(product)}
                        className={`w-full text-left p-2 rounded transition-colors flex items-start justify-between gap-2 ${
                          isSelected
                            ? 'bg-primary/20 border-2 border-primary ring-1 ring-primary/30'
                            : isCurrent
                              ? 'bg-secondary/80 border border-border'
                              : 'hover:bg-secondary'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {isCurrent && <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded">현재</span>}
                            <span className="text-sm font-medium text-foreground truncate">{product.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{product.group || product.ffType || '-'}</div>
                        </div>
                        <div className="shrink-0 text-sm text-muted-foreground">{product.cost.toLocaleString()}원</div>
                        {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </button>
                    )
                  })
                })()}
              </div>
            </ScrollArea>

            {/* 하단 확정/취소 버튼 */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setEditingDosirakSet(null)}>
                취소
              </Button>
              <Button
                size="sm"
                disabled={!pendingDosirakProduct || pendingDosirakProduct.id === editingDosirakSet.currentProduct?.id}
                onClick={() => {
                  if (pendingDosirakProduct) {
                    handleSelectDosirakProduct(pendingDosirakProduct)
                  }
                }}
              >
                확정
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 프리포맷 슬롯 편집 다이얼로그 */}
      {freeEditState && (
        <Dialog open={!!freeEditState} onOpenChange={() => setFreeEditState(null)}>
          <DialogContent className="max-w-md bg-card">
            <DialogHeader>
              <DialogTitle className="text-foreground">슬롯 {freeEditState.slotIndex + 1} 편집</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                전체 상품 마스터에서 선택하거나 텍스트를 직접 입력하세요.
              </DialogDescription>
            </DialogHeader>

            {/* 모드 탭 */}
            <div className="flex gap-1 p-1 bg-secondary rounded-lg">
              <button
                className={`flex-1 py-1.5 text-xs rounded transition-colors ${freeEditState.mode === 'product' ? 'bg-card shadow-sm text-foreground font-medium' : 'text-muted-foreground'}`}
                onClick={() => setFreeEditState(s => s ? { ...s, mode: 'product' } : s)}
              >상품 선택</button>
              <button
                className={`flex-1 py-1.5 text-xs rounded transition-colors ${freeEditState.mode === 'text' ? 'bg-card shadow-sm text-foreground font-medium' : 'text-muted-foreground'}`}
                onClick={() => setFreeEditState(s => s ? { ...s, mode: 'text' } : s)}
              >텍스트 직접 입력</button>
            </div>

            {freeEditState.mode === 'text' ? (
              <div className="space-y-3">
                <Input
                  value={freeCustomText}
                  onChange={(e) => setFreeCustomText(e.target.value)}
                  placeholder="메뉴명 직접 입력 (예: 특제 도시락)"
                  className="bg-background"
                  autoFocus
                />
                <Button
                  className="w-full"
                  disabled={!freeCustomText.trim()}
                  onClick={() => {
                    if (!freeCustomText.trim()) return
                    setFreeSlot(freeEditState.date, freeEditState.slotIndex, {
                      id: Math.random().toString(36).substring(2, 9),
                      customText: freeCustomText.trim(),
                      cost: 0,
                    })
                    setFreeEditState(null)
                  }}
                >
                  저장
                </Button>
              </div>
            ) : (
              <ScrollArea className="max-h-72">
                <div className="space-y-0.5 pr-2">
                  {/* FF */}
                  <p className="text-[10px] text-muted-foreground font-medium px-1 pt-1">FF</p>
                  {products.filter(p => p.category === 'ff').map(p => (
                    <button key={p.id} onClick={() => {
                      setFreeSlot(freeEditState.date, freeEditState.slotIndex, { id: Math.random().toString(36).substring(2, 9), product: p, cost: p.cost })
                      setFreeEditState(null)
                    }} className="w-full text-left px-2 py-1.5 rounded hover:bg-secondary flex justify-between items-center text-sm">
                      <span className="text-foreground truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{p.cost.toLocaleString()}원</span>
                    </button>
                  ))}
                  {/* 음료 */}
                  <p className="text-[10px] text-muted-foreground font-medium px-1 pt-2">음료</p>
                  {products.filter(p => p.category === 'drink').map(p => (
                    <button key={p.id} onClick={() => {
                      setFreeSlot(freeEditState.date, freeEditState.slotIndex, { id: Math.random().toString(36).substring(2, 9), product: p, cost: p.cost })
                      setFreeEditState(null)
                    }} className="w-full text-left px-2 py-1.5 rounded hover:bg-secondary flex justify-between items-center text-sm">
                      <span className="text-foreground truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{p.cost.toLocaleString()}원</span>
                    </button>
                  ))}
                  {/* 디저트 */}
                  <p className="text-[10px] text-muted-foreground font-medium px-1 pt-2">디저트</p>
                  {products.filter(p => p.category === 'dessert').map(p => (
                    <button key={p.id} onClick={() => {
                      setFreeSlot(freeEditState.date, freeEditState.slotIndex, { id: Math.random().toString(36).substring(2, 9), product: p, cost: p.cost })
                      setFreeEditState(null)
                    }} className="w-full text-left px-2 py-1.5 rounded hover:bg-secondary flex justify-between items-center text-sm">
                      <span className="text-foreground truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{p.cost.toLocaleString()}원</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* 식단 저장 다이얼로그 */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">전체 식단 저장</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              모든 FF 타입(김밥, 샌드, 버거, 삼각, 도시락)과 모든 가격대의 식단을 저장합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="snapshot-name" className="text-sm text-foreground">스냅샷 이름</Label>
              <Input
                id="snapshot-name"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="예: 2025년 1월 1주차"
                className="bg-background"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                취소
              </Button>
              <Button onClick={handleSaveSnapshot} disabled={!snapshotName.trim()}>
                <Save className="w-4 h-4 mr-1.5" />
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 식단 불러오기 다이얼로그 */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">저장된 식단 불러오기</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              저장된 스냅샷을 선택하면 모든 식단 데이터가 복원됩니다.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-80">
            <div className="space-y-2">
              {snapshots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  저장된 스냅샷이 없습니다
                </div>
              ) : (
                snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{snapshot.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(snapshot.createdAt).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        기간: {new Date(snapshot.startDate).toLocaleDateString('ko-KR')} ~ {new Date(snapshot.endDate).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleLoadSnapshot(snapshot.id)}
                      >
                        <FolderOpen className="w-3.5 h-3.5 mr-1" />
                        불러오기
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteSnapshot(snapshot.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface MealDetailProps {
  price: number
  composition: MealComposition | null
  targetCost: number
  date: string
  onEditComponent: (componentType: 'ff' | 'drink' | 'dessert', componentIndex: number, currentProduct: Product | null) => void
}

function MealDetail({ price, composition, targetCost, date, onEditComponent }: MealDetailProps) {
  const maxCost = targetCost * 1.03
  const isOverBudget = composition && composition.totalCost > maxCost
  
  // 디저트 색상 가져오기
  const getDessertColors = (dessert: Product) => {
    if (dessert.group && DESSERT_GROUP_COLORS[dessert.group]) {
      return DESSERT_GROUP_COLORS[dessert.group]
    }
    return getDefaultDessertColor()
  }
  
  return (
    <div className={`p-4 rounded-lg border ${
      isOverBudget 
        ? 'border-destructive/50 bg-destructive/5' 
        : composition 
          ? 'border-primary/30 bg-primary/5' 
          : 'border-muted bg-muted/20'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-foreground">
            {price.toLocaleString()}원
          </span>
          {isOverBudget && (
            <span className="text-xs px-2 py-0.5 bg-destructive/20 text-destructive rounded-full flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              원가 초과 (103% 초과)
            </span>
          )}
        </div>
        {composition && (
          <div className="text-sm">
            <span className={isOverBudget ? 'text-destructive font-medium' : 'text-muted-foreground'}>
              {composition.totalCost.toLocaleString()}원
            </span>
            <span className="text-muted-foreground"> / {targetCost.toLocaleString()}원 (상한: {Math.round(maxCost).toLocaleString()}원)</span>
          </div>
        )}
      </div>
      
      {composition ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {composition.ff && (
            <div className={`p-2 rounded border ${FF_COLOR.bg} ${FF_COLOR.border} relative group`}>
              <div className={`text-xs mb-1 ${FF_COLOR.text}`}>FF ({composition.ff.ffType})</div>
              <div className="text-sm font-medium text-foreground">{composition.ff.name}</div>
              <div className="text-xs text-muted-foreground">{composition.ff.cost.toLocaleString()}원</div>
              <button
                onClick={() => onEditComponent('ff', 0, composition.ff ?? null)}
                className="absolute top-1 right-1 p-1 rounded bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          )}
          {composition.drink && (
            <div className={`p-2 rounded border ${DRINK_COLOR.bg} ${DRINK_COLOR.border} relative group`}>
              <div className={`text-xs mb-1 ${DRINK_COLOR.text}`}>음료 ({composition.drink.group || '-'})</div>
              <div className="text-sm font-medium text-foreground">{composition.drink.name}</div>
              <div className="text-xs text-muted-foreground">{composition.drink.cost.toLocaleString()}원</div>
              <button
                onClick={() => onEditComponent('drink', 0, composition.drink ?? null)}
                className="absolute top-1 right-1 p-1 rounded bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          )}
          {composition.desserts.map((dessert, i) => {
            const colors = getDessertColors(dessert)
            return (
              <div key={i} className={`p-2 rounded border ${colors.bg} ${colors.border} relative group`}>
                <div className={`text-xs mb-1 ${colors.text}`}>디저트{i + 1} ({dessert.group || '-'})</div>
                <div className="text-sm font-medium text-foreground">{dessert.name}</div>
                <div className="text-xs text-muted-foreground">{dessert.cost.toLocaleString()}원</div>
                <button
                  onClick={() => onEditComponent('dessert', i, dessert)}
                  className="absolute top-1 right-1 p-1 rounded bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          조건에 맞는 식단을 구성할 수 없습니다. 상품을 추가해주세요.
        </div>
      )}
    </div>
  )
}
