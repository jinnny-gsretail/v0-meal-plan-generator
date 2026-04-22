import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { 
  Product, 
  DailyMeal, 
  MealComposition, 
  MealPlanName,
  ALL_MEAL_PLANS,
  DRINK_GROUP_BY_DAY,
  DESSERT1_GROUP_BY_DAY,
  DESSERT2_GROUPS_BY_DAY
} from './types'

// 식단별 일일 구성 (11개 식단 각각)
export interface MealPlanDailyMeals {
  [mealPlanName: string]: DailyMeal[] // 예: { '김밥3.5': [...], '삼각4.5': [...] }
}

interface MealboxStore {
  products: Product[]
  dailyMeals: DailyMeal[] // 기존 호환용
  mealPlanMeals: MealPlanDailyMeals // 식단별 일일 구성
  targetCosts: { [price: number]: number }
  selectedMonth: Date
  selectedMealPlan: MealPlanName | null
  startDate: Date | null
  endDate: Date | null
  
  // Product actions
  addProduct: (product: Omit<Product, 'id'>) => void
  addProducts: (products: Omit<Product, 'id'>[]) => void
  setProducts: (products: Omit<Product, 'id'>[]) => void
  updateProduct: (id: string, product: Partial<Product>) => void
  deleteProduct: (id: string) => void
  clearProducts: (category?: 'ff' | 'drink' | 'dessert') => void
  
  // Target cost actions
  setTargetCost: (price: number, cost: number) => void
  
  // Meal actions
  setSelectedMonth: (date: Date) => void
  setSelectedMealPlan: (mealPlan: MealPlanName | null) => void
  setStartDate: (date: Date | null) => void
  setEndDate: (date: Date | null) => void
  generateMeals: () => void
  updateMealComposition: (date: string, pricePoint: number, composition: MealComposition | null) => void
}

const generateId = () => Math.random().toString(36).substring(2, 9)

export const useMealboxStore = create<MealboxStore>()(
  persist(
    (set, get) => ({
      products: [],
      dailyMeals: [],
      mealPlanMeals: {},
      targetCosts: {
        3500: 1800,
        4500: 2300,
        5500: 2800,
        6500: 3300,
      },
      selectedMonth: new Date(),
      selectedMealPlan: null,
      startDate: null,
      endDate: null,
      
      // Helper to ensure selectedMonth is always a Date object
      _getSelectedMonth: () => {
        const month = get().selectedMonth
        return month instanceof Date ? month : new Date(month)
      },
      
      addProduct: (product) => set((state) => ({
        products: [...state.products, { ...product, id: generateId() }]
      })),
      
      addProducts: (products) => set((state) => ({
        products: [...state.products, ...products.map(p => ({ ...p, id: generateId() }))]
      })),
      
      setProducts: (products) => set({
        products: products.map(p => ({ ...p, id: generateId() }))
      }),
      
      updateProduct: (id, updates) => set((state) => ({
        products: state.products.map(p => p.id === id ? { ...p, ...updates } : p)
      })),
      
      deleteProduct: (id) => set((state) => ({
        products: state.products.filter(p => p.id !== id)
      })),
      
      clearProducts: (category) => set((state) => ({
        products: category 
          ? state.products.filter(p => p.category !== category)
          : []
      })),
      
      setTargetCost: (price, cost) => set((state) => ({
        targetCosts: { ...state.targetCosts, [price]: cost }
      })),
      
      setSelectedMonth: (date) => set({ selectedMonth: date }),
      
      setSelectedMealPlan: (mealPlan) => set({ selectedMealPlan: mealPlan }),
      
      setStartDate: (date) => set({ startDate: date }),
      
      setEndDate: (date) => set({ endDate: date }),
      
      generateMeals: () => {
        const { products, targetCosts, startDate: storedStartDate, endDate: storedEndDate } = get()
        
        const drinkProducts = products.filter(p => p.category === 'drink')
        const dessertProducts = products.filter(p => p.category === 'dessert')
        
        // Ensure dates are Date objects
        const startDate = storedStartDate instanceof Date ? storedStartDate : storedStartDate ? new Date(storedStartDate) : new Date()
        const endDate = storedEndDate instanceof Date ? storedEndDate : storedEndDate ? new Date(storedEndDate) : new Date()
        
        // 시작일부터 종료일까지의 모든 날짜 생성
        const dates: Date[] = []
        const currentDate = new Date(startDate)
        while (currentDate <= endDate) {
          dates.push(new Date(currentDate))
          currentDate.setDate(currentDate.getDate() + 1)
        }
        
        if (dates.length === 0) return
        
        const mealPlanMeals: MealPlanDailyMeals = {}
        
        // 먼저 김밥3 식단을 생성 (기준이 되는 식단)
        // 김밥4 = 김밥3 + 디저트1
        // 김밥5 = 김밥4 + 디저트1 (= 김밥3 + 디저트1 + 디저트2)
        // 샌드3,4,5 = 김밥3,4,5와 동일한 구성품
        
        // 김밥/샌드 식단 생성 (김밥 기준으로 생성 후 샌드에 복사)
        for (const ffTypeName of ['김밥', '샌드'] as const) {
          const ffType = ffTypeName === '김밥' ? '김밥' : '샌드'
          const ffProducts = products.filter(p => p.category === 'ff' && p.ffType === ffType)
          
          if (ffProducts.length === 0) continue
          
          // 김밥3 먼저 생성
          const meals3: DailyMeal[] = []
          const meals4: DailyMeal[] = []
          const meals5: DailyMeal[] = []
          
          const usedDrinkIds = new Set<string>()
          const usedDessert1Ids = new Set<string>()
          const usedDessert2Ids = new Set<string>()
          
          for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
            const currentDate = dates[dayIndex]
            const year = currentDate.getFullYear()
            const month = currentDate.getMonth()
            const day = currentDate.getDate()
            const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayOfWeek = currentDate.getDay()
            
            // FF: 업로드 리스트 순서 반복
            const ffIndex = dayIndex % ffProducts.length
            const ff = ffProducts[ffIndex]
            
            // 김밥 식단: 평균원가가 목표원가 + 50원이 되도록 설정
            // 목표원가 + 50원을 기준으로 그 근처의 상품을 선택
            const targetAvg3 = targetCosts[3500] + 50
            const targetAvg4 = targetCosts[4500] + 50
            const targetAvg5 = targetCosts[5500] + 50
            
            // 김밥3: FF + 음료
            // 목표 음료 원가 = 목표 평균원가 - FF 원가
            const targetDrinkCost = targetAvg3 - ff.cost
            const usedTodayIds = new Set<string>()
            
            // 음료 선택 - 목표 원가에 가까운 음료 선택 (비싼 것 우선)
            const drinkGroup = DRINK_GROUP_BY_DAY[dayOfWeek]
            let availableDrinks = drinkProducts.filter(d => 
              d.group === drinkGroup && 
              !usedTodayIds.has(d.id)
            )
            
            // 목표 원가에 가까운 순으로 정렬 (목표보다 비싼 것 우선, 그 다음 목표에 가까운 것)
            availableDrinks.sort((a, b) => {
              const diffA = a.cost - targetDrinkCost
              const diffB = b.cost - targetDrinkCost
              // 목표 이상인 것을 우선, 그 다음 목표에 가까운 것
              if (diffA >= 0 && diffB < 0) return -1
              if (diffA < 0 && diffB >= 0) return 1
              return Math.abs(diffA) - Math.abs(diffB)
            })
            
            let unusedDrinks = availableDrinks.filter(d => !usedDrinkIds.has(d.id))
            if (unusedDrinks.length === 0) {
              usedDrinkIds.clear()
              unusedDrinks = availableDrinks
            }
            
            // 상위 3개 중 랜덤 선택 (목표에 가까운 것들)
            const drink = unusedDrinks.length > 0 
              ? unusedDrinks[Math.floor(Math.random() * Math.min(3, unusedDrinks.length))]
              : availableDrinks[0]
            
            if (drink) {
              usedDrinkIds.add(drink.id)
              usedTodayIds.add(drink.id)
            }
            
            // 김밥3 저장
            const totalCost3 = ff.cost + (drink?.cost || 0)
            meals3.push({
              date,
              compositions: { 
                3500: { ff, drink, desserts: [], totalCost: totalCost3 }
              }
            })
            
            // 김밥4: 김밥3 + 디저트1
            // 목표 디저트1 원가 = 김밥4 목표 평균원가 - 김밥3 원가
            const targetDessert1Cost = targetAvg4 - totalCost3
            
            const dessert1Group = DESSERT1_GROUP_BY_DAY[dayOfWeek]
            let availableDesserts1 = dessertProducts.filter(d => 
              d.group === dessert1Group && 
              !usedTodayIds.has(d.id)
            )
            
            // 목표 원가에 가까운 순으로 정렬 (목표보다 비싼 것 우선)
            availableDesserts1.sort((a, b) => {
              const diffA = a.cost - targetDessert1Cost
              const diffB = b.cost - targetDessert1Cost
              if (diffA >= 0 && diffB < 0) return -1
              if (diffA < 0 && diffB >= 0) return 1
              return Math.abs(diffA) - Math.abs(diffB)
            })
            
            let unusedDesserts1 = availableDesserts1.filter(d => !usedDessert1Ids.has(d.id))
            if (unusedDesserts1.length === 0) {
              usedDessert1Ids.clear()
              unusedDesserts1 = availableDesserts1
            }
            
            const dessert1 = unusedDesserts1.length > 0
              ? unusedDesserts1[Math.floor(Math.random() * Math.min(3, unusedDesserts1.length))]
              : availableDesserts1[0]
            
            if (dessert1) {
              usedDessert1Ids.add(dessert1.id)
              usedTodayIds.add(dessert1.id)
            }
            
            // 김밥4 저장
            const desserts4 = dessert1 ? [dessert1] : []
            const totalCost4 = ff.cost + (drink?.cost || 0) + desserts4.reduce((sum, d) => sum + d.cost, 0)
            meals4.push({
              date,
              compositions: { 
                4500: { ff, drink, desserts: desserts4, totalCost: totalCost4 }
              }
            })
            
            // 김밥5: 김밥4 + 디저트2
            // 목표 디저트2 원가 = 김밥5 목표 평균원가 - 김밥4 원가
            const targetDessert2Cost = targetAvg5 - totalCost4
            
            const dessert2Groups = DESSERT2_GROUPS_BY_DAY[dayOfWeek]
            let availableDesserts2: Product[] = []
            
            // 모든 가능한 그룹에서 디저트 수집
            for (const group of dessert2Groups) {
              const groupDesserts = dessertProducts.filter(d => 
                d.group === group && 
                !usedTodayIds.has(d.id)
              )
              availableDesserts2.push(...groupDesserts)
            }
            
            // 목표 원가에 가까운 순으로 정렬 (목표보다 비싼 것 우선)
            availableDesserts2.sort((a, b) => {
              const diffA = a.cost - targetDessert2Cost
              const diffB = b.cost - targetDessert2Cost
              if (diffA >= 0 && diffB < 0) return -1
              if (diffA < 0 && diffB >= 0) return 1
              return Math.abs(diffA) - Math.abs(diffB)
            })
            
            let unusedDesserts2 = availableDesserts2.filter(d => !usedDessert2Ids.has(d.id))
            if (unusedDesserts2.length === 0) {
              usedDessert2Ids.clear()
              unusedDesserts2 = availableDesserts2
            }
            
            const dessert2 = unusedDesserts2.length > 0
              ? unusedDesserts2[Math.floor(Math.random() * Math.min(3, unusedDesserts2.length))]
              : availableDesserts2[0]
            
            // 김밥5 저장
            const desserts5 = [...desserts4]
            if (dessert2) {
              desserts5.push(dessert2)
              usedDessert2Ids.add(dessert2.id)
            }
            const totalCost5 = ff.cost + (drink?.cost || 0) + desserts5.reduce((sum, d) => sum + d.cost, 0)
            meals5.push({
              date,
              compositions: { 
                5500: { ff, drink, desserts: desserts5, totalCost: totalCost5 }
              }
            })
          }
          
          if (ffTypeName === '김밥') {
            mealPlanMeals['김밥3.5'] = meals3
            mealPlanMeals['김밥4.5'] = meals4
            mealPlanMeals['김밥5.5'] = meals5
          } else {
            // 샌드: 김밥과 동일한 구성품 (음료, 디저트)을 사용하되 FF만 샌드로
            mealPlanMeals['샌드3.5'] = meals3.map((meal, idx) => {
              const sandFF = ffProducts[idx % ffProducts.length]
              const comp = meal.compositions[3500]
              return {
                date: meal.date,
                compositions: {
                  3500: {
                    ff: sandFF,
                    drink: comp?.drink,
                    desserts: [],
                    totalCost: sandFF.cost + (comp?.drink?.cost || 0)
                  }
                }
              }
            })
            mealPlanMeals['샌드4.5'] = meals4.map((meal, idx) => {
              const sandFF = ffProducts[idx % ffProducts.length]
              const comp = meal.compositions[4500]
              return {
                date: meal.date,
                compositions: {
                  4500: {
                    ff: sandFF,
                    drink: comp?.drink,
                    desserts: comp?.desserts || [],
                    totalCost: sandFF.cost + (comp?.drink?.cost || 0) + (comp?.desserts?.reduce((sum, d) => sum + d.cost, 0) || 0)
                  }
                }
              }
            })
            mealPlanMeals['샌드5.5'] = meals5.map((meal, idx) => {
              const sandFF = ffProducts[idx % ffProducts.length]
              const comp = meal.compositions[5500]
              return {
                date: meal.date,
                compositions: {
                  5500: {
                    ff: sandFF,
                    drink: comp?.drink,
                    desserts: comp?.desserts || [],
                    totalCost: sandFF.cost + (comp?.drink?.cost || 0) + (comp?.desserts?.reduce((sum, d) => sum + d.cost, 0) || 0)
                  }
                }
              }
            })
          }
        }
        
        // 삼각(주먹밥) 식단 생성
        // 삼각3: FF + 음료(김밥3과 동일) + 디저트1
        // 삼각4: 삼각3 + 김밥5의 디저트2 (총 4개 구성)
        const samgakProducts = products.filter(p => p.category === 'ff' && p.ffType === '주먹밥')
        const gimbap3Meals = mealPlanMeals['김밥3.5']
        const gimbap5Meals = mealPlanMeals['김밥5.5']
        
        if (samgakProducts.length > 0 && gimbap3Meals && gimbap5Meals) {
          const meals3: DailyMeal[] = []
          const meals4: DailyMeal[] = []
          
          const usedDessert1Ids = new Set<string>()
          
          for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
            const currentDate = dates[dayIndex]
            const year = currentDate.getFullYear()
            const month = currentDate.getMonth()
            const day = currentDate.getDate()
            const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayOfWeek = currentDate.getDay()
            
            const ffIndex = dayIndex % samgakProducts.length
            const ff = samgakProducts[ffIndex]
            
            // 삼각3의 음료는 김밥3의 음료와 동일
            const gimbap3Comp = gimbap3Meals[dayIndex]?.compositions[3500]
            const drink = gimbap3Comp?.drink
            
            // 김밥5의 디저트2 가져오기 (삼각4에서 사용)
            const gimbap5Comp = gimbap5Meals[dayIndex]?.compositions[5500]
            const gimbap5Dessert2 = gimbap5Comp?.desserts?.[1] // 디저트2는 두번째
            
            const usedTodayIds = new Set<string>()
            if (drink) usedTodayIds.add(drink.id)
            
            // 디저트1 선택 (삼각3용)
            const targetCost3 = targetCosts[3500] * 1.03
            let remainingBudget3 = targetCost3 - ff.cost - (drink?.cost || 0)
            
            const dessert1Group = DESSERT1_GROUP_BY_DAY[dayOfWeek]
            let availableDesserts1 = dessertProducts.filter(d => 
              d.group === dessert1Group && 
              !usedTodayIds.has(d.id) &&
              d.cost <= remainingBudget3
            )
            
            if (availableDesserts1.length === 0) {
              availableDesserts1 = dessertProducts
                .filter(d => d.group === dessert1Group && !usedTodayIds.has(d.id))
                .sort((a, b) => a.cost - b.cost)
                .slice(0, 3)
            }
            
            let unusedDesserts1 = availableDesserts1.filter(d => !usedDessert1Ids.has(d.id))
            if (unusedDesserts1.length === 0) {
              usedDessert1Ids.clear()
              unusedDesserts1 = availableDesserts1
            }
            
            const dessert1 = unusedDesserts1[Math.floor(Math.random() * Math.min(3, unusedDesserts1.length))] || availableDesserts1[0]
            if (dessert1) {
              usedDessert1Ids.add(dessert1.id)
              usedTodayIds.add(dessert1.id)
            }
            
            // 삼각3 저장: FF + 음료 + 디저트1
            const desserts3 = dessert1 ? [dessert1] : []
            const totalCost3 = ff.cost + (drink?.cost || 0) + desserts3.reduce((sum, d) => sum + d.cost, 0)
            meals3.push({
              date,
              compositions: { 
                3500: { ff, drink, desserts: desserts3, totalCost: totalCost3 }
              }
            })
            
            // 삼각4: 삼각3 + 김밥5의 디저트2 (총 4개 구성: FF + 음료 + 디저트1 + 디저트2)
            const desserts4 = [...desserts3]
            if (gimbap5Dessert2) {
              desserts4.push(gimbap5Dessert2)
            }
            const totalCost4 = ff.cost + (drink?.cost || 0) + desserts4.reduce((sum, d) => sum + d.cost, 0)
            meals4.push({
              date,
              compositions: { 
                4500: { ff, drink, desserts: desserts4, totalCost: totalCost4 }
              }
            })
          }
          
          mealPlanMeals['삼각3.5'] = meals3
          mealPlanMeals['삼각4.5'] = meals4
        }
        
        // 버거 식단 생성: 버거3 = FF + 음료(탄산만), 버거4 = 버거3 + 디저트1, 버거5 = 버거4 + 디저트2
        const burgerProducts = products.filter(p => p.category === 'ff' && p.ffType === '버거')
        if (burgerProducts.length > 0) {
          const meals3: DailyMeal[] = []
          const meals4: DailyMeal[] = []
          const meals5: DailyMeal[] = []
          
          const usedDrinkIds = new Set<string>()
          const usedDessert1Ids = new Set<string>()
          const usedDessert2Ids = new Set<string>()
          
          for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
            const currentDate = dates[dayIndex]
            const year = currentDate.getFullYear()
            const month = currentDate.getMonth()
            const day = currentDate.getDate()
            const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayOfWeek = currentDate.getDay()
            
            const ffIndex = dayIndex % burgerProducts.length
            const ff = burgerProducts[ffIndex]
            
            const targetCost3 = targetCosts[3500] * 1.03
            const targetCost4 = targetCosts[4500] * 1.03
            const targetCost5 = targetCosts[5500] * 1.03
            
            let remainingBudget3 = targetCost3 - ff.cost
            const usedTodayIds = new Set<string>()
            
            // 버거는 탄산 음료만
            let availableDrinks = drinkProducts.filter(d => 
              d.group === '탄산' && 
              d.cost <= remainingBudget3
            )
            
            if (availableDrinks.length === 0) {
              availableDrinks = drinkProducts
                .filter(d => d.group === '탄산')
                .sort((a, b) => a.cost - b.cost)
                .slice(0, 3)
            }
            
            let unusedDrinks = availableDrinks.filter(d => !usedDrinkIds.has(d.id))
            if (unusedDrinks.length === 0) {
              usedDrinkIds.clear()
              unusedDrinks = availableDrinks
            }
            
            const drink = unusedDrinks[Math.floor(Math.random() * Math.min(3, unusedDrinks.length))] || availableDrinks[0]
            if (drink) {
              usedDrinkIds.add(drink.id)
              usedTodayIds.add(drink.id)
            }
            
            // 버거3 저장
            const totalCost3 = ff.cost + (drink?.cost || 0)
            meals3.push({
              date,
              compositions: { 
                3500: { ff, drink, desserts: [], totalCost: totalCost3 }
              }
            })
            
            // 버거4: 버거3 + 디저트1
            let remainingBudget4 = targetCost4 - totalCost3
            
            const dessert1Group = DESSERT1_GROUP_BY_DAY[dayOfWeek]
            let availableDesserts1 = dessertProducts.filter(d => 
              d.group === dessert1Group && 
              !usedTodayIds.has(d.id) &&
              d.cost <= remainingBudget4
            )
            
            if (availableDesserts1.length === 0) {
              availableDesserts1 = dessertProducts
                .filter(d => d.group === dessert1Group && !usedTodayIds.has(d.id))
                .sort((a, b) => a.cost - b.cost)
                .slice(0, 3)
            }
            
            let unusedDesserts1 = availableDesserts1.filter(d => !usedDessert1Ids.has(d.id))
            if (unusedDesserts1.length === 0) {
              usedDessert1Ids.clear()
              unusedDesserts1 = availableDesserts1
            }
            
            const dessert1 = unusedDesserts1[Math.floor(Math.random() * Math.min(3, unusedDesserts1.length))] || availableDesserts1[0]
            if (dessert1) {
              usedDessert1Ids.add(dessert1.id)
              usedTodayIds.add(dessert1.id)
            }
            
            // 버거4 저장
            const desserts4 = dessert1 ? [dessert1] : []
            const totalCost4 = ff.cost + (drink?.cost || 0) + desserts4.reduce((sum, d) => sum + d.cost, 0)
            meals4.push({
              date,
              compositions: { 
                4500: { ff, drink, desserts: desserts4, totalCost: totalCost4 }
              }
            })
            
            // 버거5: 버거4 + 디저트2
            let remainingBudget5 = targetCost5 - totalCost4
            
            const dessert2Groups = DESSERT2_GROUPS_BY_DAY[dayOfWeek]
            let availableDesserts2: Product[] = []
            
            for (const group of dessert2Groups) {
              const groupDesserts = dessertProducts.filter(d => 
                d.group === group && 
                !usedTodayIds.has(d.id) &&
                d.cost <= remainingBudget5
              )
              if (groupDesserts.length > 0) {
                availableDesserts2 = groupDesserts
                break
              }
            }
            
            if (availableDesserts2.length === 0) {
              for (const group of dessert2Groups) {
                const groupDesserts = dessertProducts
                  .filter(d => d.group === group && !usedTodayIds.has(d.id))
                  .sort((a, b) => a.cost - b.cost)
                if (groupDesserts.length > 0) {
                  availableDesserts2 = groupDesserts.slice(0, 3)
                  break
                }
              }
            }
            
            let unusedDesserts2 = availableDesserts2.filter(d => !usedDessert2Ids.has(d.id))
            if (unusedDesserts2.length === 0) {
              usedDessert2Ids.clear()
              unusedDesserts2 = availableDesserts2
            }
            
            const dessert2 = unusedDesserts2[Math.floor(Math.random() * Math.min(3, unusedDesserts2.length))] || availableDesserts2[0]
            
            // 버거5 저장
            const desserts5 = [...desserts4]
            if (dessert2) {
              desserts5.push(dessert2)
              usedDessert2Ids.add(dessert2.id)
            }
            const totalCost5 = ff.cost + (drink?.cost || 0) + desserts5.reduce((sum, d) => sum + d.cost, 0)
            meals5.push({
              date,
              compositions: { 
                5500: { ff, drink, desserts: desserts5, totalCost: totalCost5 }
              }
            })
          }
          
          mealPlanMeals['버거3.5'] = meals3
          mealPlanMeals['버거4.5'] = meals4
          mealPlanMeals['버거5.5'] = meals5
        }
        
        set({ mealPlanMeals })
      },
      
      updateMealComposition: (date, pricePoint, composition) => set((state) => ({
        dailyMeals: state.dailyMeals.map(meal => 
          meal.date === date 
            ? { ...meal, compositions: { ...meal.compositions, [pricePoint]: composition } }
            : meal
        )
      })),
    }),
    {
      name: 'mealbox-storage',
    }
  )
)
