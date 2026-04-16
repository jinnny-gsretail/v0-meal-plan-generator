import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Product, DailyMeal, PRICE_POINT_CONFIGS, MealComposition } from './types'

interface MealboxStore {
  products: Product[]
  dailyMeals: DailyMeal[]
  targetCosts: { [price: number]: number }
  selectedMonth: Date
  
  // Product actions
  addProduct: (product: Omit<Product, 'id'>) => void
  updateProduct: (id: string, product: Partial<Product>) => void
  deleteProduct: (id: string) => void
  
  // Target cost actions
  setTargetCost: (price: number, cost: number) => void
  
  // Meal actions
  setSelectedMonth: (date: Date) => void
  generateMeals: () => void
  updateMealComposition: (date: string, pricePoint: number, composition: MealComposition | null) => void
}

const generateId = () => Math.random().toString(36).substring(2, 9)

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
      
      updateProduct: (id, updates) => set((state) => ({
        products: state.products.map(p => p.id === id ? { ...p, ...updates } : p)
      })),
      
      deleteProduct: (id) => set((state) => ({
        products: state.products.filter(p => p.id !== id)
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
          const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const compositions: { [pricePoint: number]: MealComposition | null } = {}
          
          for (const config of PRICE_POINT_CONFIGS) {
            const targetCost = targetCosts[config.price]
            let bestComposition: MealComposition | null = null
            let attempts = 0
            const maxAttempts = 100
            
            while (attempts < maxAttempts) {
              attempts++
              
              const ffPool = config.composition.ffType === 'dosirak' ? dosirakProducts : nonDosirakFF
              
              if (ffPool.length === 0 || (config.composition.drink && drinkProducts.length === 0)) {
                break
              }
              
              if (config.composition.dessertCount > 0 && dessertProducts.length < config.composition.dessertCount) {
                break
              }
              
              const ff = ffPool[Math.floor(Math.random() * ffPool.length)]
              const drink = config.composition.drink 
                ? drinkProducts[Math.floor(Math.random() * drinkProducts.length)]
                : undefined
              
              const selectedDesserts: Product[] = []
              if (config.composition.dessertCount > 0) {
                const shuffledDesserts = [...dessertProducts].sort(() => Math.random() - 0.5)
                for (let i = 0; i < config.composition.dessertCount && i < shuffledDesserts.length; i++) {
                  selectedDesserts.push(shuffledDesserts[i])
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
          
          newMeals.push({ date, compositions })
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
