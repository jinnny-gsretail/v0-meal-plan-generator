'use client'

import { useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMealboxStore } from '@/lib/store'
import { cn } from '@/lib/utils'

function MiniCalendar({ 
  selectedDate, 
  onSelect, 
  label,
  minDate,
  maxDate
}: { 
  selectedDate: Date | null
  onSelect: (date: Date) => void
  label: string
  minDate?: Date | null
  maxDate?: Date | null
}) {
  const [viewDate, setViewDate] = useState(selectedDate || new Date())
  
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  
  const days: (number | null)[] = []
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
  
  const isSelected = (day: number) => {
    if (!selectedDate) return false
    const d = selectedDate instanceof Date ? selectedDate : new Date(selectedDate)
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
  }
  
  const isDisabled = (day: number) => {
    const date = new Date(year, month, day)
    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true
    return false
  }
  
  return (
    <div className="p-3 rounded-lg border border-border bg-card">
      <div className="text-xs text-muted-foreground mb-2">{label}</div>
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={prevMonth}>
          <ChevronLeft className="w-3 h-3" />
        </Button>
        <span className="text-xs font-medium">{year}년 {month + 1}월</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={nextMonth}>
          <ChevronRight className="w-3 h-3" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['일', '월', '화', '수', '목', '금', '토'].map(d => (
          <div key={d} className={cn(
            "h-6 flex items-center justify-center text-[10px] font-medium",
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
                onClick={() => !isDisabled(day) && onSelect(new Date(year, month, day))}
                disabled={isDisabled(day)}
                className={cn(
                  "h-6 w-6 rounded text-[10px] hover:bg-secondary transition-colors",
                  isSelected(day) && "bg-primary text-primary-foreground hover:bg-primary/90",
                  isDisabled(day) && "opacity-30 cursor-not-allowed",
                  idx % 7 === 0 && !isSelected(day) && "text-destructive",
                  idx % 7 === 6 && !isSelected(day) && "text-primary"
                )}
              >
                {day}
              </button>
            ) : (
              <div className="h-6 w-6" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DateRangeSelector() {
  const { 
    startDate: storedStartDate, 
    endDate: storedEndDate,
    setStartDate,
    setEndDate
  } = useMealboxStore()
  
  // Ensure dates are Date objects
  const startDate = storedStartDate instanceof Date ? storedStartDate : storedStartDate ? new Date(storedStartDate) : null
  const endDate = storedEndDate instanceof Date ? storedEndDate : storedEndDate ? new Date(storedEndDate) : null
  
  const formatDate = (date: Date | null) => {
    if (!date) return '-'
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  }
  
  const dayCount = startDate && endDate && startDate <= endDate
    ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Calendar className="w-4 h-4" />
        식단 기간 설정
      </div>
      
      {/* 시작일 캘린더 */}
      <MiniCalendar 
        selectedDate={startDate}
        onSelect={setStartDate}
        label="시작일"
        maxDate={endDate}
      />
      
      {/* 종료일 캘린더 */}
      <MiniCalendar 
        selectedDate={endDate}
        onSelect={setEndDate}
        label="종료일"
        minDate={startDate}
      />
      
      {/* 선택된 기간 요약 */}
      <div className="p-3 rounded-lg bg-secondary/30 border border-border">
        <div className="text-xs text-muted-foreground mb-2">선택된 기간</div>
        <div className="text-sm font-medium text-foreground">
          {formatDate(startDate)} ~ {formatDate(endDate)}
        </div>
        {dayCount > 0 && (
          <div className="text-xs text-primary mt-1">
            총 {dayCount}일
          </div>
        )}
        {startDate && endDate && startDate > endDate && (
          <div className="text-xs text-destructive mt-1">
            종료일은 시작일 이후여야 합니다
          </div>
        )}
      </div>
    </div>
  )
}
