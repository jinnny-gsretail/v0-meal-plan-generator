'use client'

import { Input } from '@/components/ui/input'
import { useMealboxStore } from '@/lib/store'
import { PRICE_POINT_CONFIGS } from '@/lib/types'

export function CostSettings() {
  const { targetCosts, setTargetCost } = useMealboxStore()
  
  const getCompositionText = (config: typeof PRICE_POINT_CONFIGS[0]) => {
    const parts = []
    if (config.composition.ff) {
      parts.push(config.composition.ffType === 'dosirak' ? '도시락' : 'FF')
    }
    if (config.composition.drink) parts.push('음료')
    if (config.composition.dessertCount > 0) {
      parts.push(`디저트 ${config.composition.dessertCount}개`)
    }
    return parts.join(' + ')
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-semibold text-foreground mb-4">가격대별 원가 설정</h3>
      
      <div className="grid gap-3">
        {PRICE_POINT_CONFIGS.map(config => (
          <div 
            key={config.price} 
            className="flex items-center justify-between p-3 bg-secondary/30 rounded-md"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {config.price.toLocaleString()}원
              </span>
              <span className="text-xs text-muted-foreground">
                {getCompositionText(config)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">목표 원가</span>
              <Input
                type="number"
                value={targetCosts[config.price]}
                onChange={(e) => setTargetCost(config.price, parseInt(e.target.value) || 0)}
                className="h-8 w-24 text-right bg-background"
              />
              <span className="text-xs text-muted-foreground">원</span>
            </div>
          </div>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground mt-4">
        각 구성품 원가의 합이 목표 원가를 초과하지 않도록 식단이 자동 구성됩니다.
      </p>
    </div>
  )
}
