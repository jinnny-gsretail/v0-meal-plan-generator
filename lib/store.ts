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

// 전체 식단 스냅샷 (저장/불러오기용)
export interface MealPlanSnapshot {
  id: string
  name: string
  createdAt: string
  startDate: string
  endDate: string
  mealPlanMeals: MealPlanDailyMeals
  mealPlanTargetCosts: MealPlanTargetCosts
  products: Product[]
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
  // 구성품 연동 수정: 김밥3→김밥4,5 및 삼각3,4로 전파
  updateMealComponent: (
    date: string,
    mealPlanName: string,
    componentType: 'drink' | 'dessert',
    componentIndex: number, // dessert의 경우 0=B, 1=C
    newProduct: Product,
    syncToRelated: boolean
  ) => void
  // FF 수정: 동일 날짜의 같은 FF타입 전 가격대에 연동
  updateFF: (
    date: string,
    mealPlanName: string,
    newFF: Product,
    syncSameType: boolean
  ) => void
  
  // 스냅샷 관리
  snapshots: MealPlanSnapshot[]
  snapshotStatus: 'idle' | 'saving' | 'loading' | 'success' | 'error'
  snapshotMessage: string | null
  saveSnapshot: (name: string) => void
  loadSnapshot: (id: string) => void
  deleteSnapshot: (id: string) => void
  clearSnapshotStatus: () => void
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
      snapshots: [],
      snapshotStatus: 'idle',
      snapshotMessage: null,
      
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

        // SKU 빈도 제���: 7일 내 최대 2회 사용 추적
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

        // 월요일 여부
        const isMonday = (dayOfWeek: number) => dayOfWeek === 1

        // 음료 그룹 선택
        // - 월요일: 요거트 필수 → '요거트' 고정
        // - 버거(월요일 제외): 탄산 75% / 주스 25%
        // - 나머지: 전날과 다른 그룹 랜덤 (요거트 허용 여부 반영)
        const pickDrinkGroup = (isBurger: boolean, prevGroup: string | null, dayOfWeek: number): string => {
          if (isMonday(dayOfWeek)) return '요거트' // 월요일은 음료를 요거트로 고정
          if (isBurger) return Math.random() < 0.75 ? '탄산' : '주스'
          const available = getAvailableDrinkGroups(dayOfWeek).filter(g => g !== prevGroup)
          const pool = available.length > 0 ? available : getAvailableDrinkGroups(dayOfWeek)
          return pool[Math.floor(Math.random() * pool.length)]
        }

        // 디저트 그룹 선택: 음료 그룹과 중복 안되는 그룹에서 랜덤, 이미 선택된 그룹도 제외
        // 월요일에 음료가 이미 요거트이면 디저트에서 요거트 제외 (요거트+요거트 중복 금지)
        const pickDessertGroup = (excludeGroups: string[], dayOfWeek: number): string => {
          // 월요일이고 음료가 이미 요거트이면 디저트에서도 요거트 제외
          const effectiveExcludes = isMonday(dayOfWeek) && excludeGroups.includes('요거트')
            ? [...excludeGroups] // 이미 요거트 제외됨
            : excludeGroups
          const available = getAvailableDessertGroups(dayOfWeek).filter(g => !effectiveExcludes.includes(g))
          const fallback = getAvailableDessertGroups(dayOfWeek).filter(g => !effectiveExcludes.includes('요거트') ? g !== '요거트' : true)
          const pool = available.length > 0 ? available : (fallback.length > 0 ? fallback : getAvailableDessertGroups(dayOfWeek))
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
            // 음료 그룹을 제외 목록에 포함 (요거트 음료인 경우 디저트 요거트도 자동 제외됨)
            const usedDessertGroups: string[] = [drinkGroup]

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
        // 삼각3.5: FF + 음료A + 디저트B       (2개 구성 - 김밥4.5와 동일)
        // 삼각4.5: FF + 음료A + 디저트B + 디저트C (3개 구성 - 김밥5.5와 동일)
        const samgakProducts = products.filter(p => p.category === 'ff' && p.ffType === '주먹밥')
        if (samgakProducts.length > 0) {
          const meals3: DailyMeal[] = []
          const meals4: DailyMeal[] = []
          const drinkFreq = makeFreqTracker()
          const cupRamenFreq = makeFreqTracker() // 금요일 컵라면 빈도 추적
          const dessertFreqs = [makeFreqTracker(), makeFreqTracker()] // B, C
          const combinationTracker = makeCombinationTracker()
          let prevDrinkGroup: string | null = null

          for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
            const d = dates[dayIndex]
            const dayOfWeek = d.getDay()
            const isFriday = dayOfWeek === 5
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const ff = samgakProducts[dayIndex % samgakProducts.length]
            const usedTodayIds = new Set<string>([ff.id])

            const target3 = getTarget('삼각3.5')
            const target4 = getTarget('삼각4.5')

            // ── 구성품 A 선택 ──
            // 금요일: 음료 대신 디저트 [컵라면] 그룹에서 선택
            // 나머지: 일반 음료 선택 (월요일 요거트 필수 규칙 적용)
            let drink: Product | undefined = undefined
            let cupRamenA: Product | undefined = undefined
            let usedDessertGroups: string[] = []
            let baseCostAfterA = ff.cost

            if (isFriday) {
              const cupRamenPool = dessertProducts.filter(p => p.group === '컵라면')
              const fallbackPool = cupRamenPool.length > 0 ? cupRamenPool : dessertProducts
              cupRamenA = selectProduct(fallbackPool, target3 - ff.cost, cupRamenFreq, dayIndex, usedTodayIds)
              if (cupRamenA) { cupRamenFreq.markUsed(cupRamenA.id, dayIndex); usedTodayIds.add(cupRamenA.id) }
              usedDessertGroups = ['컵라면'] // A가 컵라면이므로 B, C에서 컵라면 제외
              baseCostAfterA = ff.cost + (cupRamenA?.cost ?? 0)
            } else {
              const drinkGroup = pickDrinkGroup(false, prevDrinkGroup, dayOfWeek)
              prevDrinkGroup = drinkGroup
              const drinkPool = poolByGroups(drinkProducts, [drinkGroup], dayOfWeek)
              drink = selectProduct(drinkPool, target3 - ff.cost, drinkFreq, dayIndex, usedTodayIds)
              if (drink) { drinkFreq.markUsed(drink.id, dayIndex); usedTodayIds.add(drink.id) }
              usedDessertGroups = [drinkGroup]
              baseCostAfterA = ff.cost + (drink?.cost ?? 0)
            }

            // 구성품 B (디저트1) - 삼각3.5 목표원가 달성
            const targetB = target3 - baseCostAfterA
            const dGroupB = pickDessertGroup(usedDessertGroups, dayOfWeek)
            usedDessertGroups.push(dGroupB)
            const dPoolB = poolByGroups(dessertProducts, [dGroupB], dayOfWeek)
            const dessertB = selectProduct(dPoolB, targetB, dessertFreqs[0], dayIndex, usedTodayIds)
            if (dessertB) { dessertFreqs[0].markUsed(dessertB.id, dayIndex); usedTodayIds.add(dessertB.id) }

            // 금요일은 컵라면(A)을 desserts 배열 앞에 넣고, 나머지 디저트를 뒤에 추가
            const desserts35 = isFriday
              ? (cupRamenA ? [cupRamenA, ...(dessertB ? [dessertB] : [])] : dessertB ? [dessertB] : [])
              : (dessertB ? [dessertB] : [])
            const totalCost3 = ff.cost + (isFriday ? 0 : (drink?.cost ?? 0)) + desserts35.reduce((s, x) => s + x.cost, 0)

            // 구성품 C (디저트2) - 삼각4.5 목표원가 달성
            const targetC = target4 - totalCost3
            const dGroupC = pickDessertGroup(usedDessertGroups, dayOfWeek)
            usedDessertGroups.push(dGroupC)
            const dPoolC = poolByGroups(dessertProducts, [dGroupC], dayOfWeek)
            const dessertC = selectProduct(dPoolC, targetC, dessertFreqs[1], dayIndex, usedTodayIds)
            if (dessertC) { dessertFreqs[1].markUsed(dessertC.id, dayIndex); usedTodayIds.add(dessertC.id) }

            const desserts45 = dessertC ? [...desserts35, dessertC] : [...desserts35]
            const totalCost4 = ff.cost + (isFriday ? 0 : (drink?.cost ?? 0)) + desserts45.reduce((s, x) => s + x.cost, 0)

            // 조합 고유성 체크
            const comboIds = [
              ...(isFriday ? [] : [drink?.id ?? '']),
              ...desserts45.map(x => x.id)
            ].filter(Boolean)
            if (!combinationTracker.isUnique(comboIds) && desserts45.length > 0) {
              const altPool = dessertProducts.filter(p =>
                !usedTodayIds.has(p.id) &&
                (p.group !== '요거트' || isYogurtAllowed(dayOfWeek)) &&
                (!isFriday || p.group !== '���라면') // 금요일엔 C 자리에 컵라면 중복 금지
              )
              if (altPool.length > 0) {
                altPool.sort((a, b) => Math.abs(a.cost - targetC) - Math.abs(b.cost - targetC))
                desserts45[desserts45.length - 1] = altPool[0]
              }
            }
            combinationTracker.mark(comboIds)

            // 금요일: drink=undefined, 컵라면은 desserts 배열에 포함
            meals3.push({ date: dateStr, compositions: { 3500: { ff, drink: isFriday ? undefined : drink, desserts: desserts35, totalCost: totalCost3 } } })
            meals4.push({ date: dateStr, compositions: { 4500: { ff, drink: isFriday ? undefined : drink, desserts: desserts45, totalCost: totalCost4 } } })
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

        // ========== 음X 식단 생성 (음료 제외, 4.5 기준 B+C 연동) ==========
        // 김밥3.5(음X): 김밥4.5의 FF + B + C (음료 제외)
        // 샌드3.5(음X): 샌드4.5의 FF + B + C (음료 제외)
        // 삼각3.5(음X): 삼각4.5의 FF + B + C (음료 제외)
        const noDrinkMappings: { target: string; source: string; ffType: FFType }[] = [
          { target: '김밥3.5(음X)', source: '김밥4.5', ffType: '김밥' },
          { target: '샌드3.5(음X)', source: '샌드4.5', ffType: '샌드' },
          { target: '삼각3.5(음X)', source: '삼각4.5', ffType: '주먹밥' },
        ]

        for (const mapping of noDrinkMappings) {
          const source45 = mealPlanMeals[mapping.source]
          const source55Name = mapping.source.replace('4.5', '5.5')
          const source55 = mealPlanMeals[source55Name]
          if (!source45) continue

          // 해당 FF 타입 상품 목록
          const ffPool = products.filter(p => p.category === 'ff' && p.ffType === mapping.ffType)

          mealPlanMeals[mapping.target] = source45.map((meal, idx) => {
            const comp45 = meal.compositions[4500]
            // 5.5에서 C 디저트 가져오기
            const comp55 = source55?.[idx]?.compositions[5500]
            const dessertC = comp55?.desserts?.[1]

            // FF: 4.5와 동일 FF 사용 (삼각의 경우 삼각김밥 FF)
            const ff = comp45?.ff ?? ffPool[idx % ffPool.length]

            // 디저트: B(4.5의 첫 디저트) + C(5.5의 두번째 디저트)
            const desserts: Product[] = []
            if (comp45?.desserts?.[0]) desserts.push(comp45.desserts[0])
            if (dessertC) desserts.push(dessertC)

            const totalCost = ff.cost + desserts.reduce((s, d) => s + d.cost, 0)

            return {
              date: meal.date,
              compositions: {
                3500: {
                  ff,
                  drink: undefined, // 음료 제외
                  desserts,
                  totalCost,
                }
              }
            }
          })
        }

        // ========== 공장박스 식단 생성 ==========
        // 월요일: 샌드 단품 (FF만)
        // 화~일요일: "삼각)" 접두어 삼각김밥 + 김밥3.5의 음료
        const gimbap35 = mealPlanMeals['김밥3.5']
        const samgakFFPool = products.filter(p => p.category === 'ff' && p.ffType === '주먹밥' && p.name.startsWith('삼각)'))
        const sandFFPool = products.filter(p => p.category === 'ff' && p.ffType === '샌드')
        const factoryBoxCost = 964 // 고정 원가

        if ((samgakFFPool.length > 0 || sandFFPool.length > 0) && gimbap35) {
          const factoryBoxMeals: DailyMeal[] = []
          let samgakIdx = 0
          let sandIdx = 0

          for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
            const d = dates[dayIndex]
            const dayOfWeek = d.getDay()
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const isMonday = dayOfWeek === 1

            if (isMonday) {
              // 월요일: 샌드 단품 (FF만)
              const sandFF = sandFFPool.length > 0 ? sandFFPool[sandIdx % sandFFPool.length] : undefined
              sandIdx++
              factoryBoxMeals.push({
                date: dateStr,
                compositions: {
                  3500: {
                    ff: sandFF,
                    drink: undefined,
                    desserts: [],
                    totalCost: sandFF?.cost ?? 0,
                  }
                }
              })
            } else {
              // 화~일요일: "삼각)" 삼각김밥 + 김밥3.5 음료
              const samgakFF = samgakFFPool.length > 0 ? samgakFFPool[samgakIdx % samgakFFPool.length] : undefined
              samgakIdx++
              // 김밥3.5에서 동일 날짜의 음료 가져오기
              const gimbap35Meal = gimbap35.find(m => m.date === dateStr)
              const drinkFromGimbap = gimbap35Meal?.compositions[3500]?.drink

              factoryBoxMeals.push({
                date: dateStr,
                compositions: {
                  3500: {
                    ff: samgakFF,
                    drink: drinkFromGimbap,
                    desserts: [],
                    totalCost: (samgakFF?.cost ?? 0) + (drinkFromGimbap?.cost ?? 0),
                  }
                }
              })
            }
          }

          mealPlanMeals['공장박스'] = factoryBoxMeals
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

      // 구성품 연동 수정
      updateMealComponent: (date, mealPlanName, componentType, componentIndex, newProduct, syncToRelated) => set((state) => {
        const mealPlanMeals = { ...state.mealPlanMeals }

        /**
         * 삼각 단가 보정 연동 규칙
         * ─────────────────────────────────────────────────────
         * 삼각3.5 구성품 = 김밥4.5 구성품 (A+B 동기화)
         * 삼각4.5 구성품 = 김밥5.5 구성품 (A+B+C 동기화)
         *
         * 전파 매핑 (syncToRelated=true 시):
         * 김밥3.5(drink=A)  → 김밥4.5/5.5(A), 샌드3.5/4.5/5.5(A)
         *   * 삼각3.5(A)는 김밥4.5(A)와 동기화되므로 김밥4.5(A) 전파 시 자동 포함
         *
         * 김밥4.5(drink=A)  → 김밥5.5(A), 삼각3.5(A), 샌드4.5/5.5(A)
         * 김밥4.5(dessert B) → 김밥5.5(B), 삼각3.5(B), 삼각4.5(B), 샌드4.5/5.5(B)
         *
         * 김밥5.5(drink=A)  → 삼각4.5(A)
         * 김밥5.5(dessert B) → 삼각4.5(B)
         * 김밥5.5(dessert C) → 삼각4.5(C), 샌드5.5(C)
         *
         * 삼각3.5(drink=A)  → 김밥4.5(A)  (역방향: 삼각→기준)
         * 삼각3.5(dessert B) → 김밥4.5(B)
         * 삼각4.5(drink=A)  → 김밥5.5(A)
         * 삼각4.5(dessert B) → 김밥5.5(B)
         * 삼각4.5(dessert C) → 김밥5.5(C)
         * ─────────────────────────────────────────────────────
         */
        const getSyncTargets = (
          srcPlan: string,
          cType: 'drink' | 'dessert',
          cIdx: number,
        ): { plan: string; type: 'drink' | 'dessert'; idx: number }[] => {
          if (!syncToRelated) return []

          type T = { plan: string; type: 'drink' | 'dessert'; idx: number }
          const t: T[] = []

          // 헬퍼
          const drink  = (plan: string): T => ({ plan, type: 'drink',   idx: 0 })
          const dessert = (plan: string, idx: number): T => ({ plan, type: 'dessert', idx })

          // ── 김밥 ���준 하향 전파 ──────────────────────────────
          if (srcPlan === '김밥3.5' && cType === 'drink') {
            // 김밥3.5(A) → 김밥4.5(A) → 삼각3.5(A) 연쇄, 김밥5.5(A), 샌드 전체(A)
            // + 공장박스 (화~일요일만 - 월요일은 샌드 단품이라 음료 없음)
            t.push(drink('김밥4.5'), drink('김밥5.5'))
            t.push(drink('삼각3.5'), drink('삼각4.5'))
            t.push(drink('샌드3.5'), drink('샌드4.5'), drink('샌드5.5'))
            t.push(drink('공장박스')) // 공장박스(화~일) 음료 연동
          }

          if (srcPlan === '김밥4.5' && cType === 'drink') {
            // 김밥4.5(A) → 삼각3.5(A), 김밥5.5(A)→삼각4.5(A), 샌드4.5/5.5(A)
            t.push(drink('삼각3.5'))
            t.push(drink('김밥5.5'), drink('삼각4.5'))
            t.push(drink('샌드4.5'), drink('샌드5.5'))
          }
          if (srcPlan === '김밥4.5' && cType === 'dessert' && cIdx === 0) {
            // 김밥4.5(B) → 삼각3.5(B), 김밥5.5(B), 삼각4.5(B), 샌드4.5/5.5(B)
            // + 음X 식단: 김밥3.5(음X)(B=0), 샌드3.5(음X)(B=0), 삼각3.5(음X)(B=0)
            t.push(dessert('삼각3.5', 0))
            t.push(dessert('김밥5.5', 0), dessert('삼각4.5', 0))
            t.push(dessert('샌드4.5', 0), dessert('샌드5.5', 0))
            // 음X 식단 연동 (B = desserts[0])
            t.push(dessert('김밥3.5(음X)', 0))
            t.push(dessert('샌드3.5(음X)', 0))
            t.push(dessert('삼각3.5(음X)', 0))
          }

          if (srcPlan === '김밥5.5' && cType === 'drink') {
            // 김밥5.5(A) → 삼각4.5(A)
            t.push(drink('삼각4.5'))
          }
          if (srcPlan === '김밥5.5' && cType === 'dessert' && cIdx === 0) {
            // 김밥5.5(B) → 삼각4.5(B)
            t.push(dessert('삼각4.5', 0))
          }
          if (srcPlan === '김밥5.5' && cType === 'dessert' && cIdx === 1) {
            // 김밥5.5(C) → 삼각4.5(C), 샌드5.5(C)
            // + 음X 식단: 김밥3.5(음X)(C=1), 샌드3.5(음X)(C=1), 삼각3.5(음X)(C=1)
            t.push(dessert('삼각4.5', 1), dessert('샌드5.5', 1))
            // 음X 식단 연동 (C = desserts[1])
            t.push(dessert('김밥3.5(음X)', 1))
            t.push(dessert('샌드3.5(음X)', 1))
            t.push(dessert('삼각3.5(음X)', 1))
          }

          // ── 삼각 역방향 전파 (삼각 수정 시 기준 김밥도 업데이트) ──
          if (srcPlan === '삼각3.5' && cType === 'drink') {
            t.push(drink('김밥4.5'))
          }
          if (srcPlan === '삼각3.5' && cType === 'dessert' && cIdx === 0) {
            t.push(dessert('김밥4.5', 0))
          }
          if (srcPlan === '삼각4.5' && cType === 'drink') {
            t.push(drink('김밥5.5'))
          }
          if (srcPlan === '삼각4.5' && cType === 'dessert' && cIdx === 0) {
            t.push(dessert('김밥5.5', 0))
          }
          if (srcPlan === '삼각4.5' && cType === 'dessert' && cIdx === 1) {
            t.push(dessert('김밥5.5', 1))
          }

          return t
        }
        
        // 단일 식단 구성품 업데이트 헬퍼
        const updateSingleMeal = (planName: string, cType: 'drink' | 'dessert', cIdx: number) => {
          const meals = mealPlanMeals[planName]
          if (!meals) return
          
          const mealIdx = meals.findIndex(m => m.date === date)
          if (mealIdx < 0) return
          
          // 공장박스 월요일 체크: 월요일은 샌드 단품이라 음료가 없음
          if (planName === '공장박스' && cType === 'drink') {
            const dateObj = new Date(date)
            if (dateObj.getDay() === 1) return // 월요일이면 음료 업데이트 무시
          }
          
          const meal = meals[mealIdx]
          const pricePoint = planName.includes('3.5') || planName === '공장박스' ? 3500 : planName.includes('4.5') ? 4500 : planName.includes('5.5') ? 5500 : 6500
          const comp = meal.compositions[pricePoint]
          if (!comp) return
          
          let newComp = { ...comp }
          if (cType === 'drink') {
            newComp.drink = newProduct
          } else {
            const newDesserts = [...(comp.desserts || [])]
            if (cIdx < newDesserts.length) {
              newDesserts[cIdx] = newProduct
            }
            newComp.desserts = newDesserts
          }
          
          // 원가 재계산
          newComp.totalCost = 
            (newComp.ff?.cost || 0) + 
            (newComp.drink?.cost || 0) + 
            newComp.desserts.reduce((sum, d) => sum + d.cost, 0)
          
          meals[mealIdx] = {
            ...meal,
            compositions: { ...meal.compositions, [pricePoint]: newComp }
          }
        }
        
        // 원본 식단 업데이트
        updateSingleMeal(mealPlanName, componentType, componentIndex)
        
        // 연동 대상 업데이트
        const targets = getSyncTargets(mealPlanName, componentType, componentIndex)
        targets.forEach(t => {
          updateSingleMeal(t.plan, t.type, t.idx)
        })
        
        return { mealPlanMeals }
      }),

      // FF 수정: 동일 날짜 / 같은 FF타입 전 가격대 연동
      updateFF: (date, mealPlanName, newFF, syncSameType) => set((state) => {
        const mealPlanMeals = { ...state.mealPlanMeals }

        // 같은 FF타입 식단명 추출 (예: '김밥' → ['김밥3.5','김밥4.5','김밥5.5','김밥3.5(음X)'])
        // 음X 포함: 접두사가 같은 모든 식단 (숫자/점/괄호 제외)
        const ffTypePrefix = mealPlanName.replace(/[\d.()음X]+$/g, '').replace(/\(음X\)$/, '') // 숫자+점+괄호 접미사 제거
        const targets = syncSameType
          ? Object.keys(mealPlanMeals).filter(k => k.startsWith(ffTypePrefix))
          : [mealPlanName]

        targets.forEach(planName => {
          const meals = mealPlanMeals[planName]
          if (!meals) return
          const mealIdx = meals.findIndex(m => m.date === date)
          if (mealIdx < 0) return

          const meal = meals[mealIdx]
          const pricePoint = planName.includes('3.5') ? 3500 : planName.includes('4.5') ? 4500 : planName.includes('5.5') ? 5500 : 6500
          const comp = meal.compositions[pricePoint]
          if (!comp) return

          const newComp = {
            ...comp,
            ff: newFF,
            totalCost: newFF.cost + (comp.drink?.cost || 0) + comp.desserts.reduce((s, d) => s + d.cost, 0),
          }
          meals[mealIdx] = {
            ...meal,
            compositions: { ...meal.compositions, [pricePoint]: newComp },
          }
        })

        return { mealPlanMeals }
      }),

      // 전체 식단 스냅샷 저장
      saveSnapshot: (name) => {
        const state = get()
        if (!state.startDate || !state.endDate) {
          set({ snapshotStatus: 'error', snapshotMessage: '식단 기간이 설정되지 않았습니다.' })
          return
        }
        if (Object.keys(state.mealPlanMeals).length === 0) {
          set({ snapshotStatus: 'error', snapshotMessage: '저장할 식단 데이터가 없습니다.' })
          return
        }

        set({ snapshotStatus: 'saving', snapshotMessage: '전체 식단(모든 카테고리) 저장 중...' })

        const snapshot: MealPlanSnapshot = {
          id: generateId(),
          name,
          createdAt: new Date().toISOString(),
          startDate: state.startDate.toISOString(),
          endDate: state.endDate.toISOString(),
          mealPlanMeals: JSON.parse(JSON.stringify(state.mealPlanMeals)),
          mealPlanTargetCosts: { ...state.mealPlanTargetCosts },
          products: JSON.parse(JSON.stringify(state.products)),
        }

        set((prev) => ({
          snapshots: [...prev.snapshots, snapshot],
          snapshotStatus: 'success',
          snapshotMessage: `전체 식단(모든 카테고리) 저장 완료: ${name}`,
        }))

        // 3초 후 상태 초기화
        setTimeout(() => {
          set({ snapshotStatus: 'idle', snapshotMessage: null })
        }, 3000)
      },

      // 전체 식단 스냅샷 불러오기
      loadSnapshot: (id) => {
        const state = get()
        const snapshot = state.snapshots.find(s => s.id === id)
        if (!snapshot) {
          set({ snapshotStatus: 'error', snapshotMessage: '스냅샷을 찾을 수 없습니다.' })
          return
        }

        set({ snapshotStatus: 'loading', snapshotMessage: '전체 식단 복원 중...' })

        // 약간의 딜레이로 로딩 상태 표시 (UX)
        setTimeout(() => {
          set({
            mealPlanMeals: JSON.parse(JSON.stringify(snapshot.mealPlanMeals)),
            mealPlanTargetCosts: { ...snapshot.mealPlanTargetCosts },
            products: JSON.parse(JSON.stringify(snapshot.products)),
            startDate: new Date(snapshot.startDate),
            endDate: new Date(snapshot.endDate),
            snapshotStatus: 'success',
            snapshotMessage: `전체 식단 복원 완료: ${snapshot.name}`,
          })

          // 3초 후 상태 초기화
          setTimeout(() => {
            set({ snapshotStatus: 'idle', snapshotMessage: null })
          }, 3000)
        }, 500)
      },

      // 스냅샷 삭제
      deleteSnapshot: (id) => set((state) => ({
        snapshots: state.snapshots.filter(s => s.id !== id),
      })),

      // 상태 초기화
      clearSnapshotStatus: () => set({ snapshotStatus: 'idle', snapshotMessage: null }),
    }),
    {
      name: 'mealbox-storage',
    }
  )
)
