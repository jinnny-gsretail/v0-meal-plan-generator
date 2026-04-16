'use client'

import { Sparkles, RefreshCw, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMealboxStore } from '@/lib/store'

export function Header() {
  const { generateMeals, dailyMeals, selectedMonth } = useMealboxStore()
  
  const handleExport = () => {
    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth() + 1
    
    let csv = '날짜,가격대,FF,FF원가,음료,음료원가,디저트1,디저트1원가,디저트2,디저트2원가,총원가\n'
    
    dailyMeals.forEach(meal => {
      const date = meal.date
      Object.entries(meal.compositions).forEach(([price, comp]) => {
        if (comp) {
          const row = [
            date,
            price,
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
    })
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `밀박스25_식단_${year}년${month}월.csv`
    link.click()
  }
  
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
              disabled={dailyMeals.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              CSV 내보내기
            </Button>
            <Button onClick={generateMeals} size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              식단 자동 생성
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
