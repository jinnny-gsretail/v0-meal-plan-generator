'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMealboxStore } from '@/lib/store'
import { PRICE_POINT_CONFIGS, MealComposition } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function MealCalendar() {
  const { selectedMonth: storedMonth, setSelectedMonth, dailyMeals, targetCosts } = useMealboxStore()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  
  // Ensure selectedMonth is a Date object (may be string after hydration from localStorage)
  const selectedMonth = storedMonth instanceof Date ? storedMonth : new Date(storedMonth)
  const year = selectedMonth.getFullYear()
  const month = selectedMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  const prevMonth = () => {
    setSelectedMonth(new Date(year, month - 1, 1))
  }
  
  const nextMonth = () => {
    setSelectedMonth(new Date(year, month + 1, 1))
  }
  
  const getMealForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return dailyMeals.find(m => m.date === dateStr)
  }
  
  const calendarDays = []
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i)
  }
  
  const selectedMeal = selectedDate ? dailyMeals.find(m => m.date === selectedDate) : null

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={prevMonth}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-semibold text-foreground">
          {year}년 {month + 1}월
        </h2>
        <Button variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
      
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((day, i) => (
          <div 
            key={day} 
            className={`p-2 text-center text-sm font-medium ${
              i === 0 ? 'text-destructive' : i === 6 ? 'text-drink' : 'text-muted-foreground'
            }`}
          >
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          const meal = day ? getMealForDate(day) : null
          const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''
          const isWeekend = idx % 7 === 0 || idx % 7 === 6
          const hasAllMeals = meal && PRICE_POINT_CONFIGS.every(c => meal.compositions[c.price])
          const hasSomeMeals = meal && PRICE_POINT_CONFIGS.some(c => meal.compositions[c.price])
          
          return (
            <div
              key={idx}
              className={`min-h-24 p-2 border-r border-b border-border last:border-r-0 
                ${!day ? 'bg-secondary/20' : 'hover:bg-secondary/30 cursor-pointer'}
                ${isWeekend ? 'bg-secondary/10' : ''}`}
              onClick={() => day && setSelectedDate(dateStr)}
            >
              {day && (
                <>
                  <div className={`text-sm font-medium mb-1 ${
                    idx % 7 === 0 ? 'text-destructive' : idx % 7 === 6 ? 'text-drink' : 'text-foreground'
                  }`}>
                    {day}
                  </div>
                  {meal && (
                    <div className="space-y-0.5">
                      {PRICE_POINT_CONFIGS.map(config => {
                        const composition = meal.compositions[config.price]
                        const isOverBudget = composition && composition.totalCost > targetCosts[config.price]
                        
                        return (
                          <div 
                            key={config.price}
                            className={`text-xs px-1 py-0.5 rounded truncate ${
                              composition
                                ? isOverBudget
                                  ? 'bg-destructive/20 text-destructive'
                                  : 'bg-primary/20 text-primary'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {composition ? (
                              <span className="flex items-center gap-1">
                                {isOverBudget && <AlertCircle className="w-3 h-3 shrink-0" />}
                                <span className="truncate">{config.price / 1000}K</span>
                              </span>
                            ) : (
                              <span>{config.price / 1000}K ⚠</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {!meal && hasSomeMeals === undefined && (
                    <div className="text-xs text-muted-foreground">
                      식단 없음
                    </div>
                  )}
                </>
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
              })} 식단
            </DialogTitle>
          </DialogHeader>
          
          {selectedMeal && (
            <div className="space-y-4">
              {PRICE_POINT_CONFIGS.map(config => {
                const composition = selectedMeal.compositions[config.price]
                const targetCost = targetCosts[config.price]
                const isOverBudget = composition && composition.totalCost > targetCost
                
                return (
                  <MealDetail
                    key={config.price}
                    price={config.price}
                    composition={composition}
                    targetCost={targetCost}
                    isOverBudget={isOverBudget}
                  />
                )
              })}
            </div>
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
  isOverBudget?: boolean
}

function MealDetail({ price, composition, targetCost, isOverBudget }: MealDetailProps) {
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
              원가 초과
            </span>
          )}
        </div>
        {composition && (
          <div className="text-sm">
            <span className={isOverBudget ? 'text-destructive font-medium' : 'text-muted-foreground'}>
              {composition.totalCost.toLocaleString()}원
            </span>
            <span className="text-muted-foreground"> / {targetCost.toLocaleString()}원</span>
          </div>
        )}
      </div>
      
      {composition ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {composition.ff && (
            <div className="p-2 bg-ff/10 rounded border border-ff/20">
              <div className="text-xs text-ff mb-1">FF</div>
              <div className="text-sm font-medium text-foreground">{composition.ff.name}</div>
              <div className="text-xs text-muted-foreground">{composition.ff.cost.toLocaleString()}원</div>
            </div>
          )}
          {composition.drink && (
            <div className="p-2 bg-drink/10 rounded border border-drink/20">
              <div className="text-xs text-drink mb-1">음료</div>
              <div className="text-sm font-medium text-foreground">{composition.drink.name}</div>
              <div className="text-xs text-muted-foreground">{composition.drink.cost.toLocaleString()}원</div>
            </div>
          )}
          {composition.desserts.map((dessert, i) => (
            <div key={i} className="p-2 bg-dessert/10 rounded border border-dessert/20">
              <div className="text-xs text-dessert mb-1">디저트 {i + 1}</div>
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
