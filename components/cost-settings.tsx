'use client'

import { Input } from '@/components/ui/input'
import { useMealboxStore } from '@/lib/store'
import { MEAL_PLAN_COST_CONFIGS } from '@/lib/types'

export function CostSettings() {
  const { mealPlanTargetCosts, setMealPlanTargetCost } = useMealboxStore()
  
  // 식단을 그룹별로 분류
  const gimbapConfigs = MEAL_PLAN_COST_CONFIGS.filter(c => c.ffType === '김밥')
  const samgakConfigs = MEAL_PLAN_COST_CONFIGS.filter(c => c.ffType === '주먹밥')
  const burgerConfigs = MEAL_PLAN_COST_CONFIGS.filter(c => c.ffType === '버거')
  const dosirakConfigs = MEAL_PLAN_COST_CONFIGS.filter(c => c.ffType === '도시락')
  const factoryBoxConfigs = MEAL_PLAN_COST_CONFIGS.filter(c => c.mealPlanName === '공장박스')

  const renderCostGroup = (title: string, configs: typeof MEAL_PLAN_COST_CONFIGS, note?: string) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
        {note && <span className="text-xs text-muted-foreground">({note})</span>}
      </div>
      <div className="grid gap-2">
        {configs.map(config => (
          <div 
            key={config.mealPlanName} 
            className="flex items-center justify-between p-3 bg-secondary/30 rounded-md"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {config.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {config.description}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">목표 원가</span>
              <Input
                type="number"
                value={mealPlanTargetCosts[config.mealPlanName] || config.defaultCost}
                onChange={(e) => setMealPlanTargetCost(config.mealPlanName, parseInt(e.target.value) || 0)}
                className="h-8 w-24 text-right bg-background"
              />
              <span className="text-xs text-muted-foreground">원</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-semibold text-foreground mb-4">식단별 목표 원가 설정</h3>
      
      <div className="grid gap-6">
        {renderCostGroup('김밥 식단', gimbapConfigs, '샌드 식단은 김밥과 동일 구성')}
        {renderCostGroup('삼각 식단', samgakConfigs)}
        {renderCostGroup('버거 식단', burgerConfigs)}
        {renderCostGroup('도시락 식단', dosirakConfigs)}
        {renderCostGroup('공장박스', factoryBoxConfigs, '고정 원가 기준 · 월:샌드단품 / 화~일:삼각김밥+음료')}
      </div>
      
      <p className="text-xs text-muted-foreground mt-4">
        각 식단의 평균 원가가 목표 원가의 99%~101% 범위 내에서 자동 구성됩니다.
      </p>
    </div>
  )
}
