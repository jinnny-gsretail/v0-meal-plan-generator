'use client'

import { useState } from 'react'
import { Sparkles, RefreshCw, Download, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useMealboxStore } from '@/lib/store'
import { cn } from '@/lib/utils'

function DatePicker({ 
  selectedDate, 
  onSelect, 
  label 
}: { 
  selectedDate: Date | null
  onSelect: (date: Date) => void
  label: string 
}) {
  const [viewDate, setViewDate] = useState(selectedDate || new Date())
  const [isOpen, setIsOpen] = useState(false)
  
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  
  const days = []
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }
  
  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1))
  }
  
  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1))
  }
  
  const handleSelect = (day: number) => {
    const date = new Date(year, month, day)
    onSelect(date)
    setIsOpen(false)
  }
  
  const formatDate = (date: Date | null) => {
    if (!date) return '날짜 선택'
    const d = date instanceof Date ? date : new Date(date)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }
  
  const isSelected = (day: number) => {
    if (!selectedDate) return false
    const d = selectedDate instanceof Date ? selectedDate : new Date(selectedDate)
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
  }
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-36 justify-start gap-2">
          <Calendar className="w-4 h-4" />
          <span className="text-xs">{formatDate(selectedDate)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium">{year}년 {month + 1}월</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {['일', '월', '화', '수', '목', '금', '토'].map(d => (
              <div key={d} className={cn(
                "h-7 flex items-center justify-center font-medium",
                d === '일' && "text-destructive",
                d === '토' && "text-primary"
              )}>
                {d}
              </div>
            ))}
            {days.map((day, idx) => (
              <div key={idx}>
                {day ? (
                  <button
                    onClick={() => handleSelect(day)}
                    className={cn(
                      "h-7 w-7 rounded-md text-xs hover:bg-secondary transition-colors",
                      isSelected(day) && "bg-primary text-primary-foreground hover:bg-primary/90",
                      idx % 7 === 0 && !isSelected(day) && "text-destructive",
                      idx % 7 === 6 && !isSelected(day) && "text-primary"
                    )}
                  >
                    {day}
                  </button>
                ) : (
                  <div className="h-7 w-7" />
                )}
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function Header() {
  const { 
    generateMeals, 
    mealPlanMeals, 
    startDate: storedStartDate, 
    endDate: storedEndDate,
    setStartDate,
    setEndDate,
    selectedMealPlan
  } = useMealboxStore()
  
  // Ensure dates are Date objects
  const startDate = storedStartDate instanceof Date ? storedStartDate : storedStartDate ? new Date(storedStartDate) : null
  const endDate = storedEndDate instanceof Date ? storedEndDate : storedEndDate ? new Date(storedEndDate) : null
  
  const handleExport = () => {
    if (!selectedMealPlan || !mealPlanMeals[selectedMealPlan]) return
    
    const meals = mealPlanMeals[selectedMealPlan]
    const pricePoint = selectedMealPlan.includes('3.5') ? 3500 : selectedMealPlan.includes('4.5') ? 4500 : 5500
    
    let csv = '날짜,식단명,FF,FF원가,음료,음료원가,디저트1,디저트1원가,디저트2,디저트2원가,총원가\n'
    
    meals.forEach(meal => {
      const comp = meal.compositions[pricePoint]
      if (comp) {
        const row = [
          meal.date,
          selectedMealPlan,
          comp.ff?.name || '',
          comp.ff?.cost || '',
          comp.drink?.name || '',
          comp.drink?.cost || '',
          comp.desserts[0]?.name || '',
          comp.desserts[0]?.cost || '',
          comp.desserts[1]?.name || '',
          comp.desserts[1]?.cost || '',
          comp.totalCost
        ].join(',')
        csv += row + '\n'
      }
    })
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `밀박스25_${selectedMealPlan}_식단.csv`
    link.click()
  }
  
  const canGenerate = startDate && endDate && startDate <= endDate
  const hasMeals = Object.keys(mealPlanMeals).length > 0
  
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">밀박스25</h1>
              <p className="text-xs text-muted-foreground">자동 큐레이션 툴</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExport}
              disabled={!hasMeals || !selectedMealPlan}
            >
              <Download className="w-4 h-4 mr-2" />
              CSV 내보내기
            </Button>
            <Button onClick={generateMeals} size="sm" disabled={!canGenerate}>
              <RefreshCw className="w-4 h-4 mr-2" />
              식단 자동 생성
            </Button>
          </div>
        </div>
        
        {/* 날짜 범위 선택 */}
        <div className="mt-4 flex items-center gap-4 p-3 rounded-lg bg-secondary/30 border border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">시작일</span>
            <DatePicker 
              selectedDate={startDate} 
              onSelect={setStartDate}
              label="식단 시작일 선택"
            />
          </div>
          <span className="text-muted-foreground">~</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">종료일</span>
            <DatePicker 
              selectedDate={endDate} 
              onSelect={setEndDate}
              label="식단 종료일 선택"
            />
          </div>
          {startDate && endDate && startDate <= endDate && (
            <span className="text-xs text-muted-foreground ml-2">
              (총 {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1}일)
            </span>
          )}
          {startDate && endDate && startDate > endDate && (
            <span className="text-xs text-destructive ml-2">
              종료일은 시작일 이후여야 합니다
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
