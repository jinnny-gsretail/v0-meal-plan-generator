'use client'

import { useMealboxStore } from '@/lib/store'
import { ALL_MEAL_PLANS, MealPlanName } from '@/lib/types'
import { cn } from '@/lib/utils'

export function MealPlanSelector() {
  const { selectedMealPlan, setSelectedMealPlan } = useMealboxStore()

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">식단 선택</h3>
        <span className="text-xs text-muted-foreground">
          {selectedMealPlan ? `현재: ${selectedMealPlan}` : '식단을 선택하세요'}
        </span>
      </div>
      
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2">
        {ALL_MEAL_PLANS.map((plan) => {
          // FF 타입별 색상 지정
          const isFreeFormat = plan.name === '프리포맷'
          const colorClass = isFreeFormat
            ? 'hover:border-violet-500/50 data-[selected=true]:bg-violet-600 data-[selected=true]:border-violet-600'
            : plan.ffType === '김밥' 
            ? 'hover:border-green-500/50 data-[selected=true]:bg-green-600 data-[selected=true]:border-green-600'
            : plan.ffType === '주먹밥'
            ? 'hover:border-amber-500/50 data-[selected=true]:bg-amber-600 data-[selected=true]:border-amber-600'
            : plan.ffType === '샌드'
            ? 'hover:border-blue-500/50 data-[selected=true]:bg-blue-600 data-[selected=true]:border-blue-600'
            : 'hover:border-red-500/50 data-[selected=true]:bg-red-600 data-[selected=true]:border-red-600'
          
          return (
            <button
              key={plan.name}
              data-selected={selectedMealPlan === plan.name}
              onClick={() => setSelectedMealPlan(
                selectedMealPlan === plan.name ? null : plan.name
              )}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-md transition-all",
                "border border-border",
                "bg-secondary/30 text-foreground hover:bg-secondary/50",
                "data-[selected=true]:text-white",
                colorClass
              )}
            >
              {plan.name}
            </button>
          )
        })}
      </div>
      
      {selectedMealPlan && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              FF 타입: <span className="text-primary font-medium">
                {ALL_MEAL_PLANS.find(p => p.name === selectedMealPlan)?.ffType}
              </span>
            </span>
            <span>
              판매가: <span className="text-primary font-medium">
                {ALL_MEAL_PLANS.find(p => p.name === selectedMealPlan)?.price.toLocaleString()}원
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
