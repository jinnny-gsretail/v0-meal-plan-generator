'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMealboxStore } from '@/lib/store'
import { MealComposition, ALL_MEAL_PLANS, Product } from '@/lib/types'
import { downloadCustomerExcel, downloadFactoryExcel } from '@/lib/excel-export'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
    endDate: storedEndDate
  } = useMealboxStore()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  
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
  
  const getMealForDate = (dateStr: string) => {
    return currentMealPlanData.find(m => m.date === dateStr)
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

  return (
    <div className="space-y-4">
      {/* 다운로드 버튼 */}
      <div className="flex justify-end gap-2">
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
              
              const inRange = isInRangeDate(currentDate)
              
              return (
                <div
                  key={idx}
                  className={`min-h-24 p-1 border-r border-b border-border last:border-r-0 
                    ${!dateInfo.isCurrentMonth ? 'bg-secondary/30' : ''}
                    ${inRange ? 'hover:bg-secondary/30 cursor-pointer' : 'opacity-40'}
                    ${isWeekend && inRange ? 'bg-secondary/10' : ''}`}
                  onClick={() => inRange && setSelectedDate(dateStr)}
                >
                  <div className={`text-xs font-medium mb-0.5 ${
                    !dateInfo.isCurrentMonth 
                      ? 'text-muted-foreground/50'
                      : idx % 7 === 0 ? 'text-destructive' : idx % 7 === 6 ? 'text-primary' : 'text-foreground'
                  }`}>
                    {dateInfo.day}
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
          </DialogHeader>
          
          {selectedMeal && currentMealPlanInfo && (
            <MealDetail
              price={currentMealPlanInfo.price}
              composition={selectedMeal.compositions[currentMealPlanInfo.price]}
              targetCost={targetCosts[currentMealPlanInfo.price]}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface MealDetailProps {
  price: number
  composition: MealComposition | null
  targetCost: number
}

function MealDetail({ price, composition, targetCost }: MealDetailProps) {
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
            <div className={`p-2 rounded border ${DRINK_COLOR.bg} ${DRINK_COLOR.border}`}>
              <div className={`text-xs mb-1 ${DRINK_COLOR.text}`}>음료 ({composition.drink.group || '-'})</div>
              <div className="text-sm font-medium text-foreground">{composition.drink.name}</div>
              <div className="text-xs text-muted-foreground">{composition.drink.cost.toLocaleString()}원</div>
            </div>
          )}
          {composition.desserts.map((dessert, i) => {
            const colors = getDessertColors(dessert)
            return (
              <div key={i} className={`p-2 rounded border ${colors.bg} ${colors.border}`}>
                <div className={`text-xs mb-1 ${colors.text}`}>디저트{i + 1} ({dessert.group || '-'})</div>
                <div className="text-sm font-medium text-foreground">{dessert.name}</div>
                <div className="text-xs text-muted-foreground">{dessert.cost.toLocaleString()}원</div>
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
