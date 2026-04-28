import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { 
  Product, 
  DailyMeal, 
  MealComposition, 
  MealPlanName,
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
        const cur = new Date(startDate)
        while (cur <= endDate) {
          dates.push(new Date(cur))
          cur.setDate(cur.getDate() + 1)
        }
        if (dates.length === 0) return

        const mealPlanMeals: MealPlanDailyMeals = {}

        // 목표 원가
        const getTarget = (name: string) =>
          mealPlanTargetCosts[name] ??
          MEAL_PLAN_COST_CONFIGS.find(c => c.mealPlanName === name)?.defaultCost ??
          1500

        // ── 음료/디저트 그룹 상수 ──
        const ALL_DRINK_GROUPS = ['탄산', '건강', '주스', '차', '요거트']
        const ALL_DESSERT_GROUPS = ['당류', '단백질', '탄수화물', '프레시', '컵라면', '요거트']

        // 소비기한 기반 요거트 필터:
        // 월(1), 화(2)만 허용 / 수(3)~일(0) 제외
        const isYogurtAllowed = (dayOfWeek: number): boolean => {
          return dayOfWeek === 1 || dayOfWeek === 2
        }

        // 요일에 따라 사용 가능한 음료 그룹 반환
        const getAvailableDrinkGroups = (dayOfWeek: number): string[] => {
          if (isYogurtAllowed(dayOfWeek)) return ALL_DRINK_GROUPS
          return ALL_DRINK_GROUPS.filter(g => g !== '요거트')
        }

        // 요일에 따라 사용 가능한 디저트 그룹 반환
        const getAvailableDessertGroups = (dayOfWeek: number): string[] => {
          if (isYogurtAllowed(dayOfWeek)) return ALL_DESSERT_GROUPS
          return ALL_DESSERT_GROUPS.filter(g => g !== '요거트')
        }

        // 그룹에서 후보 추출 (없으면 전체 pool 반환)
        // dayOfWeek를 받아 요거트 제외 여부 자동 적용
        const poolByGroups = (pool: Product[], groups: string[], dayOfWeek: number): Product[] => {
          const allowedGroups = groups.filter(g => g !== '요거트' || isYogurtAllowed(dayOfWeek))
          const filtered = pool.filter(p => allowedGroups.includes(p.group ?? ''))
          // fallback: 요거트 제외한 전체 pool
          if (filtered.length > 0) return filtered
          return pool.filter(p => p.group !== '요거트' || isYogurtAllowed(dayOfWeek))
        }

        // SKU 빈도 제한: 7일 내 최대 2회 사용 추적
        const makeFreqTracker = () => {
          // key: productId, value: 사용된 dayIndex 배열
          const usage = new Map<string, number[]>()
          return {
            canUse: (id: string, dayIndex: number) => {
              const used = usage.get(id) ?? []
              // 7일 window 안에서 2회 미만이면 사용 가능
              const window = used.filter(d => dayIndex - d < 7)
              return window.length < 2
            },
            markUsed: (id: string, dayIndex: number) => {
              const used = usage.get(id) ?? []
              usage.set(id, [...used, dayIndex])
            }
          }
        }

        // 목표 원가에 가장 가까운 상품 선택
        // freqTracker 기반 SKU 빈도 제한 적용, usedTodayIds 당일 중복 방지
        const selectProduct = (
          pool: Product[],
          targetCost: number,
          freq: ReturnType<typeof makeFreqTracker>,
          dayIndex: number,
          usedTodayIds: Set<string>
        ): Product | undefined => {
          if (pool.length === 0) return undefined

          // 1순위: 당일 미사용 + 빈도 여유
          let candidates = pool.filter(p => !usedTodayIds.has(p.id) && freq.canUse(p.id, dayIndex))
          // 2순위: 빈도 여유만 (당일 중복 허용)
          if (candidates.length === 0) candidates = pool.filter(p => freq.canUse(p.id, dayIndex))
          // 3순위: 전체 (빈도 초과 포함)
          if (candidates.length === 0) candidates = pool

          // 목표 원가에 가장 가까운 순 정렬
          candidates.sort((a, b) => Math.abs(a.cost - targetCost) - Math.abs(b.cost - targetCost))

          // 상위 3개 중 랜덤 (다양성)
          const top = candidates.slice(0, Math.min(3, candidates.length))
          return top[Math.floor(Math.random() * top.length)]
        }

        // 음료 그룹 선택: 버거=탄산(75%)/주스(25%), 나머지=전날과 다른 그룹 랜덤
        // dayOfWeek: 요거트 허용 여부 판단에 사용
        const pickDrinkGroup = (isBurger: boolean, prevGroup: string | null, dayOfWeek: number): string => {
          if (isBurger) return Math.random() < 0.75 ? '탄산' : '주스'
          const available = getAvailableDrinkGroups(dayOfWeek).filter(g => g !== prevGroup)
          const pool = available.length > 0 ? available : getAvailableDrinkGroups(dayOfWeek)
          return pool[Math.floor(Math.random() * pool.length)]
        }

        // 디저트 그룹 선택: 음료 그룹과 중복 안되는 그룹에서 랜덤, 이미 선택된 그룹도 제외
        // dayOfWeek: 요거트 허용 여부 판단에 사용
        const pickDessertGroup = (excludeGroups: string[], dayOfWeek: number): string => {
          const available = getAvailableDessertGroups(dayOfWeek).filter(g => !excludeGroups.includes(g))
          const fallback = getAvailableDessertGroups(dayOfWeek)
          const pool = available.length > 0 ? available : fallback
          return pool[Math.floor(Math.random() * pool.length)]
        }

        // 조합 고유성 체크: 7일 내 동일 A+B+C 반복 금지
        const makeCombinationTracker = () => {
          const used = new Set<string>()
          return {
            isUnique: (ids: string[]) => {
              const key = [...ids].sort().join('|')
              return !used.has(key)
            },
            mark: (ids: string[]) => {
              const key = [...ids].sort().join('|')
              used.add(key)
            }
          }
        }

        // ─────────────────────────────────────────────────────
        // 공통 식단 생성 함수: 김밥/샌드/버거
        // tiers: [{pricePoint, mealPlanName, dessertCount}]
        // ─────────────────────────────────────────────────────
        const buildStandardMeals = (
          ffList: Product[],
          tiers: { pricePoint: number; mealPlanName: string; dessertCount: number }[],
          isBurger: boolean
        ): { [mealPlanName: string]: DailyMeal[] } => {
          const result: { [k: string]: DailyMeal[] } = {}
          tiers.forEach(t => { result[t.mealPlanName] = [] })

          const drinkFreq = makeFreqTracker()
          const dessertFreqs = [makeFreqTracker(), makeFreqTracker()] // B, C
          const combinationTracker = makeCombinationTracker()

          let prevDrinkGroup: string | null = null

          for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
            const d = dates[dayIndex]
            const dayOfWeek = d.getDay()
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const ff = ffList[dayIndex % ffList.length]
            const usedTodayIds = new Set<string>([ff.id])

            // 음료 선택
            const drinkGroup = pickDrinkGroup(isBurger, prevDrinkGroup, dayOfWeek)
            prevDrinkGroup = drinkGroup
            const drinkPool = poolByGroups(drinkProducts, [drinkGroup], dayOfWeek)
            const targetDrink = getTarget(tiers[0].mealPlanName) - ff.cost
            const drink = selectProduct(drinkPool, targetDrink, drinkFreq, dayIndex, usedTodayIds)
            if (drink) { drinkFreq.markUsed(drink.id, dayIndex); usedTodayIds.add(drink.id) }

            // 디저트 선택 (최대 2개)
            const maxDesserts = Math.max(...tiers.map(t => t.dessertCount))
            const selectedDesserts: Product[] = []
            const usedDessertGroups: string[] = [drinkGroup] // 음료 그룹 제외

            for (let di = 0; di < maxDesserts; di++) {
              const tierWithThisDessert = tiers.find(t => t.dessertCount > di)
              if (!tierWithThisDessert) break
              const prevTierCost = di === 0
                ? ff.cost + (drink?.cost ?? 0)
                : ff.cost + (drink?.cost ?? 0) + selectedDesserts.reduce((s, x) => s + x.cost, 0)
              const targetDessertCost = getTarget(tierWithThisDessert.mealPlanName) - prevTierCost

              const dGroup = pickDessertGroup(usedDessertGroups, dayOfWeek)
              usedDessertGroups.push(dGroup)
              const dPool = poolByGroups(dessertProducts, [dGroup], dayOfWeek)
              const dessert = selectProduct(dPool, targetDessertCost, dessertFreqs[di], dayIndex, usedTodayIds)
              if (dessert) {
                selectedDesserts.push(dessert)
                dessertFreqs[di].markUsed(dessert.id, dayIndex)
                usedTodayIds.add(dessert.id)
              }
            }

            // 조합 고유성 보장 (7일 window)
            const comboIds = [drink?.id ?? '', ...selectedDesserts.map(d => d.id)].filter(Boolean)
            if (!combinationTracker.isUnique(comboIds)) {
              // 중복 시 마지막 디저트를 다른 상품으로 교체 시도
              if (selectedDesserts.length > 0) {
                const lastIdx = selectedDesserts.length - 1
                const altPool = dessertProducts.filter(p => !usedTodayIds.has(p.id) && !selectedDesserts.slice(0, lastIdx).map(x => x.id).includes(p.id))
                if (altPool.length > 0) {
                  altPool.sort((a, b) => Math.abs(a.cost - (selectedDesserts[lastIdx]?.cost ?? 0)) - Math.abs(b.cost - (selectedDesserts[lastIdx]?.cost ?? 0)))
                  selectedDesserts[lastIdx] = altPool[0]
                }
              }
            }
            combinationTracker.mark([drink?.id ?? '', ...selectedDesserts.map(x => x.id)].filter(Boolean))

            // 각 tier별로 저장
            for (const tier of tiers) {
              const tierDesserts = selectedDesserts.slice(0, tier.dessertCount)
              const totalCost = ff.cost + (drink?.cost ?? 0) + tierDesserts.reduce((s, x) => s + x.cost, 0)
              result[tier.mealPlanName].push({
                date: dateStr,
                compositions: { [tier.pricePoint]: { ff, drink, desserts: tierDesserts, totalCost } }
              })
            }
          }
          return result
        }

        // ========== 김밥 식단 생성 ==========
        const gimbapProducts = products.filter(p => p.category === 'ff' && p.ffType === '김밥')
        if (gimbapProducts.length > 0) {
          const meals = buildStandardMeals(
            gimbapProducts,
            [
              { pricePoint: 3500, mealPlanName: '김밥3.5', dessertCount: 0 },
              { pricePoint: 4500, mealPlanName: '김밥4.5', dessertCount: 1 },
              { pricePoint: 5500, mealPlanName: '김밥5.5', dessertCount: 2 },
            ],
            false
          )
          Object.assign(mealPlanMeals, meals)
        }

        // ========== 샌드 식단 생성 (김밥과 동일한 음료/디저트) ==========
        const sandProducts = products.filter(p => p.category === 'ff' && p.ffType === '샌드')
        if (sandProducts.length > 0 && mealPlanMeals['김밥3.5']) {
          const priceTiers: [string, number][] = [['3.5', 3500], ['4.5', 4500], ['5.5', 5500]]
          for (const [suffix, price] of priceTiers) {
            const base = mealPlanMeals[`김밥${suffix}`]
            if (!base) continue
            mealPlanMeals[`샌드${suffix}`] = base.map((meal, idx) => {
              const sandFF = sandProducts[idx % sandProducts.length]
              const comp = meal.compositions[price]
              const desserts = comp?.desserts ?? []
              return {
                date: meal.date,
                compositions: {
                  [price]: {
                    ff: sandFF,
                    drink: comp?.drink,
                    desserts,
                    totalCost: sandFF.cost + (comp?.drink?.cost ?? 0) + desserts.reduce((s, d) => s + d.cost, 0)
                  }
                }
              }
            })
          }
        }

        // ========== 삼각 식단 생성 ==========
        // 삼각3(3.5): FF + 음료 + 디저트B + 디저트C (구성품 3개)
        // 삼각4(4.5): 삼각3 + 디저트D (구성품 4개)
        const samgakProducts = products.filter(p => p.category === 'ff' && p.ffType === '주먹밥')
        if (samgakProducts.length > 0) {
          const meals3: DailyMeal[] = []
          const meals4: DailyMeal[] = []
          const drinkFreq = makeFreqTracker()
          const dessertFreqs = [makeFreqTracker(), makeFreqTracker(), makeFreqTracker()]
          const combinationTracker = makeCombinationTracker()
          let prevDrinkGroup: string | null = null

          for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
            const d = dates[dayIndex]
            const dayOfWeek = d.getDay()
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const ff = samgakProducts[dayIndex % samgakProducts.length]
            const usedTodayIds = new Set<string>([ff.id])

            // 음료 선택 (삼각은 일반 음료 그룹)
            const drinkGroup = pickDrinkGroup(false, prevDrinkGroup, dayOfWeek)
            prevDrinkGroup = drinkGroup
            const drinkPool = poolByGroups(drinkProducts, [drinkGroup], dayOfWeek)
            const targetDrink = getTarget('삼각3.5') - ff.cost
            const drink = selectProduct(drinkPool, targetDrink, drinkFreq, dayIndex, usedTodayIds)
            if (drink) { drinkFreq.markUsed(drink.id, dayIndex); usedTodayIds.add(drink.id) }

            // 삼각3: 디저트 2개 (B, C)
            const usedDessertGroups: string[] = [drinkGroup]
            const desserts3: Product[] = []
            const target3 = getTarget('삼각3.5')
            const target4 = getTarget('삼각4.5')

            for (let di = 0; di < 2; di++) {
              const baseCost = ff.cost + (drink?.cost ?? 0) + desserts3.reduce((s, x) => s + x.cost, 0)
              const targetCost = (di === 0 ? target3 : target4) - baseCost
              const dGroup = pickDessertGroup(usedDessertGroups, dayOfWeek)
              usedDessertGroups.push(dGroup)
              const dPool = poolByGroups(dessertProducts, [dGroup], dayOfWeek)
              const dessert = selectProduct(dPool, targetCost, dessertFreqs[di], dayIndex, usedTodayIds)
              if (dessert) {
                desserts3.push(dessert)
                dessertFreqs[di].markUsed(dessert.id, dayIndex)
                usedTodayIds.add(dessert.id)
              }
            }

            // 삼각4: 디저트 1개 추가 (D)
            const baseCost4 = ff.cost + (drink?.cost ?? 0) + desserts3.reduce((s, x) => s + x.cost, 0)
            const targetDessert4 = target4 - baseCost4
            const dGroup4 = pickDessertGroup(usedDessertGroups, dayOfWeek)
            const dPool4 = poolByGroups(dessertProducts, [dGroup4], dayOfWeek)
            const dessert4th = selectProduct(dPool4, targetDessert4, dessertFreqs[2], dayIndex, usedTodayIds)
            if (dessert4th) dessertFreqs[2].markUsed(dessert4th.id, dayIndex)

            const desserts4 = dessert4th ? [...desserts3, dessert4th] : [...desserts3]

            // 조합 고유성
            const comboIds3 = [drink?.id ?? '', ...desserts3.map(x => x.id)].filter(Boolean)
            if (!combinationTracker.isUnique(comboIds3) && desserts3.length > 0) {
              const altPool = dessertProducts.filter(p => !usedTodayIds.has(p.id))
              if (altPool.length > 0) desserts3[desserts3.length - 1] = altPool[0]
            }
            combinationTracker.mark(comboIds3)

            const totalCost3 = ff.cost + (drink?.cost ?? 0) + desserts3.reduce((s, x) => s + x.cost, 0)
            const totalCost4 = ff.cost + (drink?.cost ?? 0) + desserts4.reduce((s, x) => s + x.cost, 0)

            meals3.push({ date: dateStr, compositions: { 3500: { ff, drink, desserts: desserts3, totalCost: totalCost3 } } })
            meals4.push({ date: dateStr, compositions: { 4500: { ff, drink, desserts: desserts4, totalCost: totalCost4 } } })
          }
          mealPlanMeals['삼각3.5'] = meals3
          mealPlanMeals['삼각4.5'] = meals4
        }

        // ========== 버거 식단 생성 ==========
        const burgerProducts = products.filter(p => p.category === 'ff' && p.ffType === '버거')
        if (burgerProducts.length > 0) {
          const meals = buildStandardMeals(
            burgerProducts,
            [
              { pricePoint: 3500, mealPlanName: '버거3.5', dessertCount: 0 },
              { pricePoint: 4500, mealPlanName: '버거4.5', dessertCount: 1 },
              { pricePoint: 5500, mealPlanName: '버거5.5', dessertCount: 2 },
            ],
            true // 버거 = 탄산 75%, 주스 25%
          )
          Object.assign(mealPlanMeals, meals)
        }

        // ========== 도시락 식단 생성 ==========
        const dosirakProducts = products.filter(p => p.category === 'ff' && p.ffType === '도시락')
        if (dosirakProducts.length > 0) {
          const meals45: DailyMeal[] = []
          const meals55: DailyMeal[] = []
          const meals65: DailyMeal[] = []

          const drinkFreq = makeFreqTracker()
          const dessertFreq55 = makeFreqTracker()
          const dessertFreq65 = makeFreqTracker()
          let prevDrinkGroup: string | null = null

          for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
            const d = dates[dayIndex]
            const dayOfWeek = d.getDay()
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const ff = dosirakProducts[dayIndex % dosirakProducts.length]
            const usedTodayIds = new Set<string>([ff.id])

            const target45 = getTarget('도시락4.5')
            const target55 = getTarget('도시락5.5')
            const target65 = getTarget('도시락6.5')

            // 음료
            const drinkGroup = pickDrinkGroup(false, prevDrinkGroup, dayOfWeek)
            prevDrinkGroup = drinkGroup
            const drinkPool = poolByGroups(drinkProducts, [drinkGroup], dayOfWeek)
            const drink = selectProduct(drinkPool, target45 - ff.cost, drinkFreq, dayIndex, usedTodayIds)
            if (drink) { drinkFreq.markUsed(drink.id, dayIndex); usedTodayIds.add(drink.id) }

            const totalCost45 = ff.cost + (drink?.cost ?? 0)
            meals45.push({ date: dateStr, compositions: { 4500: { ff, drink, desserts: [], totalCost: totalCost45 } } })

            // 도시락5.5: + 디저트1
            const usedDessertGroups55 = [drinkGroup]
            const dGroup55 = pickDessertGroup(usedDessertGroups55, dayOfWeek)
            const dPool55 = poolByGroups(dessertProducts, [dGroup55], dayOfWeek)
            const dessert55 = selectProduct(dPool55, target55 - totalCost45, dessertFreq55, dayIndex, usedTodayIds)
            if (dessert55) { dessertFreq55.markUsed(dessert55.id, dayIndex); usedTodayIds.add(dessert55.id) }

            const desserts55 = dessert55 ? [dessert55] : []
            const totalCost55 = totalCost45 + desserts55.reduce((s, x) => s + x.cost, 0)
            meals55.push({ date: dateStr, compositions: { 5500: { ff, drink, desserts: desserts55, totalCost: totalCost55 } } })

            // 도시락6.5: + 디저트1 (다른 상품, 목표원가 다름)
            const usedDessertGroups65 = [drinkGroup]
            const dGroup65 = pickDessertGroup(usedDessertGroups65, dayOfWeek)
            const dPool65 = poolByGroups(dessertProducts.filter(p => p.id !== dessert55?.id), [dGroup65], dayOfWeek)
            const fallbackPool65 = dPool65.length > 0 ? dPool65 : dessertProducts.filter(p => !usedTodayIds.has(p.id))
            const dessert65 = selectProduct(fallbackPool65, target65 - totalCost45, dessertFreq65, dayIndex, usedTodayIds)
            if (dessert65) dessertFreq65.markUsed(dessert65.id, dayIndex)

            const desserts65 = dessert65 ? [dessert65] : desserts55
            const totalCost65 = totalCost45 + desserts65.reduce((s, x) => s + x.cost, 0)
            meals65.push({ date: dateStr, compositions: { 6500: { ff, drink, desserts: desserts65, totalCost: totalCost65 } } })
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
