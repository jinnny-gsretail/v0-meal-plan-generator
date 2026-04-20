'use client'

import { useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMealboxStore } from '@/lib/store'
import { cn } from '@/lib/utils'

function DatePickerDropdown({ 
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
  const [isOpen, setIsOpen] = useState(false)
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
  
  const formatDate = (date: Date | null) => {
    if (!date) return label
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  }
  
  const handleSelect = (day: number) => {
    onSelect(new Date(year, month, day))
    setIsOpen(false)
  }
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm bg-secondary/50 border border-border rounded-md hover:bg-secondary transition-colors min-w-[140px] justify-between"
      >
        <span className={selectedDate ? 'text-foreground font-medium' : 'text-muted-foreground'}>
          {formatDate(selectedDate)}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full mt-2 right-0 z-50 p-4 rounded-lg border border-border bg-card shadow-xl min-w-[280px]">
            <div className="flex items-center justify-between mb-3">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-base font-semibold">{year}년 {month + 1}월</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                <div key={d} className={cn(
                  "h-8 w-8 flex items-center justify-center text-sm font-medium",
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
                      onClick={() => !isDisabled(day) && handleSelect(day)}
                      disabled={isDisabled(day)}
                      className={cn(
                        "h-8 w-8 rounded-md text-sm font-medium hover:bg-secondary transition-colors",
                        isSelected(day) && "bg-primary text-primary-foreground hover:bg-primary/90",
                        isDisabled(day) && "opacity-30 cursor-not-allowed",
                        idx % 7 === 0 && !isSelected(day) && "text-destructive",
                        idx % 7 === 6 && !isSelected(day) && "text-primary"
                      )}
                    >
                      {day}
                    </button>
                  ) : (
                    <div className="h-8 w-8" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
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
  
  const dayCount = startDate && endDate && startDate <= endDate
    ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0
  
  return (
    <div className="flex-1 flex items-center justify-end gap-4 px-6 py-3 rounded-lg bg-card border border-border">
      <div className="flex items-center gap-2 text-base text-muted-foreground">
        <Calendar className="w-5 h-5" />
        <span className="font-medium">식단 기간</span>
      </div>
      
      <DatePickerDropdown 
        selectedDate={startDate}
        onSelect={setStartDate}
        label="시작일"
        maxDate={endDate}
      />
      
      <span className="text-lg text-muted-foreground">~</span>
      
      <DatePickerDropdown 
        selectedDate={endDate}
        onSelect={setEndDate}
        label="종료일"
        minDate={startDate}
      />
      
      {dayCount > 0 && (
        <span className="text-sm text-primary font-semibold px-3 py-1 bg-primary/10 rounded-md">
          총 {dayCount}일
        </span>
      )}
      
      {startDate && endDate && startDate > endDate && (
        <span className="text-sm text-destructive font-medium">
          날짜 오류
        </span>
      )}
    </div>
  )
}
