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
      
      generateMeals: () => {
        const { products, targetCosts, selectedMonth } = get()
        
        const drinkProducts = products.filter(p => p.category === 'drink')
        const dessertProducts = products.filter(p => p.category === 'dessert')
        
        // Ensure selectedMonth is a Date object
        const monthDate = selectedMonth instanceof Date ? selectedMonth : new Date(selectedMonth)
        const year = monthDate.getFullYear()
        const month = monthDate.getMonth()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        
        const mealPlanMeals: MealPlanDailyMeals = {}
        
        // 각 식단별로 생성 (11개)
        for (const mealPlan of ALL_MEAL_PLANS) {
          const { name: mealPlanName, ffType, price } = mealPlan
          const targetCost = targetCosts[price] * 1.03 // 103% 상한
          
          // 해당 FF 타입의 상품들
          const ffProducts = products.filter(p => p.category === 'ff' && p.ffType === ffType)
          if (ffProducts.length === 0) continue
          
          // 구성품 개수 결정
          // 삼각(주먹밥): 3.5 = 2개, 4.5 = 3개
          // 김밥/샌드/버거: 3.5 = 1개(음료), 4.5 = 2개(음료+디저트1), 5.5 = 3개(음료+디저트1+디저트2)
          const isSamgak = ffType === '주먹밥'
          
          let drinkCount = 1
          let dessert1Count = 0
          let dessert2Count = 0
          
          if (isSamgak) {
            // 삼각: 3.5 = 구성품2개(음료+디저트1), 4.5 = 구성품3개(음료+디저트1+디저트2)
            dessert1Count = 1
            dessert2Count = price === 4500 ? 1 : 0
          } else {
            // 김밥/샌드/버거: 3.5 = 음료만, 4.5 = 음료+디저트1, 5.5 = 음료+디저트1+디저트2
            if (price >= 4500) dessert1Count = 1
            if (price >= 5500) dessert2Count = 1
          }
          
          const dailyMeals: DailyMeal[] = []
          
          // 이전에 사용된 구성품 추적 (매일 다르게)
          const usedDrinkIds = new Set<string>()
          const usedDessert1Ids = new Set<string>()
          const usedDessert2Ids = new Set<string>()
          
          for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayOfWeek = new Date(year, month, day).getDay()
            
            // FF: 업로드 리스트 순서 반복
            const ffIndex = (day - 1) % ffProducts.length
            const ff = ffProducts[ffIndex]
            
            // 해당 날짜에 사용된 구성품 추적 (하루 식단에 동일 구성품 반복 안됨)
            const usedTodayIds = new Set<string>()
            
            // 음료 선택 - 버거는 탄산만, 나머지는 요일별 그룹
            let drinkGroup = DRINK_GROUP_BY_DAY[dayOfWeek]
            if (ffType === '버거') {
              drinkGroup = '탄산'
            }
            
            let availableDrinks = drinkProducts.filter(d => 
              d.group === drinkGroup && 
              !usedTodayIds.has(d.id)
            )
            
            // 사용 안한 음료 우선, 없으면 전체에서 선택
            let unusedDrinks = availableDrinks.filter(d => !usedDrinkIds.has(d.id))
            if (unusedDrinks.length === 0) {
              usedDrinkIds.clear()
              unusedDrinks = availableDrinks
            }
            
            const drink = unusedDrinks.length > 0 
              ? unusedDrinks[Math.floor(Math.random() * unusedDrinks.length)]
              : availableDrinks[Math.floor(Math.random() * availableDrinks.length)]
            
            if (drink) {
              usedDrinkIds.add(drink.id)
              usedTodayIds.add(drink.id)
            }
            
            const desserts: Product[] = []
            
            // 디저트1 선택
            if (dessert1Count > 0) {
              const dessert1Group = DESSERT1_GROUP_BY_DAY[dayOfWeek]
              let availableDesserts1 = dessertProducts.filter(d => 
                d.group === dessert1Group && 
                !usedTodayIds.has(d.id)
              )
              
              let unusedDesserts1 = availableDesserts1.filter(d => !usedDessert1Ids.has(d.id))
              if (unusedDesserts1.length === 0) {
                usedDessert1Ids.clear()
                unusedDesserts1 = availableDesserts1
              }
              
              const dessert1 = unusedDesserts1.length > 0
                ? unusedDesserts1[Math.floor(Math.random() * unusedDesserts1.length)]
                : availableDesserts1[Math.floor(Math.random() * availableDesserts1.length)]
              
              if (dessert1) {
                desserts.push(dessert1)
                usedDessert1Ids.add(dessert1.id)
                usedTodayIds.add(dessert1.id)
              }
            }
            
            // 디저트2 선택
            if (dessert2Count > 0) {
              const dessert2Groups = DESSERT2_GROUPS_BY_DAY[dayOfWeek]
              const selectedGroup = dessert2Groups[Math.floor(Math.random() * dessert2Groups.length)]
              
              let availableDesserts2 = dessertProducts.filter(d => 
                d.group === selectedGroup && 
                !usedTodayIds.has(d.id)
              )
              
              let unusedDesserts2 = availableDesserts2.filter(d => !usedDessert2Ids.has(d.id))
              if (unusedDesserts2.length === 0) {
                usedDessert2Ids.clear()
                unusedDesserts2 = availableDesserts2
              }
              
              const dessert2 = unusedDesserts2.length > 0
                ? unusedDesserts2[Math.floor(Math.random() * unusedDesserts2.length)]
                : availableDesserts2[Math.floor(Math.random() * availableDesserts2.length)]
              
              if (dessert2) {
                desserts.push(dessert2)
                usedDessert2Ids.add(dessert2.id)
                usedTodayIds.add(dessert2.id)
              }
            }
            
            // 총 원가 계산
            const totalCost = ff.cost + (drink?.cost || 0) + desserts.reduce((sum, d) => sum + d.cost, 0)
            
            // 원가 체크 (103% 초과 시 경고 표시용으로 저장은 함)
            const composition: MealComposition = {
              ff,
              drink,
              desserts,
              totalCost
            }
            
            dailyMeals.push({
              date,
              compositions: { [price]: composition }
            })
          }
          
          mealPlanMeals[mealPlanName] = dailyMeals
        }
        
        // 김밥/샌드는 구성품 동일하게 처리 (김밥 기준으로 샌드 복사)
        for (const priceLabel of ['3.5', '4.5', '5.5']) {
          const gimbapMeals = mealPlanMeals[`김밥${priceLabel}`]
          const sandMeals = mealPlanMeals[`샌드${priceLabel}`]
          
          if (gimbapMeals && sandMeals) {
            for (let i = 0; i < gimbapMeals.length; i++) {
              const gimbapComp = gimbapMeals[i].compositions[parseFloat(priceLabel) * 1000]
              const sandComp = sandMeals[i].compositions[parseFloat(priceLabel) * 1000]
              
              if (gimbapComp && sandComp) {
                // 샌드의 구성품(음료, 디저트)을 김밥과 동일하게
                sandComp.drink = gimbapComp.drink
                sandComp.desserts = [...gimbapComp.desserts]
                sandComp.totalCost = (sandComp.ff?.cost || 0) + (sandComp.drink?.cost || 0) + sandComp.desserts.reduce((sum, d) => sum + d.cost, 0)
              }
            }
          }
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
