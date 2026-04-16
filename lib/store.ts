import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { 
  Product, 
  DailyMeal, 
  PRICE_POINT_CONFIGS, 
  MealComposition,
  DayOfWeek,
  DESSERT_DAY_GROUP_MAP,
  DESSERT_DAY_GROUP_MAP_ALT,
  JUMEOKBAP_RULES,
  DessertGroup
} from './types'

interface MealboxStore {
  products: Product[]
  dailyMeals: DailyMeal[]
  targetCosts: { [price: number]: number }
  selectedMonth: Date
  
  // Product actions
  addProduct: (product: Omit<Product, 'id'>) => void
  addProducts: (products: Omit<Product, 'id'>[]) => void
  updateProduct: (id: string, product: Partial<Product>) => void
  deleteProduct: (id: string) => void
  clearProducts: (category?: 'ff' | 'drink' | 'dessert') => void
  
  // Target cost actions
  setTargetCost: (price: number, cost: number) => void
  
  // Meal actions
  setSelectedMonth: (date: Date) => void
  generateMeals: () => void
  updateMealComposition: (date: string, pricePoint: number, composition: MealComposition | null) => void
}

const generateId = () => Math.random().toString(36).substring(2, 9)

// 요일 계산 헬퍼 함수
const getDayOfWeek = (date: Date): DayOfWeek | null => {
  const day = date.getDay()
  const dayMap: { [key: number]: DayOfWeek } = {
    1: '월요일',
    2: '화요일',
    3: '수요일',
    4: '목요일',
    5: '금요일',
  }
  return dayMap[day] || null // 주말은 null
}

// 음료 선택: 해당 요일에 맞는 음료 중 랜덤 선택
const selectDrinkForDay = (drinks: Product[], dayOfWeek: DayOfWeek): Product | undefined => {
  // 해당 요일에 배치 가능한 음료 필터링
  const availableDrinks = drinks.filter(drink => {
    if (!drink.dayConditions || drink.dayConditions.length === 0) {
      return true // 조건이 없으면 모든 요일 가능
    }
    return drink.dayConditions.includes(dayOfWeek)
  })
  
  if (availableDrinks.length === 0) return undefined
  return availableDrinks[Math.floor(Math.random() * availableDrinks.length)]
}

// 디저트 선택: 요일별 그룹 조건에 따라 선택
const selectDessertsForDay = (
  desserts: Product[], 
  dayOfWeek: DayOfWeek, 
  count: number,
  usedIds: Set<string>
): Product[] => {
  if (count === 0) return []
  
  // 요일별 그룹 조건 가져오기 (두 가지 매핑 중 랜덤 선택)
  const useAltMap = Math.random() > 0.5
  const groupMap = useAltMap ? DESSERT_DAY_GROUP_MAP_ALT : DESSERT_DAY_GROUP_MAP
  const dayConditions = groupMap[dayOfWeek]
  
  const selectedDesserts: Product[] = []
  
  // 첫 번째 디저트: 조건1 그룹에서 선택 (고정)
  const condition1Desserts = desserts.filter(d => 
    d.group === dayConditions.condition1 && !usedIds.has(d.id)
  )
  
  if (condition1Desserts.length > 0) {
    const selected = condition1Desserts[Math.floor(Math.random() * condition1Desserts.length)]
    selectedDesserts.push(selected)
    usedIds.add(selected.id)
  }
  
  // 두 번째 디저트가 필요한 경우: 조건2 그룹에서 랜덤 선택
  if (count >= 2 && selectedDesserts.length >= 1) {
    const condition2Desserts = desserts.filter(d => 
      d.group === dayConditions.condition2 && !usedIds.has(d.id)
    )
    
    if (condition2Desserts.length > 0) {
      const selected = condition2Desserts[Math.floor(Math.random() * condition2Desserts.length)]
      selectedDesserts.push(selected)
      usedIds.add(selected.id)
    }
  }
  
  return selectedDesserts
}

export const useMealboxStore = create<MealboxStore>()(
  persist(
    (set, get) => ({
      products: [],
      dailyMeals: [],
      targetCosts: {
        3500: 1800,
        4500: 2300,
        5500: 2800,
        6500: 3300,
      },
      selectedMonth: new Date(),
      
      addProduct: (product) => set((state) => ({
        products: [...state.products, { ...product, id: generateId() }]
      })),
      
      addProducts: (products) => set((state) => ({
        products: [...state.products, ...products.map(p => ({ ...p, id: generateId() }))]
      })),
      
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
      
      generateMeals: () => {
        const { products, targetCosts, selectedMonth } = get()
        
        const ffProducts = products.filter(p => p.category === 'ff')
        const drinkProducts = products.filter(p => p.category === 'drink')
        const dessertProducts = products.filter(p => p.category === 'dessert')
        const dosirakProducts = ffProducts.filter(p => p.ffType === '도시락')
        const jumeokbapProducts = ffProducts.filter(p => p.ffType === '주먹밥')
        const nonDosirakFF = ffProducts.filter(p => p.ffType !== '도시락')
        
        const year = selectedMonth.getFullYear()
        const month = selectedMonth.getMonth()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        
        const newMeals: DailyMeal[] = []
        
        // Track usage to ensure variety
        const usedCombinations: { [pricePoint: number]: Set<string> } = {
          3500: new Set(),
          4500: new Set(),
          5500: new Set(),
          6500: new Set(),
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
          const dateObj = new Date(year, month, day)
          const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayOfWeek = getDayOfWeek(dateObj)
          
          // 주말은 건너뛰기 (필요시)
          if (!dayOfWeek) {
            newMeals.push({ 
              date, 
              dayOfWeek: '월요일', // 주말용 placeholder
              compositions: {} 
            })
            continue
          }
          
          const compositions: { [pricePoint: number]: MealComposition | null } = {}
          
          for (const config of PRICE_POINT_CONFIGS) {
            const targetCost = targetCosts[config.price]
            let bestComposition: MealComposition | null = null
            let attempts = 0
            const maxAttempts = 100
            
            while (attempts < maxAttempts) {
              attempts++
              
              // FF 선택 로직
              let ffPool: Product[]
              let dessertCount = config.composition.dessertCount
              
              if (config.composition.ffType === 'dosirak') {
                ffPool = dosirakProducts
              } else {
                ffPool = nonDosirakFF
              }
              
              if (ffPool.length === 0 || (config.composition.drink && drinkProducts.length === 0)) {
                break
              }
              
              const ff = ffPool[Math.floor(Math.random() * ffPool.length)]
              
              // 주먹밥 특수 규칙 적용
              if (ff.ffType === '주먹밥') {
                const jumeokbapRule = JUMEOKBAP_RULES.priceRules[config.price]
                if (!jumeokbapRule?.available) {
                  continue // 이 가격대에서 주먹밥 사용 불가
                }
                dessertCount = jumeokbapRule.dessertCount
              }
              
              // 음료 선택 (요일 조건 적용)
              const drink = config.composition.drink 
                ? selectDrinkForDay(drinkProducts, dayOfWeek)
                : undefined
              
              if (config.composition.drink && !drink) {
                continue // 음료가 필요한데 없으면 다시 시도
              }
              
              // 디저트 선택 (요일별 그룹 조건 적용)
              const usedDessertIds = new Set<string>()
              const selectedDesserts = selectDessertsForDay(
                dessertProducts, 
                dayOfWeek, 
                dessertCount,
                usedDessertIds
              )
              
              // 필요한 디저트 수를 채우지 못한 경우
              if (dessertCount > 0 && selectedDesserts.length < dessertCount) {
                // 그룹 조건 없이 랜덤으로 추가 선택 시도
                const remainingDesserts = dessertProducts.filter(d => !usedDessertIds.has(d.id))
                while (selectedDesserts.length < dessertCount && remainingDesserts.length > 0) {
                  const idx = Math.floor(Math.random() * remainingDesserts.length)
                  selectedDesserts.push(remainingDesserts[idx])
                  remainingDesserts.splice(idx, 1)
                }
              }
              
              const totalCost = ff.cost + (drink?.cost || 0) + selectedDesserts.reduce((sum, d) => sum + d.cost, 0)
              
              if (totalCost <= targetCost) {
                const compositionKey = `${ff.id}-${drink?.id || ''}-${selectedDesserts.map(d => d.id).sort().join(',')}`
                
                if (!usedCombinations[config.price].has(compositionKey) || attempts > maxAttempts * 0.7) {
                  usedCombinations[config.price].add(compositionKey)
                  bestComposition = {
                    ff,
                    drink,
                    desserts: selectedDesserts,
                    totalCost
                  }
                  break
                }
              }
            }
            
            compositions[config.price] = bestComposition
          }
          
          newMeals.push({ date, dayOfWeek, compositions })
        }
        
        set({ dailyMeals: newMeals })
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
