import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { 
  Product, 
  DailyMeal, 
  MealComposition, 
  MealPlanName,
  DRINK_GROUP_BY_DAY,
  DESSERT1_GROUP_BY_DAY,
  DESSERT2_GROUPS_BY_DAY,
  MEAL_PLAN_COST_CONFIGS
} from './types'

// 식단별 일일 구성
export interface MealPlanDailyMeals {
  [mealPlanName: string]: DailyMeal[]
}

// 식단별 목표원가
export interface MealPlanTargetCosts {
  [mealPlanName: string]: number
}

interface MealboxStore {
  products: Product[]
  dailyMeals: DailyMeal[]
  mealPlanMeals: MealPlanDailyMeals
  targetCosts: { [price: number]: number } // 기존 호환용
  mealPlanTargetCosts: MealPlanTargetCosts // 식단별 목표원가
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
  setMealPlanTargetCost: (mealPlan: string, cost: number) => void
  
  // Meal actions
  setSelectedMonth: (date: Date) => void
  setSelectedMealPlan: (mealPlan: MealPlanName | null) => void
  setStartDate: (date: Date | null) => void
  setEndDate: (date: Date | null) => void
  generateMeals: () => void
  updateMealComposition: (date: string, pricePoint: number, composition: MealComposition | null) => void
}

const generateId = () => Math.random().toString(36).substring(2, 9)

// 기본 목표원가 생성
const getDefaultMealPlanTargetCosts = (): MealPlanTargetCosts => {
  const costs: MealPlanTargetCosts = {}
  MEAL_PLAN_COST_CONFIGS.forEach(config => {
    costs[config.mealPlanName] = config.defaultCost
  })
  return costs
}

export const useMealboxStore = create<MealboxStore>()(
  persist(
    (set, get) => ({
      products: [],
      dailyMeals: [],
      mealPlanMeals: {},
      targetCosts: {
        3500: 1486,
        4500: 1964,
        5500: 2430,
        6500: 3191,
      },
      mealPlanTargetCosts: getDefaultMealPlanTargetCosts(),
      selectedMonth: new Date(),
      selectedMealPlan: null,
      startDate: null,
      endDate: null,
      
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
      
      setMealPlanTargetCost: (mealPlan, cost) => set((state) => ({
        mealPlanTargetCosts: { ...state.mealPlanTargetCosts, [mealPlan]: cost }
      })),
      
      setSelectedMonth: (date) => set({ selectedMonth: date }),
      
      setSelectedMealPlan: (mealPlan) => set({ selectedMealPlan: mealPlan }),
      
      setStartDate: (date) => set({ startDate: date }),
      
      setEndDate: (date) => set({ endDate: date }),
      
      generateMeals: () => {
        const { products, mealPlanTargetCosts, startDate: storedStartDate, endDate: storedEndDate } = get()
        
        const drinkProducts = products.filter(p => p.category === 'drink')
        const dessertProducts = products.filter(p => p.category === 'dessert')
        
        const startDate = storedStartDate instanceof Date ? storedStartDate : storedStartDate ? new Date(storedStartDate) : new Date()
        const endDate = storedEndDate instanceof Date ? storedEndDate : storedEndDate ? new Date(storedEndDate) : new Date()
        
        const dates: Date[] = []
        const currentDate = new Date(startDate)
        while (currentDate <= endDate) {
          dates.push(new Date(currentDate))
          currentDate.setDate(currentDate.getDate() + 1)
        }
        
        if (dates.length === 0) return
        
        const mealPlanMeals: MealPlanDailyMeals = {}
        
        // 목표 원가 가져오기 (99%~101% 범위로 맞추기 위해 정확히 목표 원가 사용)
        const getTargetCost = (mealPlanName: string) => {
          return mealPlanTargetCosts[mealPlanName] || 
            MEAL_PLAN_COST_CONFIGS.find(c => c.mealPlanName === mealPlanName)?.defaultCost || 1500
        }

        // 목표 원가에 정확히 맞는 상품 선택 함수
        const selectProductByTargetCost = (
          availableProducts: Product[],
          targetCost: number,
          usedIds: Set<string>,
          usedTodayIds: Set<string>
        ): Product | undefined => {
          if (availableProducts.length === 0) return undefined
          
          // 오늘 사용 안한 상품 필터
          let candidates = availableProducts.filter(p => !usedTodayIds.has(p.id))
          if (candidates.length === 0) candidates = availableProducts
          
          // 아직 사용 안한 상품 우선
          let unusedCandidates = candidates.filter(p => !usedIds.has(p.id))
          if (unusedCandidates.length === 0) {
            usedIds.clear()
            unusedCandidates = candidates
          }
          
          // 목표 원가에 가장 가까운 상품들 정렬
          unusedCandidates.sort((a, b) => {
            const diffA = Math.abs(a.cost - targetCost)
            const diffB = Math.abs(b.cost - targetCost)
            return diffA - diffB
          })
          
          // 상위 3개 중 랜덤 선택 (다양성 유지)
          const topCandidates = unusedCandidates.slice(0, Math.min(3, unusedCandidates.length))
          return topCandidates[Math.floor(Math.random() * topCandidates.length)]
        }

        // ========== 김밥 식단 생성 ==========
        const gimbapProducts = products.filter(p => p.category === 'ff' && p.ffType === '김밥')
        if (gimbapProducts.length > 0) {
          const meals3: DailyMeal[] = []
          const meals4: DailyMeal[] = []
          const meals5: DailyMeal[] = []
          
          const usedDrinkIds = new Set<string>()
          const usedDessert1Ids = new Set<string>()
          const usedDessert2Ids = new Set<string>()
          
          // 목표 원가
          const target3 = getTargetCost('김밥3.5')
          const target4 = getTargetCost('김밥4.5')
          const target5 = getTargetCost('김밥5.5')
          
          for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
            const currentDate = dates[dayIndex]
            const year = currentDate.getFullYear()
            const month = currentDate.getMonth()
            const day = currentDate.getDate()
            const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayOfWeek = currentDate.getDay()
            
            const ffIndex = dayIndex % gimbapProducts.length
            const ff = gimbapProducts[ffIndex]
            const usedTodayIds = new Set<string>()
            
            // 김밥3: FF + 음료
            // 목표 음료 원가 = 김밥3 목표원가 - FF원가
            const targetDrinkCost3 = target3 - ff.cost
            const drinkGroup = DRINK_GROUP_BY_DAY[dayOfWeek]
            let availableDrinks = drinkProducts.filter(d => d.group === drinkGroup)
            // 해당 그룹 음료가 없으면 전체 음료에서 선택
            if (availableDrinks.length === 0) availableDrinks = drinkProducts
            
            const drink = selectProductByTargetCost(availableDrinks, targetDrinkCost3, usedDrinkIds, usedTodayIds)
            if (drink) {
              usedDrinkIds.add(drink.id)
              usedTodayIds.add(drink.id)
            }
            
            const totalCost3 = ff.cost + (drink?.cost || 0)
            meals3.push({
              date,
              compositions: { 3500: { ff, drink, desserts: [], totalCost: totalCost3 } }
            })
            
            // 김밥4: 김밥3 + 디저트1
            // 목표 디저트1 원가 = 김밥4 목표원가 - 김밥3 원가
            const targetDessert1Cost = target4 - totalCost3
            const dessert1Group = DESSERT1_GROUP_BY_DAY[dayOfWeek]
            let availableDesserts1 = dessertProducts.filter(d => d.group === dessert1Group)
            // 해당 그룹 디저트가 없으면 전체 디저트에서 선택
            if (availableDesserts1.length === 0) availableDesserts1 = dessertProducts
            
            const dessert1 = selectProductByTargetCost(availableDesserts1, targetDessert1Cost, usedDessert1Ids, usedTodayIds)
            if (dessert1) {
              usedDessert1Ids.add(dessert1.id)
              usedTodayIds.add(dessert1.id)
            }
            
            const desserts4 = dessert1 ? [dessert1] : []
            const totalCost4 = totalCost3 + desserts4.reduce((sum, d) => sum + d.cost, 0)
            meals4.push({
              date,
              compositions: { 4500: { ff, drink, desserts: desserts4, totalCost: totalCost4 } }
            })
            
            // 김밥5: 김밥4 + 디저트2
            // 목표 디저트2 원가 = 김밥5 목표원가 - 김밥4 원가
            const targetDessert2Cost = target5 - totalCost4
            const dessert2Groups = DESSERT2_GROUPS_BY_DAY[dayOfWeek]
            let availableDesserts2: Product[] = []
            for (const group of dessert2Groups) {
              availableDesserts2.push(...dessertProducts.filter(d => d.group === group && !usedTodayIds.has(d.id)))
            }
            // 해당 그룹 디저트가 없으면 전체 디저트에서 선택 (오늘 사용 안한 것)
            if (availableDesserts2.length === 0) {
              availableDesserts2 = dessertProducts.filter(d => !usedTodayIds.has(d.id))
            }
            
            const dessert2 = selectProductByTargetCost(availableDesserts2, targetDessert2Cost, usedDessert2Ids, usedTodayIds)
            if (dessert2) {
              usedDessert2Ids.add(dessert2.id)
            }
            
            const desserts5 = [...desserts4]
            if (dessert2) desserts5.push(dessert2)
            const totalCost5 = totalCost3 + desserts5.reduce((sum, d) => sum + d.cost, 0)
            meals5.push({
              date,
              compositions: { 5500: { ff, drink, desserts: desserts5, totalCost: totalCost5 } }
            })
          }
          
          mealPlanMeals['김밥3.5'] = meals3
          mealPlanMeals['김밥4.5'] = meals4
          mealPlanMeals['김밥5.5'] = meals5
        }
        
        // ========== 샌드 식단 생성 (김밥과 동일한 음료/디저트) ==========
        const sandProducts = products.filter(p => p.category === 'ff' && p.ffType === '샌드')
        const gimbap3Meals = mealPlanMeals['김밥3.5']
        const gimbap4Meals = mealPlanMeals['김밥4.5']
        const gimbap5Meals = mealPlanMeals['김밥5.5']
        
        if (sandProducts.length > 0 && gimbap3Meals) {
          mealPlanMeals['샌드3.5'] = gimbap3Meals.map((meal, idx) => {
            const sandFF = sandProducts[idx % sandProducts.length]
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
          
          if (gimbap4Meals) {
            mealPlanMeals['샌드4.5'] = gimbap4Meals.map((meal, idx) => {
              const sandFF = sandProducts[idx % sandProducts.length]
              const comp = meal.compositions[4500]
              const desserts = comp?.desserts || []
              return {
                date: meal.date,
                compositions: {
                  4500: {
                    ff: sandFF,
                    drink: comp?.drink,
                    desserts,
                    totalCost: sandFF.cost + (comp?.drink?.cost || 0) + desserts.reduce((sum, d) => sum + d.cost, 0)
                  }
                }
              }
            })
          }
          
          if (gimbap5Meals) {
            mealPlanMeals['샌드5.5'] = gimbap5Meals.map((meal, idx) => {
              const sandFF = sandProducts[idx % sandProducts.length]
              const comp = meal.compositions[5500]
              const desserts = comp?.desserts || []
              return {
                date: meal.date,
                compositions: {
                  5500: {
                    ff: sandFF,
                    drink: comp?.drink,
                    desserts,
                    totalCost: sandFF.cost + (comp?.drink?.cost || 0) + desserts.reduce((sum, d) => sum + d.cost, 0)
                  }
                }
              }
            })
          }
        }
        
        // ========== 삼각 식단 생성 ==========
        // 삼각3: FF + 음료(김밥3과 동일) + 디저트1
        // 삼각4: 삼각3 + 김밥5의 디저트2
        const samgakProducts = products.filter(p => p.category === 'ff' && p.ffType === '주먹밥')
        
        if (samgakProducts.length > 0 && gimbap3Meals && gimbap5Meals) {
          const meals3: DailyMeal[] = []
          const meals4: DailyMeal[] = []
          
          const usedDessert1Ids = new Set<string>()
          const target3 = getTargetCost('삼각3.5')
          
          for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
            const currentDate = dates[dayIndex]
            const year = currentDate.getFullYear()
            const month = currentDate.getMonth()
            const day = currentDate.getDate()
            const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayOfWeek = currentDate.getDay()
            
            const ffIndex = dayIndex % samgakProducts.length
            const ff = samgakProducts[ffIndex]
            
            // 김밥3의 음료 사용
            const gimbap3Comp = gimbap3Meals[dayIndex]?.compositions[3500]
            const drink = gimbap3Comp?.drink
            
            // 김밥5의 디저트2 가져오기
            const gimbap5Comp = gimbap5Meals[dayIndex]?.compositions[5500]
            const gimbap5Dessert2 = gimbap5Comp?.desserts?.[1]
            
            const usedTodayIds = new Set<string>()
            if (drink) usedTodayIds.add(drink.id)
            
            // 디저트1 선택 (목표 원가에 맞게)
            const targetDessert1Cost = target3 - ff.cost - (drink?.cost || 0)
            const dessert1Group = DESSERT1_GROUP_BY_DAY[dayOfWeek]
            let availableDesserts1Samgak = dessertProducts.filter(d => d.group === dessert1Group)
            if (availableDesserts1Samgak.length === 0) availableDesserts1Samgak = dessertProducts
            
            const dessert1 = selectProductByTargetCost(availableDesserts1Samgak, targetDessert1Cost, usedDessert1Ids, usedTodayIds)
            if (dessert1) {
              usedDessert1Ids.add(dessert1.id)
              usedTodayIds.add(dessert1.id)
            }
            
            const desserts3 = dessert1 ? [dessert1] : []
            const totalCost3 = ff.cost + (drink?.cost || 0) + desserts3.reduce((sum, d) => sum + d.cost, 0)
            meals3.push({
              date,
              compositions: { 3500: { ff, drink, desserts: desserts3, totalCost: totalCost3 } }
            })
            
            // 삼각4: 삼각3 + 김밥5의 디저트2
            const desserts4 = [...desserts3]
            if (gimbap5Dessert2) desserts4.push(gimbap5Dessert2)
            const totalCost4 = ff.cost + (drink?.cost || 0) + desserts4.reduce((sum, d) => sum + d.cost, 0)
            meals4.push({
              date,
              compositions: { 4500: { ff, drink, desserts: desserts4, totalCost: totalCost4 } }
            })
          }
          
          mealPlanMeals['삼각3.5'] = meals3
          mealPlanMeals['삼각4.5'] = meals4
        }
        
        // ========== 버거 식단 생성 ==========
        const burgerProducts = products.filter(p => p.category === 'ff' && p.ffType === '버거')
        if (burgerProducts.length > 0) {
          const meals3: DailyMeal[] = []
          const meals4: DailyMeal[] = []
          const meals5: DailyMeal[] = []
          
          const usedDrinkIds = new Set<string>()
          const usedDessert1Ids = new Set<string>()
          const usedDessert2Ids = new Set<string>()
          
          const target3 = getTargetCost('버거3.5')
          const target4 = getTargetCost('버거4.5')
          const target5 = getTargetCost('버거5.5')
          
          for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
            const currentDate = dates[dayIndex]
            const year = currentDate.getFullYear()
            const month = currentDate.getMonth()
            const day = currentDate.getDate()
            const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayOfWeek = currentDate.getDay()
            
            const ffIndex = dayIndex % burgerProducts.length
            const ff = burgerProducts[ffIndex]
            const usedTodayIds = new Set<string>()
            
            // 버거는 탄산 음료만
            const targetDrinkCost = target3 - ff.cost
            let availableDrinksBurger = drinkProducts.filter(d => d.group === '탄산')
            if (availableDrinksBurger.length === 0) availableDrinksBurger = drinkProducts
            
            const drink = selectProductByTargetCost(availableDrinksBurger, targetDrinkCost, usedDrinkIds, usedTodayIds)
            if (drink) {
              usedDrinkIds.add(drink.id)
              usedTodayIds.add(drink.id)
            }
            
            const totalCost3 = ff.cost + (drink?.cost || 0)
            meals3.push({
              date,
              compositions: { 3500: { ff, drink, desserts: [], totalCost: totalCost3 } }
            })
            
            // 버거4: 버거3 + 디저트1
            const targetDessert1CostBurger = target4 - totalCost3
            const dessert1GroupBurger = DESSERT1_GROUP_BY_DAY[dayOfWeek]
            let availableDesserts1Burger = dessertProducts.filter(d => d.group === dessert1GroupBurger)
            if (availableDesserts1Burger.length === 0) availableDesserts1Burger = dessertProducts
            
            const dessert1 = selectProductByTargetCost(availableDesserts1Burger, targetDessert1CostBurger, usedDessert1Ids, usedTodayIds)
            if (dessert1) {
              usedDessert1Ids.add(dessert1.id)
              usedTodayIds.add(dessert1.id)
            }
            
            const desserts4 = dessert1 ? [dessert1] : []
            const totalCost4 = totalCost3 + desserts4.reduce((sum, d) => sum + d.cost, 0)
            meals4.push({
              date,
              compositions: { 4500: { ff, drink, desserts: desserts4, totalCost: totalCost4 } }
            })
            
            // 버거5: 버거4 + 디저트2
            const targetDessert2CostBurger = target5 - totalCost4
            const dessert2GroupsBurger = DESSERT2_GROUPS_BY_DAY[dayOfWeek]
            let availableDesserts2Burger: Product[] = []
            for (const group of dessert2GroupsBurger) {
              availableDesserts2Burger.push(...dessertProducts.filter(d => d.group === group && !usedTodayIds.has(d.id)))
            }
            if (availableDesserts2Burger.length === 0) {
              availableDesserts2Burger = dessertProducts.filter(d => !usedTodayIds.has(d.id))
            }
            
            const dessert2 = selectProductByTargetCost(availableDesserts2Burger, targetDessert2CostBurger, usedDessert2Ids, usedTodayIds)
            if (dessert2) {
              usedDessert2Ids.add(dessert2.id)
            }
            
            const desserts5 = [...desserts4]
            if (dessert2) desserts5.push(dessert2)
            const totalCost5 = totalCost3 + desserts5.reduce((sum, d) => sum + d.cost, 0)
            meals5.push({
              date,
              compositions: { 5500: { ff, drink, desserts: desserts5, totalCost: totalCost5 } }
            })
          }
          
          mealPlanMeals['버거3.5'] = meals3
          mealPlanMeals['버거4.5'] = meals4
          mealPlanMeals['버거5.5'] = meals5
        }
        
        // ========== 도시락 식단 생성 ==========
        const dosirakProducts = products.filter(p => p.category === 'ff' && p.ffType === '도시락')
        if (dosirakProducts.length > 0) {
          const meals45: DailyMeal[] = []
          const meals55: DailyMeal[] = []
          const meals65: DailyMeal[] = []
          
          const usedDrinkIds = new Set<string>()
          const usedDessert1Ids = new Set<string>()
          
          const target45 = getTargetCost('도시락4.5')
          const target55 = getTargetCost('도시락5.5')
          const target65 = getTargetCost('도시락6.5')
          
          for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
            const currentDate = dates[dayIndex]
            const year = currentDate.getFullYear()
            const month = currentDate.getMonth()
            const day = currentDate.getDate()
            const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayOfWeek = currentDate.getDay()
            
            const ffIndex = dayIndex % dosirakProducts.length
            const ff = dosirakProducts[ffIndex]
            const usedTodayIds = new Set<string>()
            
            // 도시락4.5: 도시락 + 음료
            const targetDrinkCostDosirak = target45 - ff.cost
            const drinkGroupDosirak = DRINK_GROUP_BY_DAY[dayOfWeek]
            let availableDrinksDosirak = drinkProducts.filter(d => d.group === drinkGroupDosirak)
            if (availableDrinksDosirak.length === 0) availableDrinksDosirak = drinkProducts
            
            const drink = selectProductByTargetCost(availableDrinksDosirak, targetDrinkCostDosirak, usedDrinkIds, usedTodayIds)
            if (drink) {
              usedDrinkIds.add(drink.id)
              usedTodayIds.add(drink.id)
            }
            
            const totalCost45 = ff.cost + (drink?.cost || 0)
            meals45.push({
              date,
              compositions: { 4500: { ff, drink, desserts: [], totalCost: totalCost45 } }
            })
            
            // 도시락5.5: 도시락4.5 + 디저트1
            const targetDessert1Cost55 = target55 - totalCost45
            const dessert1GroupDosirak = DESSERT1_GROUP_BY_DAY[dayOfWeek]
            let availableDesserts1Dosirak = dessertProducts.filter(d => d.group === dessert1GroupDosirak)
            if (availableDesserts1Dosirak.length === 0) availableDesserts1Dosirak = dessertProducts
            
            const dessert1_55 = selectProductByTargetCost(availableDesserts1Dosirak, targetDessert1Cost55, usedDessert1Ids, usedTodayIds)
            if (dessert1_55) {
              usedDessert1Ids.add(dessert1_55.id)
              usedTodayIds.add(dessert1_55.id)
            }
            
            const desserts55 = dessert1_55 ? [dessert1_55] : []
            const totalCost55 = totalCost45 + desserts55.reduce((sum, d) => sum + d.cost, 0)
            meals55.push({
              date,
              compositions: { 5500: { ff, drink, desserts: desserts55, totalCost: totalCost55 } }
            })
            
            // 도시락6.5: 도시락 + 음료 + 디저트1 (5.5와 동일 구성, 더 비싼 상품)
            const targetDessert1Cost65 = target65 - totalCost45
            const dessert1_65 = selectProductByTargetCost(
              availableDesserts1Dosirak.filter(d => d.id !== dessert1_55?.id),
              targetDessert1Cost65,
              new Set<string>(),
              usedTodayIds
            ) || dessert1_55
            
            const desserts65 = dessert1_65 ? [dessert1_65] : []
            const totalCost65 = totalCost45 + desserts65.reduce((sum, d) => sum + d.cost, 0)
            meals65.push({
              date,
              compositions: { 6500: { ff, drink, desserts: desserts65, totalCost: totalCost65 } }
            })
          }
          
          mealPlanMeals['도시락4.5'] = meals45
          mealPlanMeals['도시락5.5'] = meals55
          mealPlanMeals['도시락6.5'] = meals65
        }
        
        set({ mealPlanMeals })
      },
      
      updateMealComposition: (date, pricePoint, composition) => set((state) => {
        const selectedMealPlan = state.selectedMealPlan
        if (!selectedMealPlan) return state
        
        const mealPlanMeals = { ...state.mealPlanMeals }
        const meals = mealPlanMeals[selectedMealPlan] || []
        
        const mealIndex = meals.findIndex(m => m.date === date)
        if (mealIndex >= 0) {
          meals[mealIndex] = {
            ...meals[mealIndex],
            compositions: {
              ...meals[mealIndex].compositions,
              [pricePoint]: composition
            }
          }
        } else {
          meals.push({
            date,
            compositions: { [pricePoint]: composition }
          })
        }
        
        mealPlanMeals[selectedMealPlan] = meals
        return { mealPlanMeals }
      }),
    }),
    {
      name: 'mealbox-storage',
    }
  )
)
