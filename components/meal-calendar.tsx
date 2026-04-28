'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle, Download, Pencil, Check, Factory, Users } from 'lucide-react'
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
    targetCosts,
    mealPlanTargetCosts,
    selectedMealPlan,
    startDate: storedStartDate,
    endDate: storedEndDate,
    products,
    updateMealComponent
  } = useMealboxStore()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  
  // 뷰 모드: 'customer' = 고객 수령일 기준, 'factory' = 공장 생산일 기준 (D-1)
  const [viewMode, setViewMode] = useState<'customer' | 'factory'>('customer')
  
  // 구성품 수정 상태
  const [editingComponent, setEditingComponent] = useState<{
    date: string
    mealPlanName: string
    componentType: 'drink' | 'dessert'
    componentIndex: number
    currentProduct: Product | null
  } | null>(null)
  const [syncToRelated, setSyncToRelated] = useState(true)
  
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
  
  // 캘린더 날짜 배열 생성 (이전 달, 현재 달, 다음 달 포함)
  const calendarDays: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = []
  
  // 이전 달 날짜 (첫 주 채우기)
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthLastDate - i
    const m = month === 0 ? 11 : month - 1
    const y = month === 0 ? year - 1 : year
    calendarDays.push({ day: d, month: m, year: y, isCurrentMonth: false })
  }
  
  // 현재 달 날짜
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ day: i, month, year, isCurrentMonth: true })
  }
  
  // 다음 달 날짜 (마지막 주 채우기, 6주 고정으로 표시)
  const remainingDays = 42 - calendarDays.length // 6주 = 42일
  for (let i = 1; i <= remainingDays; i++) {
    const m = month === 11 ? 0 : month + 1
    const y = month === 11 ? year + 1 : year
    calendarDays.push({ day: i, month: m, year: y, isCurrentMonth: false })
  }
  
  const selectedMeal = selectedDate 
    ? currentMealPlanData.find(m => m.date === selectedDate) 
    : null

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
        
        if (isInRangeDate(currentDate)) {
          const meal = getMealForDate(dateStr)
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
  }, [calendarDays, currentMealPlanData, currentMealPlanInfo, startDate, endDate])

  // 월 전체 평균 원가 및 원가대비 계산
  const monthlyStats = useMemo(() => {
    if (!currentMealPlanInfo) return null
    
    const allCosts: number[] = []
    calendarDays.forEach(dateInfo => {
      const dateStr = `${dateInfo.year}-${String(dateInfo.month + 1).padStart(2, '0')}-${String(dateInfo.day).padStart(2, '0')}`
      const currentDate = new Date(dateInfo.year, dateInfo.month, dateInfo.day)
      
      if (isInRangeDate(currentDate)) {
        const meal = getMealForDate(dateStr)
        const composition = meal?.compositions[currentMealPlanInfo.price]
        if (composition) {
          allCosts.push(composition.totalCost)
        }
      }
    })
    
    if (allCosts.length === 0) return null
    
    const totalCost = allCosts.reduce((a, b) => a + b, 0)
    const avgCost = Math.round(totalCost / allCosts.length)
    const targetCost = targetCosts[currentMealPlanInfo.price]
    const diff = avgCost - targetCost
    
    return {
      totalDays: allCosts.length,
      avgCost,
      targetCost,
      diff,
      totalCost
    }
  }, [calendarDays, currentMealPlanData, currentMealPlanInfo, targetCosts, startDate, endDate])

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

  // 식단 데이터가 없으면 생성 안내
  if (currentMealPlanData.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          식단이 생성되지 않았습니다. 상품을 등록하고 &apos;식단 자동 생성&apos; 버튼을 클릭해주세요.
        </p>
      </div>
    )
  }

  const handleDownloadCustomer = () => {
    if (!startDate || !endDate) return
    downloadCustomerExcel(mealPlanMeals, mealPlanTargetCosts, startDate, endDate)
  }

  const handleDownloadFactory = () => {
    if (!startDate || !endDate) return
    downloadFactoryExcel(mealPlanMeals, mealPlanTargetCosts, startDate, endDate)
  }

  const hasData = startDate && endDate && Object.keys(mealPlanMeals).length > 0

  // 교체 가능한 상품 목록 (제약 조건 필터링)
  const getAvailableProducts = useMemo(() => {
    if (!editingComponent) return []
    
    const { date, componentType } = editingComponent
    const d = new Date(date)
    const dayOfWeek = d.getDay()
    
    // 요거트 허용: 월(1), 화(2)만
    const isYogurtAllowed = dayOfWeek === 1 || dayOfWeek === 2
    // 월요일 요거트 필수는 이미 음료에 요거트가 있으면 디저트에서 요거트 제외
    const isMonday = dayOfWeek === 1
    
    // 해당 식단의 현재 구성 확인 (요거트 중복 방지)
    const currentMealData = currentMealPlanData.find(m => m.date === date)
    const currentComp = currentMealData?.compositions[currentMealPlanInfo?.price || 0]
    const hasYogurtDrink = currentComp?.drink?.group === '요거트'
    
    let pool: Product[] = []
    
    if (componentType === 'drink') {
      pool = products.filter(p => p.category === 'drink')
      // 수~일: 요거트 제외
      if (!isYogurtAllowed) {
        pool = pool.filter(p => p.group !== '요거트')
      }
    } else {
      pool = products.filter(p => p.category === 'dessert')
      // 수~일: 요거트 제외
      if (!isYogurtAllowed) {
        pool = pool.filter(p => p.group !== '요거트')
      }
      // 월요일 + 음료가 요거트면 디저트에서 요거트 제외 (중복 금지)
      if (isMonday && hasYogurtDrink) {
        pool = pool.filter(p => p.group !== '요거트')
      }
    }
    
    // 원가순 정렬
    return pool.sort((a, b) => a.cost - b.cost)
  }, [editingComponent, products, currentMealPlanData, currentMealPlanInfo])

  // 구성품 선택 핸들러
  const handleSelectProduct = (product: Product) => {
    if (!editingComponent || !selectedMealPlan) return
    
    updateMealComponent(
      editingComponent.date,
      editingComponent.mealPlanName,
      editingComponent.componentType,
      editingComponent.componentIndex,
      product,
      syncToRelated
    )
    
    setEditingComponent(null)
  }

  // 구성품 수정 버튼 클릭
  const handleEditComponent = (
    date: string,
    componentType: 'drink' | 'dessert',
    componentIndex: number,
    currentProduct: Product | null
  ) => {
    if (!selectedMealPlan) return
    setEditingComponent({
      date,
      mealPlanName: selectedMealPlan,
      componentType,
      componentIndex,
      currentProduct
    })
  }

  return (
    <div className="space-y-4">
      {/* 상단 컨트롤: 뷰 모드 토글 + 다운로드 버튼 */}
      <div className="flex items-center justify-between">
        {/* 뷰 모드 토글 */}
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
        
        {/* 다운로드 버튼 */}
        <div className="flex gap-2">
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
              const targetCost = currentMealPlanInfo ? targetCosts[currentMealPlanInfo.price] * 1.03 : 0
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
                  onClick={() => inRange && setSelectedDate(dateStr)}
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
      
      {/* 월 전체 통계 (하단) */}
      {monthlyStats && (
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

      {/* 구성품 교체 다이얼로그 */}
      <Dialog open={!!editingComponent} onOpenChange={() => setEditingComponent(null)}>
        <DialogContent className="max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingComponent?.componentType === 'drink' ? '음료' : `디저트${(editingComponent?.componentIndex ?? 0) + 1}`} 교체
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              현재: {editingComponent?.currentProduct?.name || '없음'} ({editingComponent?.currentProduct?.cost?.toLocaleString() || 0}원)
            </DialogDescription>
          </DialogHeader>

          {/* 연동 수정 옵션 */}
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-secondary/50">
            <Checkbox 
              id="sync-related" 
              checked={syncToRelated} 
              onCheckedChange={(checked) => setSyncToRelated(!!checked)} 
            />
            <Label htmlFor="sync-related" className="text-sm text-foreground cursor-pointer">
              이 변경사항을 모든 가격대 및 삼각김밥 식단에 적용
            </Label>
          </div>

          {/* 제약 조건 안내 */}
          {editingComponent && (
            <div className="text-xs text-muted-foreground px-1">
              {new Date(editingComponent.date).getDay() >= 3 || new Date(editingComponent.date).getDay() === 0 ? (
                <span className="text-amber-600">수~일요일: 요거트 상품 제외됨</span>
              ) : new Date(editingComponent.date).getDay() === 1 ? (
                <span className="text-primary">월요일: 요거트 필수 (음료에 요거트 배정)</span>
              ) : null}
            </div>
          )}

          {/* 상품 목록 */}
          <ScrollArea className="h-64 rounded border border-border">
            <div className="p-2 space-y-1">
              {getAvailableProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleSelectProduct(product)}
                  className={`w-full text-left p-2 rounded hover:bg-secondary transition-colors flex items-center justify-between ${
                    editingComponent?.currentProduct?.id === product.id ? 'bg-primary/10 border border-primary/30' : ''
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{product.name}</div>
                    <div className="text-xs text-muted-foreground">{product.group || '-'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{product.cost.toLocaleString()}원</span>
                    {editingComponent?.currentProduct?.id === product.id && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                </button>
              ))}
              {getAvailableProducts.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  교체 가능한 상품이 없습니다
                </div>
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
  onEditComponent: (componentType: 'drink' | 'dessert', componentIndex: number, currentProduct: Product | null) => void
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
            <div className={`p-2 rounded border ${FF_COLOR.bg} ${FF_COLOR.border}`}>
              <div className={`text-xs mb-1 ${FF_COLOR.text}`}>FF ({composition.ff.ffType})</div>
              <div className="text-sm font-medium text-foreground">{composition.ff.name}</div>
              <div className="text-xs text-muted-foreground">{composition.ff.cost.toLocaleString()}원</div>
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
