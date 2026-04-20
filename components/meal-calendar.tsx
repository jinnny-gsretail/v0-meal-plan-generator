'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMealboxStore } from '@/lib/store'
import { MealComposition, ALL_MEAL_PLANS } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function MealCalendar() {
  const { 
    selectedMonth: storedMonth, 
    setSelectedMonth, 
    mealPlanMeals, 
    targetCosts,
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

  return (
    <div className="rounded-lg border border-border bg-card">
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
                    <div className="text-[9px] leading-tight px-0.5 py-px rounded bg-ff/20 text-ff truncate">
                      {composition.ff.name}
                    </div>
                  )}
                  {/* 음료 */}
                  {composition.drink && (
                    <div className="text-[9px] leading-tight px-0.5 py-px rounded bg-primary/20 text-primary truncate">
                      {composition.drink.name}
                    </div>
                  )}
                  {/* 디저트들 */}
                  {composition.desserts.map((dessert, i) => (
                    <div key={i} className="text-[9px] leading-tight px-0.5 py-px rounded bg-dessert/20 text-dessert truncate">
                      {dessert.name}
                    </div>
                  ))}
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
            <div className="p-2 bg-ff/10 rounded border border-ff/20">
              <div className="text-xs text-ff mb-1">FF ({composition.ff.ffType})</div>
              <div className="text-sm font-medium text-foreground">{composition.ff.name}</div>
              <div className="text-xs text-muted-foreground">{composition.ff.cost.toLocaleString()}원</div>
            </div>
          )}
          {composition.drink && (
            <div className="p-2 bg-primary/10 rounded border border-primary/20">
              <div className="text-xs text-primary mb-1">음료 ({composition.drink.group || '-'})</div>
              <div className="text-sm font-medium text-foreground">{composition.drink.name}</div>
              <div className="text-xs text-muted-foreground">{composition.drink.cost.toLocaleString()}원</div>
            </div>
          )}
          {composition.desserts.map((dessert, i) => (
            <div key={i} className="p-2 bg-dessert/10 rounded border border-dessert/20">
              <div className="text-xs text-dessert mb-1">디저트{i + 1} ({dessert.group || '-'})</div>
              <div className="text-sm font-medium text-foreground">{dessert.name}</div>
              <div className="text-xs text-muted-foreground">{dessert.cost.toLocaleString()}원</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          조건에 맞는 식단을 구성할 수 없습니다. 상품을 추가해주세요.
        </div>
      )}
    </div>
  )
}
